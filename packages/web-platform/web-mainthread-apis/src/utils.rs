// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use js_sys::{Array, Function, Object};
use wasm_bindgen::prelude::*;
use web_sys::{window, Document};

#[wasm_bindgen]
pub fn create_exposure_service(
  _root_dom: &JsValue,
  _post_exposure: &Function,
) -> Result<JsValue, JsValue> {
  // Create exposure service for tracking element visibility
  let result = Object::new();

  // Create switch exposure service function
  let switch_exposure_service = Closure::wrap(Box::new(move |enabled: bool| -> JsValue {
    // Implementation for switching exposure service on/off
    web_sys::console::log_1(&format!("Exposure service enabled: {}", enabled).into());
    JsValue::NULL
  }) as Box<dyn FnMut(bool) -> JsValue>);

  js_sys::Reflect::set(
    &result,
    &"switchExposureService".into(),
    switch_exposure_service.as_ref().unchecked_ref(),
  )?;
  switch_exposure_service.forget();

  Ok(result.into())
}

#[wasm_bindgen]
pub fn create_cross_thread_event(event_type: &str, data: &JsValue) -> Result<JsValue, JsValue> {
  // Create a cross-thread event object
  let event = Object::new();
  js_sys::Reflect::set(&event, &"type".into(), &event_type.into())?;
  js_sys::Reflect::set(&event, &"data".into(), data)?;
  Ok(event.into())
}

#[wasm_bindgen]
pub fn process_style_info(
  style_info: &JsValue,
  _page_config: &JsValue,
  _root_dom: &JsValue,
  document: &Document,
) -> Result<JsValue, JsValue> {
  // Process and inject style information

  // Create a style element
  let style_element = document.create_element("style")?;

  // Extract CSS content from style_info (simplified)
  if let Ok(css_content) = js_sys::Reflect::get(style_info, &"css".into()) {
    if let Some(css_str) = css_content.as_string() {
      style_element.set_text_content(Some(&css_str));
    }
  }

  // Append to document head if available
  if let Some(head) = document.head() {
    head.append_child(&style_element)?;
  }

  // Return update function
  let result = Object::new();
  let update_css_fn = Closure::wrap(Box::new(move |new_css: String| -> JsValue {
    // Update CSS function would be implemented here
    web_sys::console::log_1(&format!("Updating CSS: {}", new_css).into());
    JsValue::NULL
  }) as Box<dyn FnMut(String) -> JsValue>);

  js_sys::Reflect::set(
    &result,
    &"updateCssOGStyle".into(),
    update_css_fn.as_ref().unchecked_ref(),
  )?;
  update_css_fn.forget();

  Ok(result.into())
}

#[wasm_bindgen]
pub fn decode_css_og(css_data: &JsValue) -> Result<String, JsValue> {
  // Decode CSS OG (Original Graphics) data
  if let Some(css_str) = css_data.as_string() {
    // In a real implementation, this would perform actual CSS decoding
    Ok(css_str)
  } else {
    Ok(String::new())
  }
}

#[wasm_bindgen]
pub fn tokenizer(input: &str) -> Result<Array, JsValue> {
  // Simple tokenizer implementation
  let tokens = Array::new();

  // Basic tokenization (this would be more sophisticated in reality)
  for (i, char) in input.chars().enumerate() {
    let token = Object::new();
    js_sys::Reflect::set(&token, &"type".into(), &"char".into())?;
    js_sys::Reflect::set(&token, &"value".into(), &char.to_string().into())?;
    js_sys::Reflect::set(&token, &"position".into(), &(i as u32).into())?;
    tokens.push(&token.into());
  }

  Ok(tokens)
}

#[wasm_bindgen]
pub fn mark_performance_timing(
  timing_key: &str,
  pipeline_id: Option<String>,
) -> Result<(), JsValue> {
  // Mark performance timing using the Performance API
  if let Some(window) = window() {
    if let Some(performance) = window.performance() {
      let mark_name = if let Some(id) = pipeline_id {
        format!("{}_{}", timing_key, id)
      } else {
        timing_key.to_string()
      };

      let _ = performance.mark(&mark_name);
    }
  }
  Ok(())
}
