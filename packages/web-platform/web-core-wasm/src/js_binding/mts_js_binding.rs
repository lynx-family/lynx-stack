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

  #[wasm_bindgen(method, js_name = "loadInternalWebElement")]
  pub fn load_internal_web_element(this: &RustMainthreadContextBinding, element_id: usize);

  #[wasm_bindgen(method, js_name = "loadUnknownElement")]
  pub fn load_unknown_element(this: &RustMainthreadContextBinding, element_tag: &str);

  #[wasm_bindgen(method, js_name = "markExposureRelatedElementByUniqueId")]
  pub fn mark_exposure_related_element_by_unique_id(
    this: &RustMainthreadContextBinding,
    element: &web_sys::HtmlElement,
    to_enable: bool,
  );

  #[wasm_bindgen(method, js_name = "enableElementEvent")]
  pub fn enable_element_event(
    this: &RustMainthreadContextBinding,
    element: &web_sys::HtmlElement,
    event_name: &str,
  );

  #[wasm_bindgen(method, js_name = "disableElementEvent")]
  pub fn disable_element_event(
    this: &RustMainthreadContextBinding,
    element: &web_sys::HtmlElement,
    event_name: &str,
  );

  #[wasm_bindgen(method, js_name = "getClassList")]
  pub fn get_class_name_list(
    this: &RustMainthreadContextBinding,
    element: &web_sys::HtmlElement,
  ) -> Vec<String>;

}
