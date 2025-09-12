// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use wasm_bindgen::prelude::*;

// Simplified style processing functions
#[wasm_bindgen]
pub fn query_css_property(index: i32) -> Option<JsValue> {
    let result = js_sys::Object::new();
    js_sys::Reflect::set(&result, &"name".into(), &"unknown".into()).unwrap();
    js_sys::Reflect::set(&result, &"dashName".into(), &"unknown".into()).unwrap();
    js_sys::Reflect::set(&result, &"isX".into(), &false.into()).unwrap();
    Some(result.into())
}

#[wasm_bindgen]
pub fn query_css_property_number(name: &str) -> Option<i32> {
    Some(1)
}

#[wasm_bindgen]
pub fn transform_inline_style_string(input: &str) -> String {
    input.to_string()
}

#[wasm_bindgen]
pub fn transform_parsed_styles(styles: &js_sys::Array) -> JsValue {
    let result = js_sys::Object::new();
    js_sys::Reflect::set(&result, &"transformedStyle".into(), styles).unwrap();
    js_sys::Reflect::set(&result, &"childStyle".into(), &js_sys::Array::new()).unwrap();
    result.into()
}