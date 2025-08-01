use inline_style_parser::parse_inline_style::Transformer;
use inline_style_parser::{is_newline, is_white_space, parse_inline_style};
use web_sys::console;

use crate::transformer::constants::{
  AUTO_STR_U16, COLOR_APPENDIX_FOR_GRADIENT, COLOR_APPENDIX_FOR_NORMAL_COLOR, COLOR_STR_U16,
  FLEX_AUTO_TRANSFORMED_VALUES, FLEX_BASIS_CSS_VAR_NAME, FLEX_GROW_CSS_VAR_NAME,
  FLEX_NONE_TRANSFORMED_VALUES, FLEX_SHRINK_CSS_VAR_NAME,
  FLEX_SINGLE_VALUE_USE_BASIS_TRANSFORMED_DEFAULT_VALUES,
  FLEX_SINGLE_VALUE_USE_GROW_TRANSFORMED_DEFAULT_VALUES, FLEX_STR_U16, IMPORTANT_STR_U16,
  LINEAR_GRADIENT_STR_U16, LINEAR_WEIGHT_BASIS_CSS_VAR_NAME, LINEAR_WEIGHT_STR_U16,
  LINEAR_WEIGHT_SUM_CSS_VAR_NAME, LINEAR_WEIGHT_SUM_STR_U16, LYNX_TEXT_BG_COLOR_STR_U16,
  NONE_STR_U16,
};
use crate::{get_rename_rule_value, get_replace_rule_value};

pub struct TransformerData<'a> {
  source: &'a js_sys::JsString,
  transformed_source: Vec<String>,
  offset: u32,                        // current the tail offset of the original source
  extra_children_styles: Vec<String>, // used to store the extra styles for children elements
}

// append ';' at the end of each declaration except the last one
macro_rules! append_separator {
  ($transformed_source:expr, $decl_index:expr, $total_len:expr, $is_important:expr) => {
    if $decl_index < $total_len - 1 {
      if $is_important {
        $transformed_source.push(String::from(IMPORTANT_STR_U16));
      }
      $transformed_source.push(String::from(";"));
    }
  };
}

macro_rules! is_digit_only {
  ($source:expr, $start:expr, $end:expr) => {{
    let mut result = true;
    for code in $source.slice($start, $end).iter() {
      if code > b'9' as u16 || code < b'0' as u16 {
        result = false;
        break;
      }
    }
    result
  }};
}

macro_rules! push_u16_decl_pairs {
  ($vec:expr, $pairs:expr) => {
    $vec.extend($pairs.iter().map(|replaced| {
      let decl_name = replaced[0];
      let decl_value = replaced[1];
      (
        String::from(decl_name),
        0 as u32,
        decl_name.len() as u32,
        String::from(decl_value),
        0 as u32,
        decl_value.len() as u32,
      )
    }));
  };
}

type CSSPair = (String, u32, u32, String, u32, u32);

pub fn query_transform_rules<'a>(
  name: &js_sys::JsString,
  name_start: u32,
  name_end: u32,
  value: &js_sys::JsString,
  value_start: u32,
  value_end: u32,
) -> (Vec<CSSPair>, Vec<CSSPair>) {
  let mut result: Vec<CSSPair> = Vec::new();
  let mut result_children: Vec<CSSPair> = Vec::new();
  if let Some(renamed_value) = get_rename_rule_value!(name, name_start, name_end) {
    result.push((
      String::from(renamed_value),
      0,
      renamed_value.len() as u32,
      String::from(value),
      value_start,
      value_end,
    ));
  } else if let Some(replaced) =
    get_replace_rule_value!(name, name_start, name_end, value, value_start, value_end)
  {
    push_u16_decl_pairs!(result, replaced);
  }
  // now transform color
  /*
    if there is a color:linear-gradient(xx) declaration,
      we will transform it to:
      color: transparent;
      --lynx-text-bg-color: linear-gradient(xx);
      -webkit-background-clip: text;
      background-clip: text;
    otherwise:
      --lynx-text-bg-color: initial;
      -webkit-background-clip: initial;
      background-clip: initial;
      color: xx;
  */
  // compare the name is "color"
  else if name.slice(name_start, name_end) == COLOR_STR_U16 {
    // check if the value is starting with "linear-gradient"
    let is_linear_gradient = value_end - value_start >= LINEAR_GRADIENT_STR_U16.len() as u32
      && value.slice(
        value_start,
        value_start + LINEAR_GRADIENT_STR_U16.len() as u32,
      ) == LINEAR_GRADIENT_STR_U16;
    let (appendix, keeped_name) = if is_linear_gradient {
      (COLOR_APPENDIX_FOR_GRADIENT, LYNX_TEXT_BG_COLOR_STR_U16)
    } else {
      (COLOR_APPENDIX_FOR_NORMAL_COLOR, COLOR_STR_U16)
    };
    push_u16_decl_pairs!(result, appendix);
    result.push((
      String::from(keeped_name),
      0,
      keeped_name.len() as u32,
      String::from(value),
      value_start,
      value_end,
    ));
  }
  /* transform the flex 1 2 3 to
  --flex-shrink:1;
  --flex-grow:2;
  --flex-basis:3;
  */
  else if name.slice(name_start, name_end) == FLEX_STR_U16 {
    // we will use the value as flex-basis, flex-grow, flex-shrink
    let mut current_offset = value_start;
    let mut val_fields = [value_end; 6]; // we will use 3 fields, but we will use 6 to avoid the need to check the length
    let mut ii = 0;
    while current_offset < value_end && ii < val_fields.len() {
      let code = value.char_code_at(current_offset) as u32;
      if (ii % 2 == 0 && !is_white_space!(code)) || (ii % 2 == 1 && is_white_space!(code)) {
        val_fields[ii] = current_offset;
        ii += 1;
      }
      current_offset += 1;
    }
    let value_num: usize = ii.div_ceil(2); // we will have 3 values, but the last one is optional
    match value_num {
      0 => {
        // if we have no value, we will ignore it
        // we will not add any declaration
      }
      1 => {
        if value.slice(val_fields[0], val_fields[1]) == NONE_STR_U16 {
          /*
           * --flex-shrink:0;
           * --flex-grow:0;
           * --flex-basis:auto;
           */
          push_u16_decl_pairs!(result, FLEX_NONE_TRANSFORMED_VALUES);
        } else if value.slice(val_fields[0], val_fields[1]) == AUTO_STR_U16 {
          /*
           * --flex-shrink:1;
           * --flex-grow:1;
           * --flex-basis:auto;
           */
          push_u16_decl_pairs!(result, FLEX_AUTO_TRANSFORMED_VALUES);
        } else {
          let is_flex_grow = is_digit_only!(value, val_fields[0], val_fields[1]);
          if is_flex_grow {
            // if we only have one pure number, we will use it as flex-grow
            // flex: <flex-grow> 1 0
            push_u16_decl_pairs!(
              result,
              FLEX_SINGLE_VALUE_USE_GROW_TRANSFORMED_DEFAULT_VALUES
            );
            result.push((
              String::from(FLEX_GROW_CSS_VAR_NAME),
              0,
              FLEX_GROW_CSS_VAR_NAME.len() as u32,
              String::from(value),
              val_fields[0],
              val_fields[1],
            ));
          } else {
            // else it is
            // flex: 1 1 <flex-basis>
            push_u16_decl_pairs!(
              result,
              FLEX_SINGLE_VALUE_USE_BASIS_TRANSFORMED_DEFAULT_VALUES
            );
            result.push((
              String::from(FLEX_BASIS_CSS_VAR_NAME),
              0,
              FLEX_BASIS_CSS_VAR_NAME.len() as u32,
              String::from(value),
              val_fields[0],
              val_fields[1],
            ));
          }
        }
      }
      2 => {
        // The first value must be a valid value for flex-grow.
        result.push((
          String::from(FLEX_GROW_CSS_VAR_NAME),
          0,
          FLEX_GROW_CSS_VAR_NAME.len() as u32,
          String::from(value),
          val_fields[0],
          val_fields[1],
        ));
        let is_flex_shrink = is_digit_only!(value, val_fields[2], val_fields[3]);
        if is_flex_shrink {
          /*
          a valid value for flex-shrink: then, in all the browsers,
          the shorthand expands to flex: <flex-grow> <flex-shrink> 0%.
           */
          result.push((
            String::from(FLEX_BASIS_CSS_VAR_NAME),
            0,
            FLEX_BASIS_CSS_VAR_NAME.len() as u32,
            String::from("0%"),
            0,
            "0%".len() as u32,
          ));
          result.push((
            String::from(FLEX_SHRINK_CSS_VAR_NAME),
            0,
            FLEX_SHRINK_CSS_VAR_NAME.len() as u32,
            String::from(value),
            val_fields[2],
            val_fields[3],
          ));
        } else {
          /*
          a valid value for flex-basis: then the shorthand expands to flex: <flex-grow> 1 <flex-basis>.
           */

          result.push((
            String::from(FLEX_SHRINK_CSS_VAR_NAME),
            0,
            FLEX_SHRINK_CSS_VAR_NAME.len() as u32,
            String::from("1"),
            0,
            "1".len() as u32,
          ));
          result.push((
            String::from(FLEX_BASIS_CSS_VAR_NAME),
            0,
            FLEX_BASIS_CSS_VAR_NAME.len() as u32,
            String::from(value),
            val_fields[2],
            val_fields[3],
          ));
        }
      }
      3 => {
        // flex: <flex-grow> <flex-shrink> <flex-basis>
        // &value[val_fields[0]..val_fields[1]]
        let transformed_flex_values = &[
          &[
            FLEX_GROW_CSS_VAR_NAME,
            &String::from(value.slice(val_fields[0], val_fields[1])),
          ],
          &[
            FLEX_SHRINK_CSS_VAR_NAME,
            &String::from(value.slice(val_fields[2], val_fields[3])),
          ],
          &[
            FLEX_BASIS_CSS_VAR_NAME,
            &String::from(value.slice(val_fields[4], val_fields[5])),
          ],
        ];
        push_u16_decl_pairs!(result, transformed_flex_values);
      }
      _ => {
        // we have more than 3 values, we will ignore the rest
      }
    }
  }
  /*
   now we're going to generate children style for linear-weight-sum
   linear-weight-sum: <value> --> --lynx-linear-weight-sum: <value>;
  */
  if name.slice(name_start, name_end) == LINEAR_WEIGHT_SUM_STR_U16 {
    result_children.push((
      String::from(LINEAR_WEIGHT_SUM_CSS_VAR_NAME),
      0,
      LINEAR_WEIGHT_SUM_CSS_VAR_NAME.len() as u32,
      String::from(value),
      value_start,
      value_end,
    ));
  }
  /*
   * There is a special rule for linear-weight
   * linear-weight: 0; -->  do nothing
   * linear-weight: <value> --> --lynx-linear-weight: 0;
   */
  if name.slice(name_start, name_end) == LINEAR_WEIGHT_STR_U16
    && value.slice(value_start, value_end) != "0"
  {
    result.push((
      String::from(LINEAR_WEIGHT_BASIS_CSS_VAR_NAME),
      0,
      LINEAR_WEIGHT_BASIS_CSS_VAR_NAME.len() as u32,
      String::from("0"),
      0,
      "0".len() as u32,
    ));
  }
  (result, result_children)
}

impl Transformer for TransformerData<'_> {
  fn on_declaration(
    &mut self,
    name_start: u32,
    name_end: u32,
    value_start: u32,
    value_end: u32,
    is_important: bool,
  ) {
    let (result, result_children) = query_transform_rules(
      self.source,
      name_start,
      name_end,
      self.source,
      value_start,
      value_end,
    );

    if !result.is_empty() {
      // Append content before the declaration name
      self
        .transformed_source
        .push(String::from(self.source.slice(self.offset, name_start)));
      // .push(&String::from(self.source.slice(self.offset, name_start)));

      let result_len = result.len();
      for (
        idx,
        (decl_name, decl_name_start, decl_name_end, decl_value, decl_value_start, decl_value_end),
      ) in result.iter().enumerate()
      {
        // Append the declaration name and colon
        self.transformed_source.push(String::from(
          &decl_name[*decl_name_start as usize..*decl_name_end as usize],
        ));
        self.transformed_source.push(String::from(":"));
        // Append the declaration value
        self.transformed_source.push(String::from(
          &decl_value[*decl_value_start as usize..*decl_value_end as usize],
        ));
        // Append separator
        append_separator!(self.transformed_source, idx, result_len, is_important);
      }
      self.offset = value_end;
    }

    if !result_children.is_empty() {
      let result_len = result_children.len();
      for (
        idx,
        (decl_name, decl_name_start, decl_name_end, decl_value, decl_value_start, decl_value_end),
      ) in result_children.iter().enumerate()
      {
        // Append the declaration name and colon
        self.extra_children_styles.push(String::from(
          &decl_name[*decl_name_start as usize..*decl_name_end as usize],
        ));
        self.extra_children_styles.push(String::from(":"));
        // Append the declaration value
        self.extra_children_styles.push(String::from(
          &decl_value[*decl_value_start as usize..*decl_value_end as usize],
        ));
        // Append separator
        append_separator!(
          self.extra_children_styles,
          idx,
          result_len + 1, // always add !important; at the end for children styles
          is_important
        );
      }
    }
  }
}

pub fn transform_inline_style_string<'a>(source: &'a js_sys::JsString) -> String {
  let mut transformer: TransformerData<'a> = TransformerData {
    source,
    transformed_source: Vec::new(),
    offset: 0,
    extra_children_styles: Vec::new(),
  };
  parse_inline_style::parse_inline_style(source, &mut transformer);
  // if transformer.offset != 0 {
  //   // append the remaining part of the source
  //   transformer
  //     .transformed_source
  //     .extend_from_slice(&source[transformer.offset..]);
  // }
  // String::from_utf16(&transformer.transformed_source).unwrap()
  // console::log_1(&transformer.transformed_source);
  transformer
    .transformed_source
    .iter()
    .flat_map(|s| s.chars())
    .collect()
  // transformer.transformed_source
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn transform_basic() {
    let source =
      js_sys::JsString::from("height:1px;display:linear;flex-direction:row;width:100px;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
      result,
      "height:1px;--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;--flex-direction:row;width:100px;"
    );
  }

  #[test]
  fn transform_with_blank() {
    let source = js_sys::JsString::from("flex-direction:row;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-direction:row;");
  }

  #[test]
  fn test_replace_rule_display_linear_blank_after_colon() {
    let source = js_sys::JsString::from("display: linear;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;"
    );
  }

  #[test]
  fn test_replace_rule_linear_orientation() {
    let source = js_sys::JsString::from("linear-direction:row;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
      result,
      "--lynx-linear-orientation:horizontal;--lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal);"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_important() {
    let source = js_sys::JsString::from("display: linear !important;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        "--lynx-display-toggle:var(--lynx-display-linear) !important;--lynx-display:linear !important;display:flex !important;"
    );
  }

  #[test]
  fn transform_color_normal() {
    let source = js_sys::JsString::from("color:blue;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        "--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue;"
    );
  }

  #[test]
  fn transform_color_normal_with_blank() {
    let source = js_sys::JsString::from(" color : blue ;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        " --lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue ;"
    );
  }

  #[test]
  fn transform_color_normal_important() {
    let source = js_sys::JsString::from(" color : blue !important ;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        " --lynx-text-bg-color:initial !important;-webkit-background-clip:initial !important;background-clip:initial !important;color:blue !important ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient() {
    let source = js_sys::JsString::from(" color : linear-gradient(pink, blue) ;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        " color:transparent;-webkit-background-clip:text;background-clip:text;--lynx-text-bg-color:linear-gradient(pink, blue) ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient_important() {
    let source = js_sys::JsString::from(" color : linear-gradient(pink, blue) !important ;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        " color:transparent !important;-webkit-background-clip:text !important;background-clip:text !important;--lynx-text-bg-color:linear-gradient(pink, blue) !important ;"
    );
  }

  #[test]
  fn transform_color_with_font_size() {
    let source = js_sys::JsString::from("font-size: 24px; color: blue");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        "font-size: 24px; --lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue"
    );
  }

  #[test]
  fn flex_none() {
    let source = js_sys::JsString::from("flex:none;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-shrink:0;--flex-grow:0;--flex-basis:auto;");
  }

  #[test]
  fn flex_auto() {
    let source = js_sys::JsString::from("flex:auto;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-shrink:1;--flex-grow:1;--flex-basis:auto;");
  }

  #[test]
  fn flex_1() {
    let source = js_sys::JsString::from("flex:1;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-shrink:1;--flex-basis:0%;--flex-grow:1;");
  }

  #[test]
  fn flex_1_percent() {
    let source = js_sys::JsString::from("flex:1%;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-shrink:1;--flex-grow:1;--flex-basis:1%;");
  }

  #[test]
  fn flex_2_3() {
    let source = js_sys::JsString::from("flex:2 3;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-grow:2;--flex-basis:0%;--flex-shrink:3;");
  }

  #[test]
  fn flex_2_3_percentage() {
    let source = js_sys::JsString::from("flex:2 3%;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-grow:2;--flex-shrink:1;--flex-basis:3%;");
  }

  #[test]
  fn flex_2_3_px() {
    let source = js_sys::JsString::from("flex:2 3px;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-grow:2;--flex-shrink:1;--flex-basis:3px;");
  }

  #[test]
  fn flex_3_4_5_percentage() {
    let source = js_sys::JsString::from("flex:3 4 5%;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--flex-grow:3;--flex-shrink:4;--flex-basis:5%;");
  }

  #[test]
  fn flex_1_extra() {
    let source = js_sys::JsString::from("width:100px; flex:none; width:100px;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
      result,
      "width:100px; --flex-shrink:0;--flex-grow:0;--flex-basis:auto; width:100px;"
    );
  }

  #[test]
  fn linear_weight_sum_0_children_style() {
    let source = js_sys::JsString::from("linear-weight-sum: 0;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--lynx-linear-weight-sum:0;");
  }

  #[test]
  fn linear_weight_sum_1_children_style() {
    let source = js_sys::JsString::from("linear-weight-sum: 1;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--lynx-linear-weight-sum:1;");
  }

  #[test]
  fn linear_weight_sum_1_important_children_style() {
    let source = js_sys::JsString::from("linear-weight-sum: 1 !important;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--lynx-linear-weight-sum:1 !important;");
  }

  #[test]
  fn complex_1() {
    let source = js_sys::JsString::from("linear-direction:row;linear-weight: 0;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
        result,
        "--lynx-linear-orientation:horizontal;--lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal);--lynx-linear-weight:0;"
    );
  }

  #[test]
  fn linear_weight_0() {
    let source = js_sys::JsString::from("linear-weight: 0;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--lynx-linear-weight:0;");
  }

  #[test]
  fn linear_weight_1() {
    let source = js_sys::JsString::from("linear-weight: 1;");
    let result = transform_inline_style_string(&source);
    assert_eq!(
      result,
      "--lynx-linear-weight:1;--lynx-linear-weight-basis:0;"
    );
  }

  #[test]
  fn linear_layout_gravity() {
    let source = js_sys::JsString::from("linear-layout-gravity: right;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--align-self-row:auto;--align-self-column:end;");
  }

  #[test]
  fn linear_layout_gravity_start() {
    let source = js_sys::JsString::from("linear-layout-gravity: start;");
    let result = transform_inline_style_string(&source);
    assert_eq!(result, "--align-self-row:start;--align-self-column:start;");
  }

  #[test]
  fn test_query_transform_rules_linear_direction() {
    let name = js_sys::JsString::from("linear-direction");
    let value = js_sys::JsString::from("row");
    let (result, _) = query_transform_rules(&name, 0, name.length(), &value, 0, value.length());
    assert_eq!(result[0].0, "--lynx-linear-orientation");
    assert_eq!(result[0].3, "horizontal");
  }
}
