/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::MainThreadWasmContext;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen]
  pub fn get_component_id(&self, unique_id: usize) -> Result<Option<String>, JsError> {
    Ok(
      self
        .get_element_data_by_unique_id(unique_id)
        .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?
        .borrow()
        .component_id
        .clone(),
    )
  }

  #[wasm_bindgen]
  pub fn get_element_config(&self, unique_id: usize) -> Result<Option<js_sys::Object>, JsError> {
    Ok(
      self
        .get_element_data_by_unique_id(unique_id)
        .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?
        .borrow()
        .component_config
        .clone(),
    )
  }

  #[wasm_bindgen]
  /**
   * key: String
   * value: stringifyed js value
   */
  pub fn set_config(&self, unique_id: usize, config: &js_sys::Object) -> Result<(), JsError> {
    self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?
      .borrow_mut()
      .component_config = Some(config.clone());
    Ok(())
  }

  #[wasm_bindgen]
  pub fn get_config(&self, unique_id: usize) -> Result<js_sys::Object, JsError> {
    let binding = self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?;
    let mut element_data = binding.borrow_mut();
    if let Some(config) = &element_data.component_config {
      Ok(config.clone())
    } else {
      let js_obj = js_sys::Object::new();
      element_data.component_config = Some(js_obj.clone());
      Ok(js_obj)
    }
  }

  #[wasm_bindgen]
  pub fn update_component_id(
    &self,
    unique_id: usize,
    component_id: Option<String>,
  ) -> Result<(), JsError> {
    self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?
      .borrow_mut()
      .component_id = component_id;
    Ok(())
  }
}
