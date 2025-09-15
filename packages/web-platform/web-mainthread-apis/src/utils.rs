// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use wasm_bindgen::prelude::*;
use web_sys::Event;
use js_sys::Object;

// Simple implementations for now
#[wasm_bindgen]
pub fn create_cross_thread_event(dom_event: &Event, event_name: &str) -> JsValue {
    let event = Object::new();
    js_sys::Reflect::set(&event, &"type".into(), &dom_event.type_().into()).unwrap_or(false);
    js_sys::Reflect::set(&event, &"eventName".into(), &event_name.into()).unwrap_or(false);
    event.into()
}

#[wasm_bindgen]
pub fn create_exposure_service(root_dom: &web_sys::EventTarget, post_exposure: &js_sys::Function) -> JsValue {
    let result = Object::new();
    let switch_fn = js_sys::Function::new_no_args("return function(){};");
    js_sys::Reflect::set(&result, &"switchExposureService".into(), &switch_fn).unwrap_or(false);
    result.into()
}

#[wasm_bindgen]
pub fn decode_css_og(classes: &str, style_info: &JsValue, css_id: Option<&str>) -> String {
    // Simplified implementation
    classes.to_string()
}

#[wasm_bindgen]
pub fn flatten_style_info(style_info: &JsValue, enable_css_selector: bool) {
    // Simplified implementation
}

#[wasm_bindgen]
pub fn transform_to_web_css(style_info: &JsValue) {
    // Simplified implementation
}

#[wasm_bindgen]
pub fn gen_css_content(style_info: &JsValue, page_config: &JsValue, entry_name: Option<&str>) -> String {
    String::new()
}

#[wasm_bindgen]
pub fn gen_css_og_info(style_info: &JsValue) -> JsValue {
    Object::new().into()
}

#[wasm_bindgen]
pub fn append_style_element(
    style_info: &JsValue,
    page_config: &JsValue,
    root_dom: &web_sys::Node,
    document: &web_sys::Document,
    entry_name: Option<&str>,
    ssr_hydrate_info: Option<&JsValue>,
) -> JsValue {
    Object::new().into()
}

#[wasm_bindgen]
pub fn tokenize_css(input: &str) -> js_sys::Array {
    js_sys::Array::new()
}

#[wasm_bindgen]
pub fn parse_css_declarations(css_text: &str) -> js_sys::Array {
    js_sys::Array::new()
}

#[wasm_bindgen]
pub fn serialize_css_declarations(declarations: &js_sys::Array) -> String {
    String::new()
}

#[wasm_bindgen]
pub fn transform_inline_style_string_wrapper(input: &str) -> String {
    input.to_string()
}

#[wasm_bindgen]
pub fn transform_parsed_styles_wrapper(styles: &js_sys::Array) -> JsValue {
    let result = Object::new();
    js_sys::Reflect::set(&result, &"transformedStyle".into(), styles).unwrap_or(false);
    js_sys::Reflect::set(&result, &"childStyle".into(), &js_sys::Array::new()).unwrap_or(false);
    result.into()
}
