/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use wasm_bindgen::prelude::*;

#[wasm_bindgen]
extern "C" {
  pub type RustMainthreadContextBinding;

  #[wasm_bindgen(method, js_name = "runWorklet")]
  pub fn publish_mts_event(
    this: &RustMainthreadContextBinding,
    handler_name: &wasm_bindgen::JsValue,
    event_object: &wasm_bindgen::JsValue,
    target_element_unique_id: usize,
    target_dataset: &wasm_bindgen::JsValue,
    current_target_element_unique_id: usize,
    current_target_dataset: &wasm_bindgen::JsValue,
  );

  #[wasm_bindgen(method, js_name = "publishEvent")]
  pub fn publish_event(
    this: &RustMainthreadContextBinding,
    handler_name: &str,
    parent_component_id: Option<&str>,
    event_object: &wasm_bindgen::JsValue,
    target_element_unique_id: usize,
    target_dataset: &wasm_bindgen::JsValue,
    current_target_element_unique_id: usize,
    current_target_dataset: &wasm_bindgen::JsValue,
  );

  #[wasm_bindgen(method, js_name = "addEventListener")]
  pub fn add_event_listener(this: &RustMainthreadContextBinding, event_name: &str);

  #[wasm_bindgen(method, catch, js_name = "enableElementEvent")]
  pub fn enable_element_event(
    this: &RustMainthreadContextBinding,
    element: &js_sys::WeakRef,
    event_name: &str,
  ) -> Result<(), JsValue>;

  #[wasm_bindgen(method, catch, js_name = "disableElementEvent")]
  pub fn disable_element_event(
    this: &RustMainthreadContextBinding,
    element: &js_sys::WeakRef,
    event_name: &str,
  ) -> Result<(), JsValue>;

  #[wasm_bindgen(method, catch, js_name = "getClassList")]
  pub fn get_class_name_list(
    this: &RustMainthreadContextBinding,
    element: &js_sys::WeakRef,
  ) -> Result<Vec<String>, JsValue>;

  #[wasm_bindgen(method, catch, js_name = "setAttribute")]
  pub fn set_attribute(
    this: &RustMainthreadContextBinding,
    element: &js_sys::WeakRef,
    name: &str,
    value: &str,
  ) -> Result<(), JsValue>;

  #[wasm_bindgen(method, catch, js_name = "removeAttribute")]
  pub fn remove_attribute(
    this: &RustMainthreadContextBinding,
    element: &js_sys::WeakRef,
    name: &str,
  ) -> Result<(), JsValue>;

}
