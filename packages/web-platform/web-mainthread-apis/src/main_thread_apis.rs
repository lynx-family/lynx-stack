// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use js_sys::{Array, Function, Object};
use wasm_bindgen::prelude::*;
use web_sys::Document;

// Main function to prepare main thread APIs
#[wasm_bindgen]
pub fn prepare_main_thread_apis(
  _background_thread_rpc: JsValue,
  _root_dom: JsValue,
  _document: Document,
  _mts_realm: JsValue,
  _commit_document: Function,
  mark_timing_internal: Function,
  _flush_mark_timing_internal: Function,
  _report_error: Function,
  _trigger_i18n_resource_fallback: Function,
  _initial_i18n_resources: Function,
) -> Result<JsValue, JsValue> {
  // Simple implementation that returns an object with startMainThread function
  let result = Object::new();

  // Create a simplified start_main_thread function
  let start_fn = Closure::wrap(Box::new(move |_config: JsValue| -> JsValue {
    // Mark timing for lepus execution start
    let args = Array::new();
    args.push(&"lepus_execute_start".into());
    let _ = mark_timing_internal.apply(&JsValue::NULL, &args);

    // Return a resolved promise for now
    js_sys::Promise::resolve(&JsValue::NULL).into()
  }) as Box<dyn FnMut(JsValue) -> JsValue>);

  js_sys::Reflect::set(
    &result,
    &"startMainThread".into(),
    start_fn.as_ref().unchecked_ref(),
  )?;
  start_fn.forget();

  Ok(result.into())
}
