/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
*/

use super::flattened_style_info::FlattenedStyleInfo;
use super::raw_style_info::RuleType;
use crate::css_tokenizer::tokenize::Parser;
use crate::style_transformer::{Generator, ParsedDeclaration, StyleTransformer};
use crate::template::template_sections::style_info::raw_style_info::{
  DeclarationBlock, OneSimpleSelector, OneSimpleSelectorType,
};
use crate::template::template_sections::style_info::RawStyleInfo;
use fnv::FnvHashMap;
#[cfg(feature = "encode")]
use wasm_bindgen::prelude::*;

#[cfg_attr(feature = "encode", wasm_bindgen)] // for testing purpose
pub(crate) struct StyleInfoDecoder {
  pub(super) style_content: String,
  // the font face should be placed at the head of the css content, therefore we use a separate buffer
  pub(super) font_face_content: String,
  // if we are processing font_face, the declaration should be pushed to font_face_content for generating
  pub(super) css_og_css_id_to_class_selector_name_to_declarations_map:
    Option<super::CssOgCssIdToClassSelectorNameToDeclarationsMap>,
  is_processing_font_face: bool,
  temp_child_rules_buffer: String,
  config_enable_css_selector: bool,
  entry_name: Option<String>,
  css_og_current_processing_css_id: Option<i32>,
  css_og_current_processing_class_selector_names: Option<Vec<String>>,
}

impl StyleInfoDecoder {
  pub(crate) fn new(
    raw_style_info: RawStyleInfo,
    entry_name: Option<String>,
    config_enable_css_selector: bool,
  ) -> Result<Self, JsError> {
    let flattened_style_info: FlattenedStyleInfo = raw_style_info.into();
    let mut decoded_style_info = StyleInfoDecoder {
      style_content: String::with_capacity(flattened_style_info.style_content_str_size_hint + 64),
      font_face_content: String::with_capacity(256),
      temp_child_rules_buffer: String::new(),
      css_og_css_id_to_class_selector_name_to_declarations_map: if !config_enable_css_selector {
        Some(FnvHashMap::default())
      } else {
        None
      },
      entry_name,
      config_enable_css_selector,
      is_processing_font_face: false,
      css_og_current_processing_css_id: None,
      css_og_current_processing_class_selector_names: None,
    };
    decoded_style_info.decode(flattened_style_info)?;
    Ok(decoded_style_info)
  }

  fn decode(&mut self, flattened_style_info: FlattenedStyleInfo) -> Result<(), JsError> {
    for (css_id, style_sheet) in flattened_style_info.css_id_to_style_sheet.into_iter() {
      for mut style_rule in style_sheet.rules.into_iter() {
        match style_rule.rule_type {
          RuleType::Declaration => {
            if !self.config_enable_css_selector {
              self.css_og_current_processing_css_id = Some(css_id);
              self.css_og_current_processing_class_selector_names = Some(Vec::new());
            }
            let mut new_selectors_to_add = Vec::new(); // selectors will be added for removeCSSScope false
                                                       // handle selectors
            for (selector_index, selector) in
              style_rule.prelude.selector_list.iter_mut().enumerate()
            {
              /*
               1. for :root selector section, we should transform it to [lynx-tag="page"] and move it to the start of the current compound selector
               2. for ::placeholder selector section, we should transform it to ::part(placeholder)::placeholder
               3. for type selector section, we should transform it to [lynx-tag="type"]
               4 if enableCSSSelector is false:
                 4.1 if the current selector has only one class selector, we extract the class selector name and use it to map to the declarations in css_og_css_id_to_class_selector_name_to_declarations_map
                     the declarations should be transformed by calling transform_one_declaration function.
                     the current selector should be skipped in following phases.
               5 if the self.entryName is Some, we should add a [{constants::LYNX_CSS_ENTRY_NAME_ATTRIBUTE}="{entry_name}"] to the last compound selector just before the first pseudo class or pseudo element
                   otherwise, we should add a :not({constants::LYNX_CSS_ENTRY_NAME_ATTRIBUTE}) just before the first pseudo class or pseudo element in the current compound selector
               6 if imported_by_css_id != 0, we should add a :where([{constants::LYNX_CSS_ID_ATTRIBUTE}="{imported_by_css_id}"]) to the last compound selector just before the first pseudo class or pseudo element
              */
              // process rule 4
              if !self.config_enable_css_selector
                && selector.simple_selectors.len() == 1
                && selector.simple_selectors[0].selector_type
                  == OneSimpleSelectorType::ClassSelector
              {
                if let Some(names) = self.css_og_current_processing_class_selector_names.as_mut() {
                  names.push(selector.simple_selectors[0].value.clone());
                }
                continue;
              }
              let mut the_index_of_last_compound_selector = 0;
              let mut simple_selector_index = 0;
              while simple_selector_index < selector.simple_selectors.len() {
                let simple_selector = &mut selector.simple_selectors[simple_selector_index];
                if simple_selector.selector_type == OneSimpleSelectorType::PseudoClassSelector
                  && simple_selector.value == "root"
                {
                  // transform :root to [part="page"]
                  simple_selector.selector_type = OneSimpleSelectorType::AttributeSelector;
                  simple_selector.value = "part=\"page\"".to_string();
                  // find the position to insert
                  let mut compound_selector_start_index = simple_selector_index;
                  while compound_selector_start_index > 0 {
                    let prev_simple_selector =
                      &selector.simple_selectors[compound_selector_start_index - 1];
                    if prev_simple_selector.selector_type == OneSimpleSelectorType::Combinator {
                      break;
                    }
                    compound_selector_start_index -= 1;
                  }
                  // move the current simple selector to the compound selector start index
                  let root_simple_selector =
                    selector.simple_selectors.remove(simple_selector_index);
                  selector
                    .simple_selectors
                    .insert(compound_selector_start_index, root_simple_selector);
                } else if simple_selector.selector_type
                  == OneSimpleSelectorType::PseudoElementSelector
                  && simple_selector.value == "placeholder"
                {
                  // transform ::placeholder to ::part(placeholder)::placeholder
                  selector.simple_selectors.insert(
                    simple_selector_index,
                    OneSimpleSelector {
                      selector_type: OneSimpleSelectorType::PseudoElementSelector,
                      value: "part(placeholder)".to_string(),
                    },
                  );
                  simple_selector_index += 1; // skip the newly inserted simple selector
                } else if simple_selector.selector_type == OneSimpleSelectorType::TypeSelector {
                  // transform type selector
                  let simple_selector = &mut selector.simple_selectors[simple_selector_index];
                  if let Some(mapped_tag) =
                    crate::constants::LYNX_TAG_TO_HTML_TAG_MAP.get(simple_selector.value.as_str())
                  {
                    simple_selector.value = mapped_tag.to_string();
                  }
                }
                if matches!(
                  selector.simple_selectors[simple_selector_index].selector_type,
                  OneSimpleSelectorType::ClassSelector
                    | OneSimpleSelectorType::IdSelector
                    | OneSimpleSelectorType::AttributeSelector
                    | OneSimpleSelectorType::TypeSelector
                    | OneSimpleSelectorType::UniversalSelector
                    | OneSimpleSelectorType::PseudoClassSelector
                ) {
                  the_index_of_last_compound_selector = simple_selector_index + 1;
                }
                simple_selector_index += 1;
              }
              // rule 5
              if let Some(entry_name) = &self.entry_name {
                selector.simple_selectors.insert(
                  the_index_of_last_compound_selector,
                  OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::AttributeSelector,
                    value: format!(
                      "{}=\"{}\"",
                      crate::constants::LYNX_ENTRY_NAME_ATTRIBUTE,
                      entry_name
                    ),
                  },
                );
              } else {
                selector.simple_selectors.insert(
                  the_index_of_last_compound_selector,
                  OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::PseudoClassSelector,
                    value: format!("not([{}])", crate::constants::LYNX_ENTRY_NAME_ATTRIBUTE),
                  },
                );
              }

              // for rule 6, we should copy selectors and add the css id attribute selector
              for (imported_by_index, imported_by_css_id) in
                style_sheet.imported_by.iter().enumerate()
              {
                // add a comma separator if not the last selector
                if selector_index != 0 || imported_by_index != 0 {
                  self.style_content.push(',');
                }

                if *imported_by_css_id == 0 {
                  selector.generate_to_string_buf(&mut self.style_content);
                } else {
                  let mut new_selector = selector.clone();
                  // for the first imported_by_css_id, we can reuse the current selector
                  new_selector.simple_selectors.insert(
                    the_index_of_last_compound_selector,
                    OneSimpleSelector {
                      selector_type: OneSimpleSelectorType::PseudoClassSelector,
                      value: format!(
                        "where([{}=\"{}\"])",
                        crate::constants::CSS_ID_ATTRIBUTE,
                        imported_by_css_id
                      ),
                    },
                  );
                  new_selector.generate_to_string_buf(&mut self.style_content);
                  new_selectors_to_add.push(new_selector);
                };
              }
            }
            style_rule
              .prelude
              .selector_list
              .extend(new_selectors_to_add);
            self.temp_child_rules_buffer.clear();
            self.generate_one_declaration_block(style_rule.declaration_block);
            if !self.temp_child_rules_buffer.is_empty() {
              // regenerate the child rules by adding > * for all selectors
              for (selector_index, selector) in style_rule.prelude.selector_list.iter().enumerate()
              {
                selector.generate_to_string_buf(&mut self.style_content);
                self.style_content.push_str(" > *");
                // add a comma separator if not the last selector
                if selector_index < style_rule.prelude.selector_list.len() - 1 {
                  self.style_content.push(',');
                }
              }
              self.style_content.push('{');
              self.style_content.push_str(&self.temp_child_rules_buffer);
              self.style_content.push('}');
            }
          }
          RuleType::FontFace => {
            self.font_face_content.push_str("@font-face");
            self.is_processing_font_face = true;
            self.generate_one_declaration_block(style_rule.declaration_block);
            self.is_processing_font_face = false;
          }
          RuleType::KeyFrames => {
            self.style_content.push_str("@keyframes ");
            assert!(
              style_rule.prelude.selector_list.len() == 1,
              "KeyFrames rule should have only one selector"
            );
            let keyframes_name = &style_rule.prelude.selector_list[0];
            keyframes_name.generate_to_string_buf(&mut self.style_content);
            self.style_content.push('{');
            for nested_rule in style_rule.nested_rules.into_iter() {
              for (selector_index, selector) in nested_rule.prelude.selector_list.iter().enumerate()
              {
                // add a comma separator if not the last selector
                if selector_index > 0 {
                  self.style_content.push(',');
                }
                selector.generate_to_string_buf(&mut self.style_content);
              }
              if nested_rule.rule_type == RuleType::Declaration {
                self.generate_one_declaration_block(nested_rule.declaration_block);
              }
            }

            self.style_content.push('}');
          }
        }
      }
    }
    Ok(())
  }
  fn generate_one_declaration_block(&mut self, declaration_block: DeclarationBlock) {
    (if self.is_processing_font_face {
      &mut self.font_face_content
    } else {
      &mut self.style_content
    })
    .push('{');
    let mut transformer = StyleTransformer::new(self);

    for token in declaration_block.tokens.into_iter() {
      transformer.on_token(token.token_type, token.value.as_str());
    }
    (if self.is_processing_font_face {
      &mut self.font_face_content
    } else {
      &mut self.style_content
    })
    .push('}');
  }
}

impl Generator for StyleInfoDecoder {
  fn push_transform_kids_style(&mut self, declaration: ParsedDeclaration) {
    declaration.generate_to_string_buf(&mut self.temp_child_rules_buffer);
    if !self.config_enable_css_selector {
      if let (Some(map), Some(css_id), Some(names)) = (
        self
          .css_og_css_id_to_class_selector_name_to_declarations_map
          .as_mut(),
        self.css_og_current_processing_css_id,
        self.css_og_current_processing_class_selector_names.as_ref(),
      ) {
        let class_selector_map = map.entry(css_id).or_default();
        for class_selector_name in names.iter() {
          let string_buf = class_selector_map
            .entry(class_selector_name.clone())
            .or_default();
          declaration.generate_to_string_buf(string_buf);
        }
      }
    }
  }
  fn push_transformed_style(&mut self, declaration: ParsedDeclaration) {
    if !self.config_enable_css_selector && !self.is_processing_font_face {
      if let (Some(map), Some(css_id), Some(names)) = (
        self
          .css_og_css_id_to_class_selector_name_to_declarations_map
          .as_mut(),
        self.css_og_current_processing_css_id,
        self.css_og_current_processing_class_selector_names.as_ref(),
      ) {
        let class_selector_map = map.entry(css_id).or_default();
        for class_selector_name in names.iter() {
          let string_buf = class_selector_map
            .entry(class_selector_name.clone())
            .or_default();
          declaration.generate_to_string_buf(string_buf);
        }
      }
    }
    declaration.generate_to_string_buf(if self.is_processing_font_face {
      &mut self.font_face_content
    } else {
      &mut self.style_content
    });
  }
}

#[cfg(test)]
mod test {
  use fnv::FnvHashMap;

  use crate::template::template_sections::style_info::{
    raw_style_info::StyleSheet, Rule, RulePrelude, Selector, ValueToken,
  };

  use super::super::{
    DeclarationBlock, OneSimpleSelector, OneSimpleSelectorType, RawStyleInfo, RuleType,
    StyleInfoDecoder,
  };

  fn generate_string_buf(
    raw_style_info: RawStyleInfo,
    config_enable_css_selector: bool,
    entry_name: Option<String>,
  ) -> StyleInfoDecoder {
    StyleInfoDecoder::new(raw_style_info, entry_name, config_enable_css_selector).unwrap()
  }

  #[test]
  fn test_generate_string_buf() {
    let raw_style_info = RawStyleInfo::new();
    let result = generate_string_buf(raw_style_info, true, None);
    assert_eq!(result.style_content, "");
  }

  #[test]
  fn test_one_font_face() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            nested_rules: vec![],
            rule_type: RuleType::FontFace,
            prelude: RulePrelude {
              selector_list: vec![],
            },
            declaration_block: DeclarationBlock {
              tokens: vec![
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "font-family".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "MyFont".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "src".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "url('myfont.woff2')".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "format('woff2')".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
              ],
            },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    let expected = "@font-face{font-family:MyFont;src:url('myfont.woff2')format('woff2');}";
    assert_eq!(result.font_face_content, expected);
  }

  #[test]
  fn test_rpx_declaration() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            nested_rules: vec![],
            rule_type: RuleType::Declaration,
            prelude: RulePrelude {
              selector_list: vec![Selector {
                simple_selectors: vec![OneSimpleSelector {
                  selector_type: OneSimpleSelectorType::ClassSelector,
                  value: "test-class".to_string(),
                }],
              }],
            },
            declaration_block: DeclarationBlock {
              tokens: vec![
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "width".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                  value: "100rpx".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
              ],
            },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    let expected = ".test-class:not([l-e-name]){width:calc(100 * var(--rpx-unit));}";
    assert_eq!(result.style_content, expected);
  }

  #[test]
  fn test_css_og_one_class() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            nested_rules: vec![],
            rule_type: RuleType::Declaration,
            prelude: RulePrelude {
              selector_list: vec![Selector {
                simple_selectors: vec![OneSimpleSelector {
                  selector_type: OneSimpleSelectorType::ClassSelector,
                  value: "test-class".to_string(),
                }],
              }],
            },
            declaration_block: DeclarationBlock {
              tokens: vec![
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "width".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                  value: "100px".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
              ],
            },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, false, None);
    let expected = "{width:100px;}";
    assert_eq!(result.style_content, expected);
  }

  #[test]
  fn test_css_og_one_class_in_lazy_bundle() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            nested_rules: vec![],
            rule_type: RuleType::Declaration,
            prelude: RulePrelude {
              selector_list: vec![Selector {
                simple_selectors: vec![OneSimpleSelector {
                  selector_type: OneSimpleSelectorType::ClassSelector,
                  value: "test-class".to_string(),
                }],
              }],
            },
            declaration_block: DeclarationBlock {
              tokens: vec![
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "width".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                  value: "100px".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
              ],
            },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, false, Some("lazy-bundle".to_string()));
    let expected = "{width:100px;}";
    assert_eq!(result.style_content, expected);
  }

  #[test]
  fn push_import_only() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![
        (
          1,
          StyleSheet {
            imports: vec![2],
            rules: vec![],
          },
        ),
        (
          2,
          StyleSheet {
            imports: vec![],
            rules: vec![],
          },
        ),
      ]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    assert_eq!(result.style_content, "");
  }
  #[test]
  fn test_keyframes_at_rule() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            rule_type: RuleType::KeyFrames,
            prelude: RulePrelude {
              selector_list: vec![Selector {
                simple_selectors: vec![OneSimpleSelector {
                  selector_type: OneSimpleSelectorType::UnknownText,
                  value: "animation-name".to_string(),
                }],
              }],
            },
            nested_rules: vec![Rule {
              rule_type: RuleType::Declaration,
              prelude: RulePrelude {
                selector_list: vec![Selector {
                  simple_selectors: vec![OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::UnknownText,
                    value: "0%".to_string(),
                  }],
                }],
              },
              nested_rules: vec![],
              declaration_block: DeclarationBlock {
                tokens: vec![
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                    value: "width".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                    value: ":".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                    value: "100rpx".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                    value: ";".to_string(),
                  },
                ],
              },
            }],
            declaration_block: DeclarationBlock { tokens: vec![] },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    let expected = "@keyframes animation-name{0%{width:calc(100 * var(--rpx-unit));}}";
    assert_eq!(result.style_content, expected);
  }

  #[test]
  fn test_type_selector() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![
            Rule {
              nested_rules: vec![],
              rule_type: RuleType::Declaration,
              prelude: RulePrelude {
                selector_list: vec![Selector {
                  simple_selectors: vec![OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::TypeSelector,
                    value: "view".to_string(),
                  }],
                }],
              },
              declaration_block: DeclarationBlock {
                tokens: vec![
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                    value: "width".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                    value: ":".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                    value: "100px".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                    value: ";".to_string(),
                  },
                ],
              },
            },
            Rule {
              nested_rules: vec![],
              rule_type: RuleType::Declaration,
              prelude: RulePrelude {
                selector_list: vec![Selector {
                  simple_selectors: vec![OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::TypeSelector,
                    value: "unknown-tag".to_string(),
                  }],
                }],
              },
              declaration_block: DeclarationBlock {
                tokens: vec![
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                    value: "height".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                    value: ":".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                    value: "100px".to_string(),
                  },
                  ValueToken {
                    token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                    value: ";".to_string(),
                  },
                ],
              },
            },
          ],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    let expected = "x-view:not([l-e-name]){width:100px;}unknown-tag:not([l-e-name]){height:100px;}";
    assert_eq!(result.style_content, expected);
  }

  #[test]
  fn test_multiple_selectors() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            nested_rules: vec![],
            rule_type: RuleType::Declaration,
            prelude: RulePrelude {
              selector_list: vec![
                Selector {
                  simple_selectors: vec![OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::ClassSelector,
                    value: "foo".to_string(),
                  }],
                },
                Selector {
                  simple_selectors: vec![OneSimpleSelector {
                    selector_type: OneSimpleSelectorType::ClassSelector,
                    value: "bar".to_string(),
                  }],
                },
              ],
            },
            declaration_block: DeclarationBlock {
              tokens: vec![
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "height".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                  value: "100px".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
              ],
            },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    let expected = ".foo:not([l-e-name]),.bar:not([l-e-name]){height:100px;}";
    assert_eq!(result.style_content, expected);
  }

  #[test]
  fn test_pseudo_class_selector_with_args() {
    let raw_style_info = RawStyleInfo {
      css_id_to_style_sheet: FnvHashMap::from_iter(vec![(
        0,
        StyleSheet {
          imports: vec![],
          rules: vec![Rule {
            nested_rules: vec![],
            rule_type: RuleType::Declaration,
            prelude: RulePrelude {
              selector_list: vec![Selector {
                simple_selectors: vec![OneSimpleSelector {
                  selector_type: OneSimpleSelectorType::PseudoClassSelector,
                  value: "not([hidden])".to_string(),
                }],
              }],
            },
            declaration_block: DeclarationBlock {
              tokens: vec![
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::IDENT_TOKEN,
                  value: "width".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::COLON_TOKEN,
                  value: ":".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::DIMENSION_TOKEN,
                  value: "100px".to_string(),
                },
                ValueToken {
                  token_type: crate::css_tokenizer::token_types::SEMICOLON_TOKEN,
                  value: ";".to_string(),
                },
              ],
            },
          }],
        },
      )]),
      style_content_str_size_hint: 0,
    };
    let result = generate_string_buf(raw_style_info, true, None);
    let expected = ":not([hidden]):not([l-e-name]){width:100px;}";
    assert_eq!(result.style_content, expected);
  }
}
