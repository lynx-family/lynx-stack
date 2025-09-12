// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use js_sys::{Array, Function};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn register_call_lepus_method_handler(
  background_thread_rpc: &JsValue,
  _mts_global_this: &JsValue,
) -> Result<(), JsValue> {
  // Register handler for calling lepus methods
  let handler = Closure::wrap(
    Box::new(move |method_name: String, _args: Array| -> JsValue {
      // This would implement the actual lepus method calling logic
      web_sys::console::log_1(&format!("Calling lepus method: {}", method_name).into());
      JsValue::NULL
    }) as Box<dyn FnMut(String, Array) -> JsValue>,
  );

  // Register the handler with the RPC system
  if let Ok(register_handler) =
    js_sys::Reflect::get(background_thread_rpc, &"registerHandler".into())
  {
    if let Ok(register_fn) = register_handler.dyn_into::<Function>() {
      let args = Array::new();
      args.push(&"callLepusMethod".into()); // endpoint name
      args.push(handler.as_ref().unchecked_ref());
      register_fn.apply(background_thread_rpc, &args)?;
    }
  }

  handler.forget(); // Prevent cleanup
  Ok(())
}

#[wasm_bindgen]
pub fn register_get_custom_section_handler(
  background_thread_rpc: &JsValue,
  custom_sections: &JsValue,
) -> Result<(), JsValue> {
  // Register handler for getting custom sections
  let custom_sections_clone = custom_sections.clone();
  let handler = Closure::wrap(Box::new(move |section_key: String| -> JsValue {
    // Get the custom section content
    if let Ok(section) = js_sys::Reflect::get(&custom_sections_clone, &section_key.into()) {
      if let Ok(content) = js_sys::Reflect::get(&section, &"content".into()) {
        return content;
      }
    }
    JsValue::NULL
  }) as Box<dyn FnMut(String) -> JsValue>);

  // Register the handler with the RPC system
  if let Ok(register_handler) =
    js_sys::Reflect::get(background_thread_rpc, &"registerHandler".into())
  {
    if let Ok(register_fn) = register_handler.dyn_into::<Function>() {
      let args = Array::new();
      args.push(&"getCustomSection".into()); // endpoint name
      args.push(handler.as_ref().unchecked_ref());
      register_fn.apply(background_thread_rpc, &args)?;
    }
  }

  handler.forget(); // Prevent cleanup
  Ok(())
}
