/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::transformer::StyleTransformer;
use crate::style_transformer::transformer::Generator;
#[cfg(any(feature = "client", feature = "server"))]
use crate::utils::hyphenate_style_name::hyphenate_style_name;
struct InlineStyleGenerator {
  string_buffer: String,
}
impl Generator for InlineStyleGenerator {
  fn push_transform_kids_style(&mut self, _: String) {
    // do nothing
  }
  fn push_transformed_style(&mut self, value: String) {
    self.string_buffer.push_str(&value);
  }
}
pub(crate) fn transform_inline_style_string(source: &str) -> String {
  let mut generator = InlineStyleGenerator {
    string_buffer: String::with_capacity(source.len() + 16),
  };
  let transformer = &mut StyleTransformer::new(&mut generator);
  transformer.parse(source);
  generator.string_buffer
}

#[cfg(any(feature = "client", feature = "server"))]
pub(crate) fn transform_inline_style_key_value_vec(source: Vec<String>) -> String {
  let mut generator = InlineStyleGenerator {
    string_buffer: String::new(),
  };
  let transformer = &mut StyleTransformer::new(&mut generator);

  // the even value of source should be processed by hyphenate_style_name
  // iterate 2 values at a time
  let mut key: String = String::new();
  for (idx, value) in source.into_iter().enumerate() {
    if idx % 2 == 0 {
      key = value;
    } else {
      let name = hyphenate_style_name(&key);
      transformer.on_declaration_parsed(name.into(), value, false);
    }
  }

  generator.string_buffer
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn basic_one_simple_decl() {
    let source = "height:1px;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "height:1px;");
  }

  #[test]
  fn transform_basic() {
    let source = "height:1px;display:linear;flex-direction:row;width:100px;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "height:1px;--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;--flex-direction:row;width:100px;"
    );
  }

  #[test]
  fn transform_with_blank() {
    let source = "flex-direction:row;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex-direction:row;");
  }

  #[test]
  fn test_replace_rule_display_linear_blank_after_colon() {
    let source = "display: linear;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex;"
    );
  }

  #[test]
  fn test_replace_rule_linear_orientation() {
    let source = "linear-direction:row;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-linear-orientation:horizontal;--lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal);"
    );
  }

  #[test]
  fn test_replace_rule_display_linear_important() {
    let source = "display: linear !important;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear) !important;--lynx-display:linear !important;display:flex !important;"
    );
  }

  #[test]
  fn transform_color_normal() {
    let source = "color:blue;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue;"
    );
  }

  #[test]
  fn transform_color_normal_with_blank() {
    let source = " color : blue ;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue;"
    );
  }

  #[test]
  fn transform_color_normal_important() {
    let source = " color : blue !important ;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-text-bg-color:initial !important;-webkit-background-clip:initial !important;background-clip:initial !important;color:blue !important;"
    );
  }

  #[test]
  fn transform_color_linear_gradient() {
    let source = " color : linear-gradient(pink, blue) ;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "color:transparent;-webkit-background-clip:text;background-clip:text;--lynx-text-bg-color:linear-gradient(pink, blue);"
    );
  }

  #[test]
  fn transform_color_linear_gradient_important() {
    let source = " color : linear-gradient(pink, blue) !important ;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "color:transparent !important;-webkit-background-clip:text !important;background-clip:text !important;--lynx-text-bg-color:linear-gradient(pink, blue) !important;"
    );
  }

  #[test]
  fn transform_color_with_font_size() {
    let source = "font-size: 24px; color: blue";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "font-size:24px;--lynx-text-bg-color:initial;-webkit-background-clip:initial;background-clip:initial;color:blue;"
    );
  }

  #[test]
  fn flex_1() {
    let source = "flex:1;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex:1;");
  }
  #[test]
  fn flex_1_percent() {
    let source = "flex:1%;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex:1%;");
  }

  #[test]
  fn flex_2_3() {
    let source = "flex:2 3;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex:2 3;");
  }

  #[test]
  fn flex_2_3_percentage() {
    let source = "flex:2 3%;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex:2 3%;");
  }

  #[test]
  fn flex_2_3_px() {
    let source = "flex:2 3px;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex:2 3px;");
  }

  #[test]
  fn flex_3_4_5_percentage() {
    let source = "flex:3 4 5%;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--flex:3 4 5%;");
  }

  #[test]
  fn flex_1_extra() {
    let source = "width:100px; flex:none; width:100px;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "width:100px;--flex:none;width:100px;");
  }

  #[test]
  fn complex_1() {
    let source = "linear-direction:row;linear-weight: 0;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-linear-orientation:horizontal;--lynx-linear-orientation-toggle:var(--lynx-linear-orientation-horizontal);--lynx-linear-weight:0;"
    );
  }

  #[test]
  fn linear_weight_0() {
    let source = "linear-weight: 0;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--lynx-linear-weight:0;");
  }

  #[test]
  fn linear_weight_1() {
    let source = "linear-weight: 1;";
    let result = transform_inline_style_string(source);
    assert_eq!(
      result,
      "--lynx-linear-weight:1;--lynx-linear-weight-basis:0;"
    );
  }

  #[test]
  fn linear_layout_gravity() {
    let source = "linear-layout-gravity: right;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--align-self-row:auto;--align-self-column:end;");
  }

  #[test]
  fn linear_layout_gravity_start() {
    let source = "linear-layout-gravity: start;";
    let result = transform_inline_style_string(source);
    assert_eq!(result, "--align-self-row:start;--align-self-column:start;");
  }
}
