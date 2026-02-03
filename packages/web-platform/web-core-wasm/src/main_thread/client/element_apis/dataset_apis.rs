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
  pub fn set_dataset(
    &mut self,
    unique_id: usize,
    dom: &web_sys::HtmlElement,
    new_dataset: &js_sys::Object,
  ) -> Result<(), JsError> {
    let element_rc = self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?;
    let mut element_data = element_rc.borrow_mut();
    let dataset = element_data.dataset.get_or_insert_with(js_sys::Object::new);
    // compare old dataset and new dataset and update dom attributes
    let old_keys = js_sys::Object::keys(dataset);
    let new_keys = js_sys::Object::keys(new_dataset);
    // remove old keys not in new dataset
    for i in 0..old_keys.length() {
      let key = old_keys.get(i);
      if !js_sys::Reflect::has(new_dataset, &key).unwrap_or(false) {
        if let Some(key_str) = key.as_string() {
          let _ = dom.remove_attribute(&format!("data-{key_str}"));
        }
      }
    }
    // set/ update new keys
    for i in 0..new_keys.length() {
      let key = new_keys.get(i);
      let new_value =
        js_sys::Reflect::get(new_dataset, &key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
      let old_value =
        js_sys::Reflect::get(dataset, &key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
      if old_value != new_value {
        if let Some(key_str) = key.as_string() {
          if new_value.is_undefined() || new_value.is_null() {
            let _ = dom.remove_attribute(&format!("data-{key_str}"));
          } else {
            let value_str = new_value.as_string().unwrap_or_default();
            let _ = dom.set_attribute(&format!("data-{key_str}"), &value_str);
          }
        }
      }
    }
    element_data.dataset = Some(new_dataset.clone());
    Ok(())
  }

  #[wasm_bindgen]
  pub fn add_dataset(
    &mut self,
    unique_id: usize,
    key: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) -> Result<(), JsError> {
    // get the dataset object, create one if not exists
    let element_rc = self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?;
    let mut element_data = element_rc.borrow_mut();
    let dataset_obj = if let Some(dataset) = element_data.dataset.take() {
      dataset
    } else {
      js_sys::Object::new()
    };
    let _ = js_sys::Reflect::set(&dataset_obj, key, value);
    element_data.dataset = Some(dataset_obj);
    Ok(())
  }

  #[wasm_bindgen]
  pub fn get_dataset(&self, unique_id: usize) -> Result<js_sys::Object, JsError> {
    let element_rc = self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?;
    let element_data = element_rc.borrow();
    if let Some(dataset) = &element_data.dataset {
      Ok(dataset.clone())
    } else {
      Ok(js_sys::Object::new())
    }
  }

  #[wasm_bindgen]
  pub fn get_data_by_key(
    &self,
    unique_id: usize,
    key: &str,
  ) -> Result<wasm_bindgen::JsValue, JsError> {
    let element_rc = self
      .get_element_data_by_unique_id(unique_id)
      .ok_or_else(|| JsError::new(&format!("Element {unique_id} not found")))?;
    let element_data = element_rc.borrow();
    if let Some(dataset) = &element_data.dataset {
      if let Ok(value) = js_sys::Reflect::get(dataset, &wasm_bindgen::JsValue::from_str(key)) {
        Ok(value)
      } else {
        Ok(wasm_bindgen::JsValue::UNDEFINED)
      }
    } else {
      Ok(wasm_bindgen::JsValue::UNDEFINED)
    }
  }
}
