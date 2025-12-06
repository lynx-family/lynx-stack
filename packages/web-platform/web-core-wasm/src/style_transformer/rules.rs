/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

#![allow(clippy::type_complexity)]
use fnv::FnvHashMap;

use crate::css_tokenizer::char_code_definitions::is_white_space;

lazy_static::lazy_static! {
  pub static ref RENAME_RULE: FnvHashMap<&'static str, &'static str> = {
    FnvHashMap::from_iter([
      ("linear-weight", "--lynx-linear-weight"),
      ("flex-direction", "--flex-direction"),
      ("flex-wrap", "--flex-wrap"),
      ("flex-grow", "--flex-grow"),
      ("flex-shrink", "--flex-shrink"),
      ("flex-basis", "--flex-basis"),
      ("list-main-axis-gap", "--list-main-axis-gap"),
      ("list-cross-axis-gap", "--list-cross-axis-gap"),
    ])
  };

  pub static ref REPLACE_RULE: FnvHashMap<&'static str, FnvHashMap<&'static str, &'static [(&'static str, &'static str)]>> = {
    FnvHashMap::from_iter([
      (
        "display",
          FnvHashMap::from_iter([
            ("linear", &[
              ("--lynx-display-toggle", "var(--lynx-display-linear)"),
              ("--lynx-display", "linear"),
              ("display", "flex"),
            ] as &'static [(&'static str, &'static str)]),
            ("flex", &[
              ("--lynx-display-toggle", "var(--lynx-display-flex)"),
              ("--lynx-display", "flex"),
              ("display", "flex"),
            ]),
          ]),
      ),
      (
        "direction",
          FnvHashMap::from_iter([
            ("lynx-rtl", &[("direction", "rtl")] as &'static [(&'static str, &'static str)]),
          ]),
      ),
      (
        "linear-orientation",
          FnvHashMap::from_iter([
            ("horizontal", &[("--lynx-linear-orientation", "horizontal"),("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal)")] as &'static [(&'static str, &'static str)]),
            ("horizontal-reverse", &[("--lynx-linear-orientation", "horizontal-reverse"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal-reverse)")]),
            ("vertical", &[("--lynx-linear-orientation", "vertical"),("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical)")]),
            ("vertical-reverse", &[("--lynx-linear-orientation", "vertical-reverse"),("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical-reverse)")]),
          ]),
      ),
      (
        "linear-direction",
          FnvHashMap::from_iter([
            ("row", &[("--lynx-linear-orientation", "horizontal"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal)")] as &'static [(&'static str, &'static str)]),
            ("row-reverse", &[("--lynx-linear-orientation", "horizontal-reverse"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal-reverse)")]),
            ("column", &[("--lynx-linear-orientation", "vertical"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical)")]),
            ("column-reverse", &[("--lynx-linear-orientation", "vertical-reverse"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical-reverse)")]),
          ]),
      ),
      (
        "linear-gravity",
          FnvHashMap::from_iter([
            ("top", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-end"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ] as &'static [(&'static str, &'static str)]),
            ("bottom", &[
              ("--justify-content-column", "flex-end"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("left", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-end"),
            ]),
            ("right", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-end"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("center-vertical", &[
              ("--justify-content-column", "center"),
              ("--justify-content-column-reverse", "center"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("center-horizontal", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "center"),
              ("--justify-content-row-reverse", "center"),
            ]),
            ("start", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("end", &[
              ("--justify-content-column", "flex-end"),
              ("--justify-content-column-reverse", "flex-end"),
              ("--justify-content-row", "flex-end"),
              ("--justify-content-row-reverse", "flex-end"),
            ]),
            ("center", &[
              ("--justify-content-column", "center"),
              ("--justify-content-column-reverse", "center"),
              ("--justify-content-row", "center"),
              ("--justify-content-row-reverse", "center"),
            ]),
            ("space-between", &[
              ("--justify-content-column", "space-between"),
              ("--justify-content-column-reverse", "space-between"),
              ("--justify-content-row", "space-between"),
              ("--justify-content-row-reverse", "space-between"),
            ]),
          ]),
      ),
      (
        "linear-cross-gravity",
          FnvHashMap::from_iter([
            ("start", &[
              ("align-items", "start"),
            ] as &'static [(&'static str, &'static str)]),
            ("end", &[
              ("align-items", "end"),
            ]),
            ("center", &[
              ("align-items", "center"),
            ]),
            ("stretch", &[
              ("align-items", "stretch"),
            ]),
          ]),
      ),
      (
        "linear-layout-gravity",
          FnvHashMap::from_iter([
            ("none", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "auto"),
            ] as &'static [(&'static str, &'static str)]),
            ("stretch", &[
              ("--align-self-row", "stretch"),
              ("--align-self-column", "stretch"),
            ]),
            ("top", &[
              ("--align-self-row", "start"),
              ("--align-self-column", "auto"),
            ]),
            ("bottom", &[
              ("--align-self-row", "end"),
              ("--align-self-column", "auto"),
            ]),
            ("left", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "start"),
            ]),
            ("right", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "end"),
            ]),
            ("start", &[
              ("--align-self-row", "start"),
              ("--align-self-column", "start"),
            ]),
            ("end", &[
              ("--align-self-row", "end"),
              ("--align-self-column", "end"),
            ]),
            ("center", &[
              ("--align-self-row", "center"),
              ("--align-self-column", "center"),
            ]),
            ("center-vertical", &[
              ("--align-self-row", "center"),
              ("--align-self-column", "start"),
            ]),
            ("center-horizontal", &[
              ("--align-self-row", "start"),
              ("--align-self-column", "center"),
            ]),
            ("fill-vertical", &[
              ("--align-self-row", "stretch"),
              ("--align-self-column", "auto"),
            ]),
            ("fill-horizontal", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "stretch"),
            ]),
          ])
        ),
        (
          "justify-content",
            FnvHashMap::from_iter([
            ("start", &[
              ("justify-content", "flex-start"),
            ] as &'static [(&'static str, &'static str)]),
            ("end", &[
              ("justify-content", "flex-end"),
            ]),
            ("left", &[
              ("justify-content", "--lynx-invalid-invalid-invalid"),
            ]),
            ("right", &[
              ("justify-content", "--lynx-invalid-invalid-invalid"),
            ])
          ])
        )
      ]
    )
  };
}

#[inline(always)]
pub fn get_rename_rule_value(name: &str) -> Option<&'static str> {
  RENAME_RULE.get(name).copied()
}

#[inline(always)]
pub fn get_replace_rule_value(
  name: &str,
  value: &str,
) -> Option<&'static [(&'static str, &'static str)]> {
  if let Some(sub_rule) = REPLACE_RULE.get(name) {
    sub_rule.get(value).copied()
  } else {
    None
  }
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

pub(crate) fn query_transform_rules<'a>(
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
  /* transform the flex 1 2 3 to
  --flex-shrink:1;
  --flex-grow:2;
  --flex-basis:3;
  */
  else if name == "flex" {
    // we will use the value as flex-basis, flex-grow, flex-shrink
    let mut current_offset = 0;
    let mut val_fields = [value.len(); 6]; // we will use 3 fields, but we will use 6 to avoid the need to check the length
    let mut ii = 0;
    let value_in_bytes = value.as_bytes();
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
        if &value[val_fields[0]..val_fields[1]] == "none" {
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
        } else if &value[val_fields[0]..val_fields[1]] == "auto" {
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
          let is_flex_grow = is_digit_only(value);
          if is_flex_grow {
            // if we only have one pure number, we will use it as flex-grow
            // flex: <flex-grow> 1 0
            result.extend([
              ("--flex-grow", &value[val_fields[0]..val_fields[1]]),
              ("--flex-shrink", "1"),
              ("--flex-basis", "0%"),
            ]);
          } else {
            // else it is
            // flex: 1 1 <flex-basis>
            result.extend([
              ("--flex-grow", "1"),
              ("--flex-shrink", "1"),
              ("--flex-basis", &value[val_fields[0]..val_fields[1]]),
            ]);
          }
        }
      }
      2 => {
        // The first value must be a valid value for flex-grow.
        result.push(("--flex-grow", &value[val_fields[0]..val_fields[1]]));
        let is_flex_shrink = is_digit_only(&value[val_fields[2]..val_fields[3]]);
        if is_flex_shrink {
          /*
          a valid value for flex-shrink: then, in all the browsers,
          the shorthand expands to flex: <flex-grow> <flex-shrink> 0%.
           */
          result.extend([
            ("--flex-shrink", &value[val_fields[2]..val_fields[3]]),
            ("--flex-basis", "0%"),
          ]);
        } else {
          /*
          a valid value for flex-basis: then the shorthand expands to flex: <flex-grow> 1 <flex-basis>.
           */
          result.extend([
            ("--flex-shrink", "1"),
            ("--flex-basis", &value[val_fields[2]..val_fields[3]]),
          ]);
        }
      }
      3 => {
        // flex: <flex-grow> <flex-shrink> <flex-basis>
        result.extend([
          ("--flex-grow", &value[val_fields[0]..val_fields[1]]),
          ("--flex-shrink", &value[val_fields[2]..val_fields[3]]),
          ("--flex-basis", &value[val_fields[4]..val_fields[5]]),
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
#[cfg(test)]
mod tests {
  use super::{get_rename_rule_value, get_replace_rule_value, query_transform_rules};

  #[test]
  fn test_rename_rule_flex_direction() {
    let source = "flex-direction:row";
    let name = &source[0..source.len() - 4];
    let result = get_rename_rule_value(name).unwrap();
    assert_eq!(result, "--flex-direction");
  }
  #[test]
  fn test_rename_rule_flex_direction_at_mid() {
    let source = "height:1px;flex-direction:row";
    let offset = "height:1px;".len();
    let name = &source[offset..source.len() - 4];
    let result = get_rename_rule_value(name).unwrap();
    assert_eq!(result, "--flex-direction");
  }
  #[test]
  fn test_replace_rule_display_linear() {
    let source = "display:linear";
    let name = &source[0..7];
    let value = &source[8..];
    let result = get_replace_rule_value(name, value)
      .unwrap()
      .iter()
      .map(|pair| format!("{}:{}", pair.0, pair.1))
      .collect::<Vec<_>>()
      .join(";");
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex"
    );
  }
  #[test]
  fn test_replace_rule_display_linear_at_mid() {
    let source = "height:1px;display:linear";
    let offset = "height:1px;".len();
    let name = &source[offset..offset + 7];
    let value = &source[offset + 8..];
    let result = get_replace_rule_value(name, value)
      .unwrap()
      .iter()
      .map(|pair| format!("{}:{}", pair.0, pair.1))
      .collect::<Vec<_>>()
      .join(";");
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex"
    );
  }

  #[test]
  fn test_rename_rule_not_exist() {
    let source = "background-image:url(\"https://example.com\")";
    let name = &source[0.."background-image".len()];
    let result = get_rename_rule_value(name);
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_value_not_match() {
    let source = "display:grid";
    let name = &source[0..7];
    let value = &source[8..];
    let result = get_replace_rule_value(name, value);
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_name_not_match() {
    let source = "height:1px";
    let name = &source[0..6];
    let value = &source[7..];
    let result = get_replace_rule_value(name, value);
    assert_eq!(result, None);
  }

  #[test]
  fn test_query_transform_rules_rename() {
    let (res, children) = query_transform_rules("flex-direction", "row");
    assert_eq!(res, vec![("--flex-direction", "row")]);
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_replace() {
    let (res, children) = query_transform_rules("display", "linear");
    assert_eq!(
      res,
      vec![
        ("--lynx-display-toggle", "var(--lynx-display-linear)"),
        ("--lynx-display", "linear"),
        ("display", "flex")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_color_linear_gradient() {
    let (res, children) = query_transform_rules("color", "linear-gradient(red, blue)");
    assert_eq!(
      res,
      vec![
        ("color", "transparent"),
        ("-webkit-background-clip", "text"),
        ("background-clip", "text"),
        ("--lynx-text-bg-color", "linear-gradient(red, blue)")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_color_normal() {
    let (res, children) = query_transform_rules("color", "red");
    assert_eq!(
      res,
      vec![
        ("--lynx-text-bg-color", "initial"),
        ("-webkit-background-clip", "initial"),
        ("background-clip", "initial"),
        ("color", "red")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_none() {
    let (res, children) = query_transform_rules("flex", "none");
    assert_eq!(
      res,
      vec![
        ("--flex-shrink", "0"),
        ("--flex-grow", "0"),
        ("--flex-basis", "auto")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_auto() {
    let (res, children) = query_transform_rules("flex", "auto");
    assert_eq!(
      res,
      vec![
        ("--flex-shrink", "1"),
        ("--flex-grow", "1"),
        ("--flex-basis", "auto")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_one_number() {
    let (res, children) = query_transform_rules("flex", "1");
    assert_eq!(
      res,
      vec![
        ("--flex-grow", "1"),
        ("--flex-shrink", "1"),
        ("--flex-basis", "0%")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_one_length() {
    let (res, children) = query_transform_rules("flex", "10px");
    assert_eq!(
      res,
      vec![
        ("--flex-grow", "1"),
        ("--flex-shrink", "1"),
        ("--flex-basis", "10px")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_two_values_number_number() {
    let (res, children) = query_transform_rules("flex", "1 2");
    assert_eq!(
      res,
      vec![
        ("--flex-grow", "1"),
        ("--flex-shrink", "2"),
        ("--flex-basis", "0%")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_two_values_number_length() {
    let (res, children) = query_transform_rules("flex", "1 10px");
    assert_eq!(
      res,
      vec![
        ("--flex-grow", "1"),
        ("--flex-shrink", "1"),
        ("--flex-basis", "10px")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_flex_three_values() {
    let (res, children) = query_transform_rules("flex", "1 2 10px");
    assert_eq!(
      res,
      vec![
        ("--flex-grow", "1"),
        ("--flex-shrink", "2"),
        ("--flex-basis", "10px")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_linear_weight_sum() {
    let (res, children) = query_transform_rules("linear-weight-sum", "1");
    assert!(res.is_empty());
    assert_eq!(children, vec![("--lynx-linear-weight-sum", "1")]);
  }

  #[test]
  fn test_query_transform_rules_linear_weight() {
    let (res, children) = query_transform_rules("linear-weight", "1");
    assert_eq!(
      res,
      vec![
        ("--lynx-linear-weight", "1"),
        ("--lynx-linear-weight-basis", "0")
      ]
    );
    assert!(children.is_empty());
  }

  #[test]
  fn test_query_transform_rules_linear_weight_zero() {
    let (res, children) = query_transform_rules("linear-weight", "0");
    assert_eq!(res, vec![("--lynx-linear-weight", "0")]);
    assert!(children.is_empty());
  }
  #[test]
  fn test_query_transform_rules_linear_direction() {
    let name = "linear-direction";
    let value = "row";
    let (result, _) = query_transform_rules(name, value);
    assert_eq!(result[0].0, "--lynx-linear-orientation");
    assert_eq!(result[0].1, "horizontal");
  }
}
