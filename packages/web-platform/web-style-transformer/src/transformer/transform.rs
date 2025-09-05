use inline_style_parser::parse_inline_style::Transformer;
use inline_style_parser::{char_code_definitions::is_white_space, parse_inline_style};

use crate::transformer::rules::{get_rename_rule_value, get_replace_rule_value};
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

/// Transform rpx units to calc() expressions using inline-style-parser
/// Examples:
/// - "1rpx" -> "calc(1 * var(--rpx))"
/// - "-1rpx" -> "calc(-1 * var(--rpx))"
/// - "5px 1rpx" -> "5px calc(1 * var(--rpx))"
/// - "1RPX" -> "calc(1 * var(--rpx))" (case insensitive)
/// - "url(image-1rpx.png)" -> "url(image-1rpx.png)" (unchanged)
/// - "'text with 1rpx'" -> "'text with 1rpx'" (unchanged)
pub fn transform_rpx_units(value: &str) -> Option<String> {
  // Check case-insensitive for rpx
  if !value
    .as_bytes()
    .windows(3)
    .any(|w| (w[0] | 0x20) == b'r' && (w[1] | 0x20) == b'p' && (w[2] | 0x20) == b'x')
  {
    return None;
  }

  let source = value.as_bytes();
  let mut transformer = RpxTransformer::new(value);
  inline_style_parser::tokenize::tokenize(source, &mut transformer);

  if transformer.has_changes() {
    Some(transformer.get_result())
  } else {
    None
  }
}

/// Transformer that processes CSS tokens and converts rpx dimensions to calc() expressions
struct RpxTransformer<'a> {
  source: &'a str,
  result: String,
  last_offset: usize,
  has_rpx_changes: bool,
}

impl<'a> RpxTransformer<'a> {
  fn new(source: &'a str) -> Self {
    Self {
      source,
      result: String::with_capacity(source.len() * 2),
      last_offset: 0,
      has_rpx_changes: false,
    }
  }

  fn has_changes(&self) -> bool {
    self.has_rpx_changes
  }

  fn get_result(mut self) -> String {
    // Append any remaining content
    if self.last_offset < self.source.len() {
      self.result.push_str(&self.source[self.last_offset..]);
    }
    self.result
  }

  fn append_before_token(&mut self, start: usize) {
    if self.last_offset < start {
      self.result.push_str(&self.source[self.last_offset..start]);
    }
  }
}

impl<'a> inline_style_parser::tokenize::Parser for RpxTransformer<'a> {
  fn on_token(&mut self, token_type: u8, start: usize, end: usize) {
    use inline_style_parser::types::*;

    if token_type == DIMENSION_TOKEN {
      let token_text = &self.source[start..end];

      // Check if this dimension has rpx unit (case insensitive)
      if token_text.len() >= 3 && token_text[token_text.len() - 3..].eq_ignore_ascii_case("rpx") {
        // Find where the number ends and unit begins
        let mut unit_start = end;
        for (i, &byte) in token_text.as_bytes().iter().enumerate().rev() {
          if byte.is_ascii_digit() || byte == b'.' || byte == b'-' || byte == b'+' {
            unit_start = start + i + 1;
            break;
          }
        }

        let number_part = &self.source[start..unit_start];
        let unit_part = &self.source[unit_start..end];

        // Check if unit part is rpx (case insensitive) and we have a valid number
        if unit_part.len() == 3 && unit_part.eq_ignore_ascii_case("rpx") && !number_part.is_empty()
        {
          // Append content before this token
          self.append_before_token(start);

          // Transform rpx to calc() expression
          self
            .result
            .push_str(&format!("calc({} * var(--rpx))", number_part));
          self.has_rpx_changes = true;
          self.last_offset = end;
          return;
        }
      }
    }

    // For all other tokens (including non-rpx dimensions), we don't need to do anything
    // The content will be copied in get_result() or when we encounter the next rpx token
  }
}

type CSSPair<'a> = (&'a str, &'a str);

pub fn query_transform_rules(
  name: &str,
  value: &str,
) -> (Vec<(String, String)>, Vec<(String, String)>) {
  // Transform rpx units first
  let transformed_value = transform_rpx_units(value);
  let final_value = if let Some(ref transformed) = transformed_value {
    transformed.as_str()
  } else {
    value
  };

  // Use the new function with original and transformed values
  let (result, result_children) = query_transform_rules_with_original(name, value, final_value);

  // Convert to owned strings
  let owned_result = result
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect();
  let owned_result_children = result_children
    .into_iter()
    .map(|(k, v)| (k.to_string(), v.to_string()))
    .collect();

  (owned_result, owned_result_children)
}

pub fn query_transform_rules_with_original<'a>(
  name: &'a str,
  original_value: &'a str,
  transformed_value: &'a str,
) -> (Vec<CSSPair<'a>>, Vec<CSSPair<'a>>) {
  let mut result: Vec<CSSPair<'a>> = Vec::new();
  let mut result_children: Vec<CSSPair<'a>> = Vec::new();

  // Check if we need rpx transformation first (case-insensitive or already transformed)
  let has_rpx =
    original_value.to_ascii_lowercase().contains("rpx") || transformed_value.contains("var(--rpx)");

  if let Some(renamed_value) = get_rename_rule_value(name) {
    result.push((renamed_value, transformed_value));
  } else if let Some(replaced) = get_replace_rule_value(name, original_value) {
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
    let is_linear_gradient = original_value.starts_with("linear-gradient");
    if is_linear_gradient {
      result.extend([
        ("color", "transparent"),
        ("-webkit-background-clip", "text"),
        ("background-clip", "text"),
        ("--lynx-text-bg-color", transformed_value),
      ]);
    } else {
      result.extend([
        ("--lynx-text-bg-color", "initial"),
        ("-webkit-background-clip", "initial"),
        ("background-clip", "initial"),
        ("color", transformed_value),
      ]);
    };
  }
  /* transform the flex 1 2 3 to
  --flex-shrink:1;
  --flex-grow:2;
  --flex-basis:3;
  */
  else if name == "flex" {
    // we will use the value as flex-basis, flex-grow, flex-shrink
    let mut current_offset = 0;
    let mut val_fields = [transformed_value.len(); 6]; // we will use 3 fields, but we will use 6 to avoid the need to check the length
    let mut ii = 0;
    let value_in_bytes = transformed_value.as_bytes();
    while current_offset < value_in_bytes.len() && ii < val_fields.len() {
      let code = value_in_bytes[current_offset];
      if (ii % 2 == 0 && !is_white_space(code)) || (ii % 2 == 1 && is_white_space(code)) {
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
        if &transformed_value[val_fields[0]..val_fields[1]] == "none" {
          /*
           * --flex-shrink:0;
           * --flex-grow:0;
           * --flex-basis:auto;
           */
          result.extend([
            ("--flex-shrink", "0"),
            ("--flex-grow", "0"),
            ("--flex-basis", "auto"),
          ]);
        } else if &transformed_value[val_fields[0]..val_fields[1]] == "auto" {
          /*
           * --flex-shrink:1;
           * --flex-grow:1;
           * --flex-basis:auto;
           */
          result.extend([
            ("--flex-shrink", "1"),
            ("--flex-grow", "1"),
            ("--flex-basis", "auto"),
          ]);
        } else {
          let is_flex_grow = is_digit_only(&transformed_value[val_fields[0]..val_fields[1]]);
          if is_flex_grow {
            // if we only have one pure number, we will use it as flex-grow
            // flex: <flex-grow> 1 0
            result.extend([
              (
                "--flex-grow",
                &transformed_value[val_fields[0]..val_fields[1]],
              ),
              ("--flex-shrink", "1"),
              ("--flex-basis", "0%"),
            ]);
          } else {
            // else it is
            // flex: 1 1 <flex-basis>
            result.extend([
              ("--flex-grow", "1"),
              ("--flex-shrink", "1"),
              (
                "--flex-basis",
                &transformed_value[val_fields[0]..val_fields[1]],
              ),
            ]);
          }
        }
      }
      2 => {
        // The first value must be a valid value for flex-grow.
        result.push((
          "--flex-grow",
          &transformed_value[val_fields[0]..val_fields[1]],
        ));
        let is_flex_shrink = is_digit_only(&transformed_value[val_fields[2]..val_fields[3]]);
        if is_flex_shrink {
          /*
          a valid value for flex-shrink: then, in all the browsers,
          the shorthand expands to flex: <flex-grow> <flex-shrink> 0%.
           */
          result.extend([
            (
              "--flex-shrink",
              &transformed_value[val_fields[2]..val_fields[3]],
            ),
            ("--flex-basis", "0%"),
          ]);
        } else {
          /*
          a valid value for flex-basis: then the shorthand expands to flex: <flex-grow> 1 <flex-basis>.
           */
          result.extend([
            ("--flex-shrink", "1"),
            (
              "--flex-basis",
              &transformed_value[val_fields[2]..val_fields[3]],
            ),
          ]);
        }
      }
      3 => {
        // flex: <flex-grow> <flex-shrink> <flex-basis>
        result.extend([
          (
            "--flex-grow",
            &transformed_value[val_fields[0]..val_fields[1]],
          ),
          (
            "--flex-shrink",
            &transformed_value[val_fields[2]..val_fields[3]],
          ),
          (
            "--flex-basis",
            &transformed_value[val_fields[4]..val_fields[5]],
          ),
        ]);
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
  if name == "linear-weight-sum" {
    result_children.push(("--lynx-linear-weight-sum", transformed_value));
  }
  /*
   * There is a special rule for linear-weight
   * linear-weight: 0; -->  do nothing
   * linear-weight: <value> --> --lynx-linear-weight: 0;
   */
  if name == "linear-weight" && transformed_value != "0" {
    result.push(("--lynx-linear-weight-basis", "0"));
  }

  // If no other rules matched but we have rpx, we still need to transform
  if result.is_empty() && has_rpx {
    result.push((name, transformed_value));
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
  parse_inline_style::parse_inline_style(bytes, &mut transformer);
  if transformer.offset != 0 {
    // append the remaining part of the source
    transformer
      .transformed_source
      .push_str(&source[transformer.offset..]);
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

  // RPX transformation tests
  #[test]
  fn transform_rpx_basic() {
    let source = "width: 1rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(1 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_negative() {
    let source = "width: -1rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(-1 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_decimal() {
    let source = "width: 1.5rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(1.5 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_mixed_values() {
    let source = "margin: 5px 1rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "margin:5px calc(1 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_multiple_values() {
    let source = "margin: 1rpx 2rpx 3rpx 4rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(
      result,
      "margin:calc(1 * var(--rpx)) calc(2 * var(--rpx)) calc(3 * var(--rpx)) calc(4 * var(--rpx));"
    );
  }

  #[test]
  fn transform_rpx_in_url_should_not_transform() {
    let source = "background-image: url(image-1rpx.png);";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "background-image:url(image-1rpx.png);");
  }

  #[test]
  fn transform_rpx_in_url_with_quotes() {
    let source = "background-image: url('image-1rpx.png');";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "background-image:url('image-1rpx.png');");
  }

  #[test]
  fn transform_rpx_in_string_should_not_transform() {
    let source = "content: 'text with 1rpx';";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "content:'text with 1rpx';");
  }

  #[test]
  fn transform_rpx_in_double_quotes_should_not_transform() {
    let source = "content: \"text with 1rpx\";";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "content:\"text with 1rpx\";");
  }

  #[test]
  fn transform_rpx_zero() {
    let source = "width: 0rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(0 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_large_number() {
    let source = "width: 750rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(750 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_with_important() {
    let source = "width: 1rpx !important;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(1 * var(--rpx)) !important;");
  }

  #[test]
  fn transform_rpx_with_rename_rule() {
    let source = "flex-basis: 100rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "--flex-basis:calc(100 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_with_color_gradient() {
    let source = "color: linear-gradient(to right, red 1rpx, blue);";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "color:transparent;-webkit-background-clip:text;background-clip:text;--lynx-text-bg-color:linear-gradient(to right, red calc(1 * var(--rpx)), blue);");
  }

  #[test]
  fn transform_rpx_complex_url() {
    let source = "background: url(data:image/svg+xml;base64,abc1rpxdef) 1rpx 2rpx;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "background:url(data:image/svg+xml;base64,abc1rpxdef) calc(1 * var(--rpx)) calc(2 * var(--rpx));");
  }

  #[test]
  fn transform_rpx_no_rpx() {
    let source = "width: 1px;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, ""); // Should remain unchanged
  }

  #[test]
  fn test_query_transform_rules_direct_rpx() {
    // Test direct call to query_transform_rules with rpx
    let (result, _) = query_transform_rules("width", "1rpx");
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, "width");
    assert_eq!(result[0].1, "calc(1 * var(--rpx))");
  }

  #[test]
  fn test_query_transform_rules_direct_rpx_with_rename() {
    // Test direct call to query_transform_rules with rpx and rename rule
    let (result, _) = query_transform_rules("flex-basis", "100rpx");
    assert_eq!(result.len(), 1);
    assert_eq!(result[0].0, "--flex-basis");
    assert_eq!(result[0].1, "calc(100 * var(--rpx))");
  }

  // Test the specific examples from the user requirements
  #[test]
  fn test_user_specific_examples() {
    // Test: width: -1rpx; -> width: calc(-1 * var(--rpx));
    let result = transform_rpx_units("-1rpx");
    assert_eq!(result, Some("calc(-1 * var(--rpx))".to_string()));

    // Test: margin: 5px 1rpx; -> margin: 5px calc(1 * var(--rpx));
    let result = transform_rpx_units("5px 1rpx");
    assert_eq!(result, Some("5px calc(1 * var(--rpx))".to_string()));

    // Test: 1rpx -> calc(1 * var(--rpx))
    let result = transform_rpx_units("1rpx");
    assert_eq!(result, Some("calc(1 * var(--rpx))".to_string()));
  }

  // Test case insensitive rpx units
  #[test]
  fn test_rpx_case_insensitive() {
    // Test uppercase RPX
    let result = transform_rpx_units("1RPX");
    assert_eq!(result, Some("calc(1 * var(--rpx))".to_string()));

    // Test mixed case Rpx
    let result = transform_rpx_units("2Rpx");
    assert_eq!(result, Some("calc(2 * var(--rpx))".to_string()));

    // Test mixed case rPx
    let result = transform_rpx_units("3rPx");
    assert_eq!(result, Some("calc(3 * var(--rpx))".to_string()));

    // Test mixed case rpX
    let result = transform_rpx_units("4rpX");
    assert_eq!(result, Some("calc(4 * var(--rpx))".to_string()));

    // Test with negative value
    let result = transform_rpx_units("-1RPX");
    assert_eq!(result, Some("calc(-1 * var(--rpx))".to_string()));

    // Test with decimal value
    let result = transform_rpx_units("1.5RpX");
    assert_eq!(result, Some("calc(1.5 * var(--rpx))".to_string()));

    // Test mixed case in complex value (CSS value only, not full declaration)
    let result = transform_rpx_units("5px 1RPX");
    assert_eq!(result, Some("5px calc(1 * var(--rpx))".to_string()));

    // Test multiple mixed case values (CSS value only)
    let result = transform_rpx_units("1RPX 2rpx 3Rpx 4rpX");
    assert_eq!(
      result,
      Some(
        "calc(1 * var(--rpx)) calc(2 * var(--rpx)) calc(3 * var(--rpx)) calc(4 * var(--rpx))"
          .to_string()
      )
    );
  }

  // Test case insensitive rpx units should NOT be transformed in certain contexts
  #[test]
  fn test_rpx_case_insensitive_not_transformed() {
    // Test URL with uppercase RPX - should not be transformed
    let result = transform_rpx_units("url(image-1RPX.png)");
    assert_eq!(result, None);

    // Test URL with mixed case rpx - should not be transformed
    let result = transform_rpx_units("url(background-2Rpx.jpg)");
    assert_eq!(result, None);

    // Test URL with quoted path containing RPX - should not be transformed
    let result = transform_rpx_units("url('assets/icon-3rPx.svg')");
    assert_eq!(result, None);

    // Test URL with double quoted path containing rpX - should not be transformed
    let result = transform_rpx_units("url(\"images/logo-4rpX.webp\")");
    assert_eq!(result, None);

    // Test single quoted string with RPX - should not be transformed
    let result = transform_rpx_units("'text with 1RPX unit'");
    assert_eq!(result, None);

    // Test double quoted string with mixed case rpx - should not be transformed
    let result = transform_rpx_units("\"content has 2Rpx value\"");
    assert_eq!(result, None);

    // Test complex URL with data URI containing RPX - should not be transformed
    let result = transform_rpx_units("url(data:image/svg+xml;base64,abc1RPXdef)");
    assert_eq!(result, None);

    // Test URL with mixed case and complex path - should not be transformed
    let result = transform_rpx_units("url(../assets/images/sprite-10RpX-icon.png)");
    assert_eq!(result, None);

    // Test string with escaped quotes containing rpx - should not be transformed
    let result = transform_rpx_units("'escaped \\'quote\\' with 5rPx'");
    assert_eq!(result, None);

    // Test complex case: URL followed by valid RPX dimension - only RPX should be transformed
    let result = transform_rpx_units("url(bg-1RPX.png) 2RPX");
    assert_eq!(
      result,
      Some("url(bg-1RPX.png) calc(2 * var(--rpx))".to_string())
    );

    // Test complex case: string followed by valid rpx - only rpx should be transformed
    let result = transform_rpx_units("'text-1Rpx' 3rPx");
    assert_eq!(result, Some("'text-1Rpx' calc(3 * var(--rpx))".to_string()));
  }

  // Test edge cases with case insensitive rpx
  #[test]
  fn test_rpx_case_insensitive_edge_cases() {
    // Test zero value with different cases
    let result = transform_rpx_units("0RPX");
    assert_eq!(result, Some("calc(0 * var(--rpx))".to_string()));

    let result = transform_rpx_units("0Rpx");
    assert_eq!(result, Some("calc(0 * var(--rpx))".to_string()));

    // Test large numbers with different cases
    let result = transform_rpx_units("750RPX");
    assert_eq!(result, Some("calc(750 * var(--rpx))".to_string()));

    let result = transform_rpx_units("999rPX");
    assert_eq!(result, Some("calc(999 * var(--rpx))".to_string()));

    // Test scientific notation (if supported) with different cases
    let result = transform_rpx_units("1e2RPX");
    assert_eq!(result, Some("calc(1e2 * var(--rpx))".to_string()));

    // Test with plus sign
    let result = transform_rpx_units("+5RpX");
    assert_eq!(result, Some("calc(+5 * var(--rpx))".to_string()));

    // Test mixed with other units - only RPX should be transformed
    let result = transform_rpx_units("1px 2RPX 3em 4Rpx 5%");
    assert_eq!(
      result,
      Some("1px calc(2 * var(--rpx)) 3em calc(4 * var(--rpx)) 5%".to_string())
    );

    // Test that partial matches don't get transformed
    let result = transform_rpx_units("1rpxs"); // not a valid dimension
    assert_eq!(result, None);

    let result = transform_rpx_units("xrpx"); // not a valid dimension
    assert_eq!(result, None);

    // Test case where rpx is part of a larger identifier (should not transform)
    let result = transform_rpx_units("background-1RPX-image");
    assert_eq!(result, None);
  }

  // Integration test for uppercase RPX in full transform flow
  #[test]
  fn transform_rpx_uppercase_integration() {
    let source = "width: 100RPX;";
    let result = transform_inline_style_string(source).0;
    assert_eq!(result, "width:calc(100 * var(--rpx));");
  }
}
