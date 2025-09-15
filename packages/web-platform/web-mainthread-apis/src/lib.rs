// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use js_sys::Function;
use wasm_bindgen::prelude::*;
use web_sys::{window, Document, Element, HtmlElement};

pub mod cross_thread_handlers;
pub mod main_thread_apis;
pub mod main_thread_lynx;
pub mod utils;
pub mod pure_element_papis;
pub mod create_main_thread_global_this;
pub mod style;

// Re-export main functions
pub use main_thread_apis::*;
pub use main_thread_lynx::*;
pub use pure_element_papis::*;
pub use create_main_thread_global_this::*;
pub use style::*;
pub use utils::*;

#[wasm_bindgen]
extern "C" {
  #[wasm_bindgen(js_namespace = console)]
  fn log(s: &str);
}

macro_rules! console_log {
    ($($t:tt)*) => (log(&format_args!($($t)*).to_string()))
}

#[wasm_bindgen]
pub struct MainThreadAPIs {
  document: Document,
  root_dom: Option<Element>,
  window: web_sys::Window,
}

#[wasm_bindgen]
impl MainThreadAPIs {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Result<MainThreadAPIs, JsValue> {
    let window = window().ok_or("No window object")?;
    let document = window.document().ok_or("No document object")?;

    Ok(MainThreadAPIs {
      document,
      root_dom: None,
      window,
    })
  }

  #[wasm_bindgen]
  pub fn set_root_dom(&mut self, element: &Element) {
    self.root_dom = Some(element.clone());
  }

  #[wasm_bindgen]
  pub fn get_window(&self) -> web_sys::Window {
    self.window.clone()
  }

  #[wasm_bindgen]
  pub fn get_document(&self) -> Document {
    self.document.clone()
  }

  #[wasm_bindgen]
  pub fn request_animation_frame(&self, callback: &Function) -> Result<i32, JsValue> {
    self.window.request_animation_frame(callback)
  }

  #[wasm_bindgen]
  pub fn cancel_animation_frame(&self, handle: i32) {
    let _ = self.window.cancel_animation_frame(handle);
  }
}

// Main entry point
#[wasm_bindgen]
pub fn prepare_main_thread_apis() -> JsValue {
    console_log!("Preparing main thread APIs from Rust");
    
    let window = window().expect("should have a window in this context");
    let document = window.document().expect("window should have a document");
    
    // Initialize main thread APIs
    let apis = MainThreadAPIs::new().expect("Failed to create MainThreadAPIs");
    
    // Return APIs as JsValue
    let result = js_sys::Object::new();
    js_sys::Reflect::set(&result, &"initialized".into(), &true.into()).unwrap();
    result.into()
}

// Export all pure element APIs as WASM functions
#[wasm_bindgen]
pub fn append_element(parent: &Element, child: &Element) {
    append_element_impl(parent, child);
}

#[wasm_bindgen]
pub fn element_is_equal(left: &Element, right: &Element) -> bool {
    element_is_equal_impl(left, right)
}

#[wasm_bindgen]
pub fn first_element(element: &Element) -> Option<Element> {
    first_element_impl(element)
}

#[wasm_bindgen]
pub fn get_children(element: &Element) -> Option<js_sys::Array> {
    get_children_impl(element)
}

#[wasm_bindgen]
pub fn get_parent(element: &Element) -> Option<Element> {
    get_parent_impl(element)
}

#[wasm_bindgen]
pub fn insert_element_before(parent: &Element, child: &Element, reference: Option<Element>) {
    insert_element_before_impl(parent, child, reference.as_ref());
}

#[wasm_bindgen]
pub fn last_element(element: &Element) -> Option<Element> {
    last_element_impl(element)
}

#[wasm_bindgen]
pub fn next_element(element: &Element) -> Option<Element> {
    next_element_impl(element)
}

#[wasm_bindgen]
pub fn remove_element(parent: &Element, child: &Element) {
    remove_element_impl(parent, child);
}

#[wasm_bindgen]
pub fn replace_element(new_element: &Element, old_element: &Element) {
    replace_element_impl(new_element, old_element);
}

#[wasm_bindgen]
pub fn replace_elements(parent: &Element, new_children: &js_sys::Array, old_children: Option<&js_sys::Array>) {
    replace_elements_impl(parent, new_children, old_children);
}

#[wasm_bindgen]
pub fn get_component_id(element: &Element) -> Option<String> {
    get_component_id_impl(element)
}

#[wasm_bindgen]
pub fn get_element_unique_id(element: &Element) -> i32 {
    get_element_unique_id_impl(element)
}

#[wasm_bindgen]
pub fn get_id(element: &Element) -> Option<String> {
    get_id_impl(element)
}

#[wasm_bindgen]
pub fn set_id(element: &Element, id: Option<&str>) {
    set_id_impl(element, id);
}

#[wasm_bindgen]
pub fn get_tag(element: &Element) -> Option<String> {
    get_tag_impl(element)
}

#[wasm_bindgen]
pub fn get_classes(element: &Element) -> js_sys::Array {
    get_classes_impl(element)
}

#[wasm_bindgen]
pub fn set_classes(element: &Element, class_name: Option<&str>) {
    set_classes_impl(element, class_name);
}

#[wasm_bindgen]
pub fn add_class(element: &Element, class_name: &str) {
    add_class_impl(element, class_name);
}

#[wasm_bindgen]
pub fn add_inline_style(element: &HtmlElement, key: &str, value: Option<&str>) {
    add_inline_style_impl(element, key, value);
}

#[wasm_bindgen]
pub fn set_inline_styles(element: &HtmlElement, styles: &JsValue) {
    set_inline_styles_impl(element, styles);
}

#[wasm_bindgen]
pub fn get_dataset(element: &Element) -> JsValue {
    get_dataset_impl(element)
}

#[wasm_bindgen]
pub fn set_dataset(element: &Element, dataset: &JsValue) {
    set_dataset_impl(element, dataset);
}

#[wasm_bindgen]
pub fn add_dataset(element: &Element, key: &str, value: &JsValue) {
    add_dataset_impl(element, key, value);
}

#[wasm_bindgen]
pub fn get_data_by_key(element: &Element, key: &str) -> JsValue {
    get_data_by_key_impl(element, key)
}

#[wasm_bindgen]
pub fn get_attributes(element: &Element) -> JsValue {
    get_attributes_impl(element)
}

#[wasm_bindgen]
pub fn get_element_config(element: &Element) -> JsValue {
    get_element_config_impl(element)
}

#[wasm_bindgen]
pub fn set_config(element: &Element, config: &JsValue) {
    set_config_impl(element, config);
}

#[wasm_bindgen]
pub fn add_config(element: &Element, config_type: &str, value: &JsValue) {
    add_config_impl(element, config_type, value);
}

#[wasm_bindgen]
pub fn get_attribute_by_name(element: &Element, name: &str) -> Option<String> {
    get_attribute_by_name_impl(element, name)
}

#[wasm_bindgen]
pub fn update_component_id(element: &Element, component_id: &str) {
    update_component_id_impl(element, component_id);
}

#[wasm_bindgen]
pub fn set_css_id(elements: &js_sys::Array, css_id: i32) {
    set_css_id_impl(elements, css_id);
}

#[wasm_bindgen]
pub fn update_component_info(element: &Element, params: &JsValue) {
    update_component_info_impl(element, params);
}

#[wasm_bindgen]
pub fn get_template_parts(template_element: &Element) -> JsValue {
    get_template_parts_impl(template_element)
}

#[wasm_bindgen]
pub fn mark_template_element(element: &Element) {
    mark_template_element_impl(element);
}

#[wasm_bindgen]
pub fn mark_part_element(element: &Element, part_id: &str) {
    mark_part_element_impl(element, part_id);
}

// Export utility functions
#[wasm_bindgen]
pub fn create_cross_thread_event_wrapper(event: &web_sys::Event, event_name: &str) -> JsValue {
    create_cross_thread_event(event, event_name)
}

#[wasm_bindgen]
pub fn create_exposure_service_wrapper(
    root_dom: &web_sys::EventTarget,
    post_exposure: &Function,
) -> JsValue {
    create_exposure_service(root_dom, post_exposure)
}

#[wasm_bindgen]
pub fn decode_css_og_wrapper(
    classes: &str,
    style_info: &JsValue,
    css_id: Option<&str>,
) -> String {
    decode_css_og(classes, style_info, css_id)
}

// Export style processing functions
#[wasm_bindgen]
pub fn flatten_style_info_wrapper(style_info: &JsValue, enable_css_selector: bool) {
    flatten_style_info(style_info, enable_css_selector);
}

#[wasm_bindgen]
pub fn transform_to_web_css_wrapper(style_info: &JsValue) {
    transform_to_web_css(style_info);
}

#[wasm_bindgen]
pub fn gen_css_content_wrapper(
    style_info: &JsValue,
    page_config: &JsValue,
    entry_name: Option<&str>,
) -> String {
    gen_css_content(style_info, page_config, entry_name)
}

#[wasm_bindgen]
pub fn gen_css_og_info_wrapper(style_info: &JsValue) -> JsValue {
    gen_css_og_info(style_info)
}

#[wasm_bindgen]
pub fn append_style_element_wrapper(
    style_info: &JsValue,
    page_config: &JsValue,
    root_dom: &web_sys::Node,
    document: &Document,
    entry_name: Option<&str>,
    ssr_hydrate_info: Option<&JsValue>,
) -> JsValue {
    append_style_element(style_info, page_config, root_dom, document, entry_name, ssr_hydrate_info)
}

// Export CSS property map functions
#[wasm_bindgen]
pub fn query_css_property_wrapper(index: i32) -> Option<JsValue> {
    query_css_property(index)
}

#[wasm_bindgen]
pub fn query_css_property_number_wrapper(name: &str) -> Option<i32> {
    query_css_property_number(name)
}

// Export tokenizer functions
#[wasm_bindgen]
pub fn tokenize_css_wrapper(input: &str) -> js_sys::Array {
    tokenize_css(input)
}

#[wasm_bindgen]
pub fn parse_css_declarations_wrapper(css_text: &str) -> js_sys::Array {
    parse_css_declarations(css_text)
}

#[wasm_bindgen]
pub fn serialize_css_declarations_wrapper(declarations: &js_sys::Array) -> String {
    serialize_css_declarations(declarations)
}

#[wasm_bindgen]
pub fn transform_inline_style_string_tokenizer(input: &str) -> String {
    transform_inline_style_string(input)
}

#[wasm_bindgen]
pub fn transform_parsed_styles_tokenizer(styles: &js_sys::Array) -> JsValue {
    transform_parsed_styles(styles)
}

// Initialize the module
#[wasm_bindgen(start)]
pub fn init() {
  console_log!("web-mainthread-apis Rust module initialized with complete TypeScript replacement");
}
