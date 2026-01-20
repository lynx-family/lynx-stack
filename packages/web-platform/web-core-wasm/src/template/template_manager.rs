/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::template_sections::style_info::StyleSheetResource;
use fnv::FnvHashMap;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Default)]
pub struct TemplateManager {
  pub(crate) style_info_map: FnvHashMap<String, Rc<StyleSheetResource>>,
}

#[wasm_bindgen]
impl TemplateManager {
  #[wasm_bindgen(constructor)]
  pub fn new() -> TemplateManager {
    TemplateManager::default()
  }

  #[wasm_bindgen]
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
}

impl TemplateManager {
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
  fn test_template_manager_create() {
    let _manager = TemplateManager::new();
  }
}
