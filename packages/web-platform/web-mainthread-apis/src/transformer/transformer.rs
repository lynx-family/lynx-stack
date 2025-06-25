use crate::transformer::constants::{
  AUTO_STR_U16, COLOR_APPENDIX_FOR_GRADIENT, COLOR_APPENDIX_FOR_NORMAL_COLOR, COLOR_STR_U16,
  FLEX_STR_U16, IMPORTANT_STR_U16, LINEAR_GRADIENT_STR_U16, LINEAR_WEIGHT_SUM_STR_U16,
  NONE_STR_U16,
};
use crate::{
  css::{self, parse_inline_style::Transformer},
  get_rename_rule_value, get_replace_rule_value,
};
use crate::{is_newline, is_white_space};

pub struct TransformerData<'a> {
  source: &'a [u16],
  transformed_source: Vec<u16>,
  offset: usize,                   // current the tail offset of the original source
  extra_children_styles: Vec<u16>, // used to store the extra styles for children elements
}

// append ';' at the end of each declaration except the last one
macro_rules! append_separator {
  ($transformed_source:expr, $decl_index:expr, $total_len:expr, $is_important:expr) => {
    if $decl_index < $total_len - 1 {
      if $is_important {
        $transformed_source.extend_from_slice(IMPORTANT_STR_U16);
      }
      $transformed_source.push(b';' as u16);
    }
  };
}

macro_rules! is_digit_only {
  ($source:expr, $start:expr, $end:expr) => {{
    let mut result = true;
    for code in $source[$start..$end].iter() {
      if *code > b'9' as u16 || *code < b'0' as u16 {
        result = false;
        break;
      }
    }
    result
  }};
}

impl<'a> Transformer for TransformerData<'a> {
  fn on_declaration(
    &mut self,
    name_start: usize,
    name_end: usize,
    value_start: usize,
    value_end: usize,
    is_important: bool,
  ) {
    // check the rename rule
    if let Some(renamed_value) = get_rename_rule_value!(self.source, name_start, name_end) {
      // if we have a rename rule, we will use it
      self
        .transformed_source
        .extend_from_slice(&self.source[self.offset..name_start]);
      // Convert the bytes to u16 values
      self
        .transformed_source
        .extend(renamed_value[0][0].bytes().map(|b| b as u16));
      self.offset = name_end;
    } else if let Some(replaced_value) = get_replace_rule_value!(
      self.source,
      name_start,
      name_end,
      self.source,
      value_start,
      value_end
    ) {
      self
        .transformed_source
        .extend_from_slice(&self.source[self.offset..name_start]);
      for ii in 0..replaced_value.len() {
        let [decl_name, decl_value] = &replaced_value[ii];
        // Convert the bytes to u16 values
        self
          .transformed_source
          .extend(decl_name.bytes().map(|b| b as u16));
        self.transformed_source.push(b':' as u16);
        self
          .transformed_source
          .extend(decl_value.bytes().map(|b| b as u16));
        append_separator!(
          self.transformed_source,
          ii,
          replaced_value.len(),
          is_important
        );
      }
      self.offset = value_end;
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
    else if self.source[name_start..name_end] == *COLOR_STR_U16 {
      self
        .transformed_source
        .extend_from_slice(&self.source[self.offset..name_start]);
      // check if the value is starting with "linear-gradient"
      let is_linear_gradient = value_end - value_start >= LINEAR_GRADIENT_STR_U16.len()
        && self.source[value_start..value_start + LINEAR_GRADIENT_STR_U16.len()]
          == *LINEAR_GRADIENT_STR_U16;
      let appendix = if is_linear_gradient {
        COLOR_APPENDIX_FOR_GRADIENT
      } else {
        COLOR_APPENDIX_FOR_NORMAL_COLOR
      };
      for ii in 0..appendix.len() {
        let one_decl = appendix[ii];
        // Convert the bytes to u16 values
        self
          .transformed_source
          .extend(one_decl.bytes().map(|b| b as u16));
        append_separator!(
          self.transformed_source,
          ii,
          appendix.len() + 1, // +1 because the last one we only replace the name
          is_important
        );
      }
      if is_linear_gradient {
        self
          .transformed_source
          .extend("--lynx-text-bg-color".bytes().map(|b| b as u16));
        self.offset = name_end;
      } else {
        self.transformed_source.extend_from_slice(COLOR_STR_U16);
        self.offset = name_end;
      };
    }
    /* transform the flex 1 2 3 to
    --flex-shrink:1;
    --flex-grow:2;
    --flex-basis:3;
    */
    else if self.source[name_start..name_end] == *FLEX_STR_U16 {
      self
        .transformed_source
        .extend_from_slice(&self.source[self.offset..name_start]);
      // we will use the value as flex-basis, flex-grow, flex-shrink
      let mut offset = value_start;
      let mut val_fields = [value_end; 6]; // we will use 3 fields, but we will use 6 to avoid the need to check the length
      let mut ii = 0;
      while offset < value_end && ii < val_fields.len() {
        let code = self.source[offset];
        if (ii % 2 == 0 && !is_white_space!(code)) || (ii % 2 == 1 && is_white_space!(code)) {
          val_fields[ii] = offset;
          ii += 1;
        }
        offset += 1;
      }
      let value_num: usize = (ii + 1) / 2; // we will have 3 values, but the last one is optional
      match value_num {
        0 => {
          self.offset = name_start;
        }
        1 => {
          if self.source[val_fields[0]..val_fields[1]] == *NONE_STR_U16 {
            /*
             * --flex-shrink:0;
             * --flex-grow:0;
             * --flex-basis:auto;
             */
            self.transformed_source.extend(
              "--flex-shrink:0;--flex-grow:0;--flex-basis:auto"
                .bytes()
                .map(|b| b as u16),
            );
            self.offset = value_end;
          } else if self.source[val_fields[0]..val_fields[1]] == *AUTO_STR_U16 {
            /*
             * --flex-shrink:1;
             * --flex-grow:1;
             * --flex-basis:auto;
             */
            self.transformed_source.extend(
              "--flex-shrink:1;--flex-grow:1;--flex-basis:auto"
                .bytes()
                .map(|b| b as u16),
            );
            self.offset = value_end;
          } else {
            // if we only have one number, we will use it as flex-grow
            // flex: <flex-grow> 1 0
            let is_flex_grow = is_digit_only!(self.source, val_fields[0], val_fields[1]);
            if is_flex_grow {
              self.transformed_source.extend(
                "--flex-shrink:1;--flex-basis:0%;--flex-grow:"
                  .bytes()
                  .map(|b| b as u16),
              );
              self.offset = value_start;
            } else {
              self.transformed_source.extend(
                "--flex-shrink:1;--flex-grow:1;--flex-basis:"
                  .bytes()
                  .map(|b| b as u16),
              );
              self.offset = value_start;
            }
          }
        }
        2 => {
          // The first value must be a valid value for flex-grow.
          self
            .transformed_source
            .extend("--flex-grow:".bytes().map(|b| b as u16));
          self
            .transformed_source
            .extend_from_slice(&self.source[val_fields[0]..val_fields[1]]);
          let is_flex_shrink = is_digit_only!(self.source, val_fields[2], val_fields[3]);
          if is_flex_shrink {
            /*
            a valid value for flex-shrink: then, in all the browsers,
            the shorthand expands to flex: <flex-grow> <flex-shrink> 0%.
             */
            self
              .transformed_source
              .extend(";--flex-basis:0%;--flex-shrink:".bytes().map(|b| b as u16));
          } else {
            /*
            a valid value for flex-basis: then the shorthand expands to flex: <flex-grow> 1 <flex-basis>.
             */
            self
              .transformed_source
              .extend(";--flex-shrink:1;--flex-basis:".bytes().map(|b| b as u16));
          }
          self.offset = val_fields[2];
        }
        3 => {
          // flex: <flex-grow> <flex-shrink> <flex-basis>
          self
            .transformed_source
            .extend("--flex-grow:".bytes().map(|b| b as u16));
          self
            .transformed_source
            .extend_from_slice(&self.source[val_fields[0]..val_fields[1]]);
          self
            .transformed_source
            .extend(";--flex-shrink:".bytes().map(|b| b as u16));
          self
            .transformed_source
            .extend_from_slice(&self.source[val_fields[2]..val_fields[3]]);
          self
            .transformed_source
            .extend(";--flex-basis:".bytes().map(|b| b as u16));
          self
            .transformed_source
            .extend_from_slice(&self.source[val_fields[4]..val_fields[5]]);
          self.offset = value_end;
        }
        _ => {
          // we have more than 3 values, we will ignore the rest
        }
      }
    }
    /*
     now we're going to generate children style for linear-weight-sum
     linear-weight-sum: 0; --> --linear-weight-sum: 1;
     linear-weight-sum: <value> --> --linear-weight-sum: <value>;
    */
    if self.source[name_start..name_end] == *LINEAR_WEIGHT_SUM_STR_U16 {
      if value_end - value_start == 1 && self.source[value_start] == b'0' as u16 {
        // if the value is 0, we will use 1
        self
          .extra_children_styles
          .extend("--linear-weight-sum:1".bytes().map(|b| b as u16));
      } else {
        self
          .extra_children_styles
          .extend("--linear-weight-sum:".bytes().map(|b| b as u16));
        self
          .extra_children_styles
          .extend_from_slice(&self.source[value_start..value_end]);
      }
      if is_important {
        self.extra_children_styles.extend(IMPORTANT_STR_U16);
      }
      self.extra_children_styles.push(b';' as u16);
    }
  }
}

pub fn transform_inline_style_string<'a>(source: &'a [u16]) -> (Vec<u16>, Vec<u16>) {
  let mut transformer: TransformerData<'a> = TransformerData {
    source,
    transformed_source: Vec::new(),
    offset: 0,
    extra_children_styles: Vec::new(),
  };
  css::parse_inline_style::parse_inline_style(source, &mut transformer);
  if transformer.offset != 0 {
    // append the remaining part of the source
    transformer
      .transformed_source
      .extend_from_slice(&source[transformer.offset..]);
  }
  (
    transformer.transformed_source,
    transformer.extra_children_styles,
  )
}

pub fn transform_parsed_style_string<'a>(
  source: &'a [u16],
  declaration_positions: &[usize],
) -> (Vec<u16>, Vec<u16>) {
  assert!(declaration_positions.len() % 5 == 0, "declaration_positions must be a multiple of 5 for name_start, name_end, value_start, value_end, is_important");
  let mut transformer: TransformerData<'a> = TransformerData {
    source,
    transformed_source: Vec::new(),
    offset: 0,
    extra_children_styles: Vec::new(),
  };
  let mut ii = 0;
  while ii + 4 < declaration_positions.len() {
    let name_start = declaration_positions[ii];
    let name_end = declaration_positions[ii + 1];
    let value_start = declaration_positions[ii + 2];
    let value_end = declaration_positions[ii + 3];
    let is_important = declaration_positions[ii + 4] != 0;
    transformer.on_declaration(name_start, name_end, value_start, value_end, is_important);
    ii += 5;
  }
  if transformer.offset != 0 {
    // append the remaining part of the source
    transformer
      .transformed_source
      .extend_from_slice(&source[transformer.offset..]);
  }
  (
    transformer.transformed_source,
    transformer.extra_children_styles,
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn transform_basic() {
    let source = "height:1px;display:linear;flex-direction:row;width:100px;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "height:1px;--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;--flex-direction:row;width:100px;"
    );
  }

  #[test]
  fn transform_with_blank() {
    let source = "flex-direction : row ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-direction : row ;"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_blank_after_colon() {
    let source = "display: linear;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_important() {
    let source = "display: linear !important;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-display-toggle:var(--lynx-display-linear) !important;--lynx-display:linear !important;display:flex !important;"
    );
  }

  #[test]
  fn transform_color_normal() {
    let source = "color:blue;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue;"
    );
  }

  #[test]
  fn transform_color_normal_with_blank() {
    let source = " color : blue ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      " --lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color : blue ;"
    );
  }

  #[test]
  fn transform_color_normal_important() {
    let source = " color : blue !important ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      " --lynx-text-bg-color:initial !important;-webkit-background-clip:initial !important;background-clip:initial !important;color : blue !important ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient() {
    let source = " color : linear-gradient(pink, blue) ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      " color:transparent;-webkit-background-clip:text;background-clip:text;--lynx-text-bg-color : linear-gradient(pink, blue) ;"
    );
  }

  #[test]
  fn transform_color_linear_gradient_important() {
    let source = " color : linear-gradient(pink, blue) !important ;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      " color:transparent !important;-webkit-background-clip:text !important;background-clip:text !important;--lynx-text-bg-color : linear-gradient(pink, blue) !important ;"
    );
  }

  #[test]
  fn transform_color_with_font_size() {
    let source = "font-size: 24px; color: blue";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "font-size: 24px; --lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color: blue"
    );
  }

  #[test]
  fn flex_none() {
    let source = "flex:none;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-shrink:0;--flex-grow:0;--flex-basis:auto;"
    );
  }

  #[test]
  fn flex_auto() {
    let source = "flex:auto;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-shrink:1;--flex-grow:1;--flex-basis:auto;"
    );
  }

  #[test]
  fn flex_1() {
    let source = "flex:1;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-shrink:1;--flex-basis:0%;--flex-grow:1;"
    );
  }
  #[test]
  fn flex_1_percent() {
    let source = "flex:1%;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-shrink:1;--flex-grow:1;--flex-basis:1%;"
    );
  }

  #[test]
  fn flex_2_3() {
    let source = "flex:2 3;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-grow:2;--flex-basis:0%;--flex-shrink:3;"
    );
  }

  #[test]
  fn flex_2_3_percentage() {
    let source = "flex:2 3%;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-grow:2;--flex-shrink:1;--flex-basis:3%;"
    );
  }

  #[test]
  fn flex_2_3_px() {
    let source = "flex:2 3px;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-grow:2;--flex-shrink:1;--flex-basis:3px;"
    );
  }

  #[test]
  fn flex_3_4_5_percentage() {
    let source = "flex:3 4 5%;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-grow:3;--flex-shrink:4;--flex-basis:5%;"
    );
  }

  #[test]
  fn flex_1_extra() {
    let source = "width:100px; flex:none; width:100px;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "width:100px; --flex-shrink:0;--flex-grow:0;--flex-basis:auto; width:100px;"
    );
  }

  #[test]
  fn linear_weight_sum_0_children_style() {
    let source = "linear-weight-sum: 0;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).1;
    assert_eq!(String::from_utf16_lossy(&result), "--linear-weight-sum:1;");
  }

  #[test]
  fn linear_weight_sum_1_children_style() {
    let source = "linear-weight-sum: 1;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).1;
    assert_eq!(String::from_utf16_lossy(&result), "--linear-weight-sum:1;");
  }

  #[test]
  fn linear_weight_sum_1_important_children_style() {
    let source = "linear-weight-sum: 1 !important;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_inline_style_string(source).1;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--linear-weight-sum:1 !important;"
    );
  }

  #[test]
  fn transform_parsed_style_string_work() {
    let source = "flex:1;";
    let source_vec: Vec<u16> = source.bytes().map(|b| b as u16).collect();
    let source: &[u16] = &source_vec;
    let result = transform_parsed_style_string(source, &[0, 4, 5, 6, 0]).0;
    assert_eq!(
      String::from_utf16_lossy(&result),
      "--flex-shrink:1;--flex-basis:0%;--flex-grow:1;"
    );
  }
}
