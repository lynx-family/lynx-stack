/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::css_property::ParsedDeclaration;

#[cfg(feature = "encode")]
use super::style_info_decoder::StyleInfoDecoder;
use fnv::FnvHashMap;
#[cfg(feature = "encode")]
use rkyv::Serialize;
use rkyv::{Archive, Deserialize};
use wasm_bindgen::prelude::*;

#[derive(Clone, Default, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[wasm_bindgen]
pub struct RawStyleInfo {
  pub(super) css_id_to_style_sheet: FnvHashMap<i32, StyleSheet>,
  pub(super) style_content_str_size_hint: usize,
}

#[derive(Clone, Default, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub struct StyleSheet {
  pub(super) imports: Vec<i32>,
  pub(super) rules: Vec<Rule>,
}

#[derive(Clone, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[archive(bound(
  serialize = "__S: rkyv::ser::Serializer + rkyv::ser::ScratchSpace",
  deserialize = "__D: rkyv::de::SharedDeserializeRegistry"
))]
#[wasm_bindgen]
pub struct Rule {
  pub(super) rule_type: RuleType,
  pub(super) prelude: RulePrelude,
  pub(super) declaration_block: DeclarationBlock,
  #[omit_bounds]
  pub(super) nested_rules: Vec<Rule>,
}

#[derive(Clone, PartialEq, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[repr(i32)]
pub(super) enum RuleType {
  Declaration = 1,
  FontFace = 2,
  KeyFrames = 3,
}

#[derive(Clone, Default, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[wasm_bindgen]
/**
 * Either SelectorList or KeyFramesPrelude
 * Depending on the RuleType
 * If it is SelectorList, then selectors is a list of Selector
 * If it is KeyFramesPrelude, then selectors has only one selector which is Prelude text, its simple_selectors is empty
 * If the parent is FontFace, then selectors is empty
 */
pub struct RulePrelude {
  pub(super) selector_list: Vec<Selector>,
}

#[derive(Clone, Default, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[wasm_bindgen]
pub struct Selector {
  pub(super) simple_selectors: Vec<OneSimpleSelector>,
}

#[derive(Clone, PartialEq, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct OneSimpleSelector {
  pub(crate) selector_type: OneSimpleSelectorType,
  pub(crate) value: String,
}

#[derive(Clone, PartialEq, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[repr(i32)]
/**
 * All possible OneSimpleSelector types
 */
pub(crate) enum OneSimpleSelectorType {
  ClassSelector = 1,
  IdSelector = 2,
  AttributeSelector = 3,
  TypeSelector = 4,
  Combinator = 5,
  PseudoClassSelector = 6,
  PseudoElementSelector = 7,
  UniversalSelector = 8,
  UnknownText = 9,
}

#[derive(Clone, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct DeclarationBlock {
  pub(crate) declarations: Vec<ParsedDeclaration>,
}

#[wasm_bindgen]
impl RawStyleInfo {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    Self::default()
  }

  /**
   * Appends an import to the stylesheet identified by `css_id`.
   * If the stylesheet does not exist, it is created.
   * @param css_id - The ID of the CSS file.
   * @param import_css_id - The ID of the imported CSS file.
   */
  pub fn append_import(&mut self, css_id: i32, import_css_id: i32) {
    // if css_id not exist, create a new StyleSheet
    let style_sheet = self.css_id_to_style_sheet.entry(css_id).or_default();
    style_sheet.imports.push(import_css_id);
  }

  /**
   * Pushes a rule to the stylesheet identified by `css_id`.
   * If the stylesheet does not exist, it is created.
   * @param css_id - The ID of the CSS file.
   * @param rule - The rule to append.
   */
  pub fn push_rule(&mut self, css_id: i32, rule: Rule) {
    let style_sheet = self.css_id_to_style_sheet.entry(css_id).or_default();
    style_sheet.rules.push(rule);
  }

  /**
   * Encodes the RawStyleInfo into a Uint8Array using rkyv serialization.
   * @returns A Uint8Array containing the serialized RawStyleInfo.
   */
  #[cfg(feature = "encode")]
  pub fn encode(&mut self) -> Result<js_sys::Uint8Array, JsError> {
    let decoded_style_info = StyleInfoDecoder::new(self.clone(), None, true)?;
    self.style_content_str_size_hint = decoded_style_info.style_content.len();
    let serialized = rkyv::to_bytes::<_, 1024>(self)
      .map_err(|e| JsError::new(&format!("Failed to encode RawStyleInfo: {e:?}")))?;
    Ok(js_sys::Uint8Array::from(serialized.as_slice()))
  }
}

#[wasm_bindgen]
impl Rule {
  /**
   * Creates a new Rule with the specified type.
   * @param rule_type - The type of the rule (e.g., "StyleRule", "FontFaceRule", "KeyframesRule").
   */
  #[wasm_bindgen(constructor)]
  pub fn new(rule_type: String) -> Result<Rule, JsError> {
    let rule_type_enum = match rule_type.as_str() {
      "StyleRule" => RuleType::Declaration,
      "FontFaceRule" => RuleType::FontFace,
      "KeyframesRule" => RuleType::KeyFrames,
      _ => {
        return Err(JsError::new(&format!("Unknown rule type: {rule_type}")));
      }
    };
    Ok(Rule {
      rule_type: rule_type_enum,
      prelude: RulePrelude {
        selector_list: vec![],
      },
      declaration_block: DeclarationBlock {
        declarations: vec![],
      },
      nested_rules: vec![],
    })
  }

  /**
   * Sets the prelude for the rule.
   * @param prelude - The prelude to set (SelectorList or KeyFramesPrelude).
   */
  pub fn set_prelude(&mut self, prelude: RulePrelude) {
    self.prelude = prelude;
  }

  /**
   * Pushes a declaration to the rule's declaration block.
   * LynxJS doesn't support !important
   * @param property_name - The property name.
   * @param value - The property value.
   */
  pub fn push_declaration(&mut self, property_name: String, value: String) {
    self
      .declaration_block
      .declarations
      .push(ParsedDeclaration::new(property_name, value));
  }

  /**
   * Pushes a nested rule to the rule.
   * @param rule - The nested rule to add.
   */
  pub fn push_rule_children(&mut self, rule: Rule) {
    self.nested_rules.push(rule);
  }
}

#[wasm_bindgen]
impl RulePrelude {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    Self {
      selector_list: vec![],
    }
  }

  /**
   * Pushes a selector to the list.
   * @param selector - The selector to add.
   */
  pub fn push_selector(&mut self, selector: Selector) {
    self.selector_list.push(selector);
  }
}

#[wasm_bindgen]
impl Selector {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    Self {
      simple_selectors: vec![],
    }
  }

  /**
   * Pushes a selector section to the selector.
   * @param selector_type - The type of the selector section (e.g., "ClassSelector", "IdSelector").
   * @param value - The value of the selector section.
   */
  pub fn push_one_selector_section(
    &mut self,
    selector_type: String,
    value: String,
  ) -> Result<(), JsError> {
    let selector_selector_type = match selector_type.as_str() {
      "ClassSelector" => OneSimpleSelectorType::ClassSelector,
      "IdSelector" => OneSimpleSelectorType::IdSelector,
      "AttributeSelector" => OneSimpleSelectorType::AttributeSelector,
      "TypeSelector" => OneSimpleSelectorType::TypeSelector,
      "Combinator" => OneSimpleSelectorType::Combinator,
      "PseudoClassSelector" => OneSimpleSelectorType::PseudoClassSelector,
      "PseudoElementSelector" => OneSimpleSelectorType::PseudoElementSelector,
      "UniversalSelector" => OneSimpleSelectorType::UniversalSelector,
      "UnknownText" => OneSimpleSelectorType::UnknownText,
      _ => {
        return Err(JsError::new(&format!(
          "Unknown selector section type: {selector_type}"
        )))
      }
    };
    let selector_section = OneSimpleSelector {
      selector_type: selector_selector_type,
      value,
    };
    self.simple_selectors.push(selector_section);
    Ok(())
  }
}

impl Selector {
  pub(crate) fn generate_to_string_buf(&self, buf: &mut String) {
    for selector in self.simple_selectors.iter() {
      match selector.selector_type {
        OneSimpleSelectorType::TypeSelector => {
          buf.push_str(&selector.value);
        }
        OneSimpleSelectorType::ClassSelector => {
          buf.push('.');
          buf.push_str(&selector.value);
        }
        OneSimpleSelectorType::IdSelector => {
          buf.push('#');
          buf.push_str(&selector.value);
        }
        OneSimpleSelectorType::AttributeSelector => {
          buf.push('[');
          buf.push_str(&selector.value);
          buf.push(']');
        }
        OneSimpleSelectorType::PseudoClassSelector => {
          buf.push(':');
          buf.push_str(&selector.value);
        }
        OneSimpleSelectorType::PseudoElementSelector => {
          buf.push_str("::");
          buf.push_str(&selector.value);
        }
        OneSimpleSelectorType::UniversalSelector => {
          buf.push('*');
        }
        OneSimpleSelectorType::Combinator => {
          buf.push(' ');
          buf.push_str(&selector.value);
          buf.push(' ');
        }
        OneSimpleSelectorType::UnknownText => {
          buf.push_str(&selector.value);
        }
      }
    }
  }
}
