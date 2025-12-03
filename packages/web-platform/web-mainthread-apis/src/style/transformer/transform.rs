use super::super::inline_style_parser::{char_code_definitions::*, parse_inline_style::*};
use super::rules::{get_rename_rule_value, get_replace_rule_value};

pub struct TransformerData<'a> {
  source: &'a str,
  transformed_source: String,
  offset: usize,                 // current the tail offset of the original source
  extra_children_styles: String, // used to store the extra styles for children elements
}

#[inline(always)]
pub fn is_digit_only(source: &str) -> bool {
  for code in source.as_bytes() {
    if code > &b'9' as &u8 || code < &b'0' as &u8 {
      return false;
    }
  }
  true
}

type CSSPair<'a> = (&'a str, &'a str);

pub fn query_transform_rules<'a>(
  name: &'a str,
  value: &'a str,
) -> (Vec<CSSPair<'a>>, Vec<CSSPair<'a>>) {
  let mut result: Vec<CSSPair<'a>> = Vec::new();
  let mut result_children: Vec<CSSPair<'a>> = Vec::new();
  if let Some(renamed_value) = get_rename_rule_value(name) {
    result.push((renamed_value, value));
  } else if let Some(replaced) = get_replace_rule_value(name, value) {
    result.extend(replaced);
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
  else if name == "color" {
    // check if the value is starting with "linear-gradient"
    let is_linear_gradient = value.starts_with("linear-gradient");
    if is_linear_gradient {
      result.extend([
        ("color", "transparent"),
        ("-webkit-background-clip", "text"),
        ("background-clip", "text"),
        ("--lynx-text-bg-color", value),
      ]);
    } else {
      result.extend([
        ("--lynx-text-bg-color", "initial"),
        ("-webkit-background-clip", "initial"),
        ("background-clip", "initial"),
        ("color", value),
      ]);
    };
  }
  /*
   now we're going to generate children style for linear-weight-sum
   linear-weight-sum: <value> --> --lynx-linear-weight-sum: <value>;
  */
  if name == "linear-weight-sum" {
    result_children.push(("--lynx-linear-weight-sum", value));
  }
  /*
   * There is a special rule for linear-weight
   * linear-weight: 0; -->  do nothing
   * linear-weight: <value> --> --lynx-linear-weight: 0;
   */
  if name == "linear-weight" && value != "0" {
    result.push(("--lynx-linear-weight-basis", "0"));
  }
  (result, result_children)
}

impl Transformer for TransformerData<'_> {
  fn on_declaration(
    &mut self,
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
    is_important: bool,
  ) {
    let name = &self.source[name_start..name_end];
    let value = &self.source[value_start..value_end];
    let (result, result_children) = query_transform_rules(name, value);

    if !result.is_empty() {
      // Append content before the declaration name
      self
        .transformed_source
        .push_str(&self.source[self.offset..name_start]);

      for (idx, (name_transformed, value_transformed)) in result.iter().enumerate() {
        // Append the declaration name and colon
        self.transformed_source.push_str(&format!(
          "{}:{}{}",
          name_transformed,
          value_transformed,
          // do not append !important at the end of the last declaration
          if idx < result.len() - 1 {
            if is_important {
              " !important;"
            } else {
              ";"
            }
          } else {
            ""
          }
        ));
      }
      self.offset = value_end;
    }

    if !result_children.is_empty() {
      for (name_transformed, value_transformed) in result_children {
        // Append the declaration name and colon
        self.extra_children_styles.push_str(&format!(
          "{}:{}{};",
          name_transformed,
          value_transformed,
          if is_important { " !important" } else { "" }
        ));
      }
    }
  }
}

pub fn transform_inline_style_string<'a>(source: &'a str) -> (String, String) {
  let mut transformer: TransformerData<'a> = TransformerData {
    source,
    transformed_source: String::new(),
    offset: 0,
    extra_children_styles: String::new(),
  };
  let bytes = source.as_bytes();
  parse_inline_style(bytes, &mut transformer);
  transformer
    .transformed_source
    .push_str(&source[transformer.offset..]);
  (
    transformer.transformed_source,
    transformer.extra_children_styles,
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn basic_one_simple_decl() {
    let source = "height:1px;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "height:1px;");
  }

  #[test]
  fn transform_basic() {
    let source = "height:1px;display:linear;flex-direction:row;width:100px;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "height:1px;--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;--flex-direction:row;width:100px;"
    );
  }

  #[test]
  fn transform_with_blank() {
    let source = "flex-direction:row;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-direction:row;");
  }

  #[test]
  fn test_replace_rule_display_linear_blank_after_colon() {
    let source = "display: linear;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;"
    );
  }

  #[test]
  fn test_replace_rule_linear_orientation() {
    let source = "linear-direction:row;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "--lynx-linear-orientation:horizontal;--lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal);"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_important() {
    let source = "display: linear !important;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear) !important;--lynx-display:linear !important;display:flex !important;"
    );
  }

  #[test]
  fn transform_color_normal() {
    let source = "color:blue;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue;"
    );
  }

  #[test]
  fn transform_color_normal_with_blank() {
    let source = " color : blue ;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      " --lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue ;"
    );
  }

  #[test]
  fn transform_color_normal_important() {
    let source = " color : blue !important ;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      " --lynx-text-bg-color:initial !important;-webkit-background-clip:initial !important;background-clip:initial !important;color:blue !important ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient() {
    let source = " color : linear-gradient(pink, blue) ;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      " color:transparent;-webkit-background-clip:text;background-clip:text;--lynx-text-bg-color:linear-gradient(pink, blue) ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient_important() {
    let source = " color : linear-gradient(pink, blue) !important ;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      " color:transparent !important;-webkit-background-clip:text !important;background-clip:text !important;--lynx-text-bg-color:linear-gradient(pink, blue) !important ;"
    );
  }

  #[test]
  fn transform_color_with_font_size() {
    let source = "font-size: 24px; color: blue";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "font-size: 24px; --lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue"
    );
  }

  #[test]
  fn flex_none() {
    let source = "flex:none;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-shrink:0;--flex-grow:0;--flex-basis:auto;");
  }

  #[test]
  fn flex_auto() {
    let source = "flex:auto;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-shrink:1;--flex-grow:1;--flex-basis:auto;");
  }

  #[test]
  fn flex_1() {
    let source = "flex:1;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-grow:1;--flex-shrink:1;--flex-basis:0%;");
  }
  #[test]
  fn flex_1_percent() {
    let source = "flex:1%;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-grow:1;--flex-shrink:1;--flex-basis:1%;");
  }

  #[test]
  fn flex_2_3() {
    let source = "flex:2 3;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-grow:2;--flex-shrink:3;--flex-basis:0%;");
  }

  #[test]
  fn flex_2_3_percentage() {
    let source = "flex:2 3%;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-grow:2;--flex-shrink:1;--flex-basis:3%;");
  }

  #[test]
  fn flex_2_3_px() {
    let source = "flex:2 3px;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-grow:2;--flex-shrink:1;--flex-basis:3px;");
  }

  #[test]
  fn flex_3_4_5_percentage() {
    let source = "flex:3 4 5%;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-grow:3;--flex-shrink:4;--flex-basis:5%;");
  }

  #[test]
  fn flex_1_extra() {
    let source = "width:100px; flex:none; width:100px;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "width:100px; --flex-shrink:0;--flex-grow:0;--flex-basis:auto; width:100px;"
    );
  }

  #[test]
  fn linear_weight_sum_0_children_style() {
    let source = "linear-weight-sum: 0;";
    let result = transform_inline_style_string(source).1;
    assert_eq!(result, "--lynx-linear-weight-sum:0;");
  }

  #[test]
  fn linear_weight_sum_1_children_style() {
    let source = "linear-weight-sum: 1;";
    let result = transform_inline_style_string(source).1;
    assert_eq!(result, "--lynx-linear-weight-sum:1;");
  }

  #[test]
  fn linear_weight_sum_1_important_children_style() {
    let source = "linear-weight-sum: 1 !important;";
    let result = transform_inline_style_string(source).1;
    assert_eq!(result, "--lynx-linear-weight-sum:1 !important;");
  }
  #[test]
  fn complex_1() {
    let source = "linear-direction:row;linear-weight: 0;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "--lynx-linear-orientation:horizontal;--lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal);--lynx-linear-weight:0;"
    );
  }

  #[test]
  fn linear_weight_0() {
    let source = "linear-weight: 0;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--lynx-linear-weight:0;");
  }

  #[test]
  fn linear_weight_1() {
    let source = "linear-weight: 1;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "--lynx-linear-weight:1;--lynx-linear-weight-basis:0;"
    );
  }

  #[test]
  fn test_query_transform_rules_linear_direction() {
    let name = "linear-direction";
    let value = "row";
    let (result, _) = query_transform_rules(name, value);
    assert_eq!(result[0].0, "--lynx-linear-orientation");
    assert_eq!(result[0].1, "horizontal");
  }

  #[test]
  fn linear_layout_gravity() {
    let source = "linear-layout-gravity: right;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--align-self-row:auto;--align-self-column:end;");
  }

  #[test]
  fn linear_layout_gravity_start() {
    let source = "linear-layout-gravity: start;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--align-self-row:start;--align-self-column:start;");
  }
}
