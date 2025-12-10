/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::MainThreadWasmContext;
use crate::constants;
use crate::style_transformer::{query_transform_rules, transform_inline_style_string};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen(js_name = "__wasm_set_css_id")]
  pub fn set_css_id(&mut self, elements_unique_id: Vec<usize>, css_id: i32) {
    for unique_id in elements_unique_id.iter() {
      {
        let element_data_cell = self.get_element_data_by_unique_id(*unique_id).unwrap();
        let mut element_data = element_data_cell.borrow_mut();
        element_data.css_id = css_id;
      }
    }
  }

  #[wasm_bindgen(js_name = "__wasm_update_css_og_style")]
  pub fn update_css_og_style(&mut self, unique_id: usize, dom: &web_sys::HtmlElement) {
    if let Some(element_data_cell) = self.unique_id_to_element_map.get(unique_id) {
      if let Some(element_data_cell) = element_data_cell.as_ref() {
        let element_data = element_data_cell.borrow();
        let class_list: Vec<String> = dom
          .class_list()
          .values()
          .into_iter()
          .filter_map(|v| v.unwrap().as_string())
          .collect();
        let css_id = element_data.css_id;
        let entry_name = if let Some(name) = dom.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE)
        {
          name
        } else {
          "".to_string()
        };
        self
          .style_manager
          .update_css_og_style(unique_id, css_id, &entry_name, &class_list);
      }
    }
  }

  #[wasm_bindgen(js_name = "__wasm_AddInlineStyle_str_key")]
  /**
   * The key could be string or number
   * The value could be string or number or null or undefined
   */
  pub fn add_inline_style_raw_string_key(
    &self,
    dom: &web_sys::HtmlElement,
    key: String,
    value: Option<String>,
  ) {
    if let Some(value) = value {
      let (transformed, _) = query_transform_rules(&key, &value);
      let style = dom.style();
      if transformed.is_empty() {
        style.set_property(&key, &value).unwrap();
      } else {
        for (k, v) in transformed.iter() {
          style.set_property(k, v).unwrap();
        }
      }
    } else {
      dom.style().remove_property(&key).unwrap();
    }
  }

  #[wasm_bindgen(js_name = "__wasm_AddInlineStyle_number_key")]
  pub fn set_inline_styles_number_key(
    &self,
    dom: &web_sys::HtmlElement,
    key: i32,
    value: Option<String>,
  ) {
    if let Some(style_property) = constants::STYLE_PROPERTY_MAP.get(key as usize) {
      self.add_inline_style_raw_string_key(dom, style_property.to_string(), value.clone());
    }
  }

  #[wasm_bindgen(js_name = "__wasm_SetInlineStyles")]
  pub fn set_inline_styles_in_str(&self, dom: &web_sys::HtmlElement, styles: String) {
    let transformed_style_str = transform_inline_style_string(&styles);
    let _ = dom.set_attribute("style", &transformed_style_str);
  }
}
