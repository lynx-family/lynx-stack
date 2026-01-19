/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::template_sections::element_template::ElementTemplateSection;
use super::template_sections::style_info::StyleSheetResource;
use fnv::FnvHashMap;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Default)]
pub struct TemplateManager {
  pub(crate) element_template_map: FnvHashMap<String, Rc<ElementTemplateSection>>,
  pub(crate) style_info_map: FnvHashMap<String, Rc<StyleSheetResource>>,
}

#[wasm_bindgen]
impl TemplateManager {
  #[wasm_bindgen(constructor)]
  pub fn new() -> TemplateManager {
    TemplateManager::default()
  }

  #[wasm_bindgen]
  pub fn add_element_template(
    &mut self,
    template_name: String,
    buf: js_sys::Uint8Array,
  ) -> Result<(), wasm_bindgen::JsError> {
    self
      .element_template_map
      .insert(template_name.clone(), Rc::new(buf.try_into()?));
    Ok(())
  }

  #[wasm_bindgen]
  pub fn add_style_info(
    &mut self,
    template_name: String,
    buf: js_sys::Uint8Array,
    document: &web_sys::Document,
  ) -> Result<(), wasm_bindgen::JsError> {
    self.style_info_map.insert(
      template_name.clone(),
      Rc::new(StyleSheetResource::new(buf, document)?),
    );
    Ok(())
  }

  #[wasm_bindgen]
  pub fn has_element_template(&self, template_name: &str) -> bool {
    self.element_template_map.contains_key(template_name)
  }
}

impl TemplateManager {
  pub(crate) fn get_element_template_by_name(
    &self,
    template_name: &String,
  ) -> Option<Rc<ElementTemplateSection>> {
    self.element_template_map.get(template_name).cloned()
  }

  pub(crate) fn get_style_info_by_name(
    &self,
    template_name: &String,
  ) -> Option<Rc<StyleSheetResource>> {
    self.style_info_map.get(template_name).cloned()
  }
}

#[cfg(test)]
mod tests {
  use crate::template::TemplateManager;
  use wasm_bindgen_test::*;

  wasm_bindgen_test_configure!(run_in_node_experimental);

  #[wasm_bindgen_test]
  fn test_template_manager_add_and_check() {
    let mut manager = TemplateManager::new();
    assert!(!manager.has_element_template("test_tpl"));

    // bincode 2.0 standard: empty map = length 0 (varint).
    // 0 in varint is byte 0.
    let bytes: [u8; 1] = [0];
    let array = js_sys::Uint8Array::new_with_length(1);
    array.copy_from(&bytes);

    // We use string key "test_tpl"
    let res = manager.add_element_template("test_tpl".to_string(), array);

    assert!(res.is_ok(), "add_element_template failed: {:?}", res.err());
    assert!(manager.has_element_template("test_tpl"));
  }
}
