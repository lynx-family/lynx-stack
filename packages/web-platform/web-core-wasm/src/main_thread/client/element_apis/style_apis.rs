/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::MainThreadWasmContext;
use crate::constants;
use crate::style_transformer::{
  query_transform_rules, transform_inline_style_key_value_vec, transform_inline_style_string,
};
use crate::template::template_sections::style_info::css_property::CSSProperty;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadWasmContext {
  pub fn set_css_id(
    &mut self,
    elements_unique_id: Vec<usize>,
    css_id: i32,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    for unique_id in elements_unique_id.into_iter() {
      {
        let element = self.unique_id_to_dom_map.get(&unique_id).expect_throw("El");
        if let Some(entry_name) = &entry_name {
          let _ = element.set_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE, entry_name);
        }
        if css_id != 0 {
          let _ = element.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
        } else {
          let _ = element.remove_attribute(constants::CSS_ID_ATTRIBUTE);
        }
        {
          let element_data_cell = self.get_element_data_by_unique_id(unique_id).unwrap_throw();
          let mut element_data = element_data_cell.borrow_mut();
          element_data.css_id = css_id;
        }
        if !self.config_enable_css_selector {
          self.update_css_og_style(unique_id, entry_name.clone())?;
        }
      }
    }
    Ok(())
  }

  pub fn update_css_og_style(
    &mut self,
    unique_id: usize,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    let element = self.unique_id_to_dom_map.get(&unique_id).expect_throw("El");
    let element_data_cell = self.get_element_data_by_unique_id(unique_id).unwrap_throw();
    let element_data = element_data_cell.borrow_mut();
    self.style_manager.update_css_og_style(
      unique_id,
      element_data.css_id,
      self.mts_binding.get_class_name_list(element),
      entry_name,
    )?;
    Ok(())
  }
}

#[wasm_bindgen]
/**
 * The key could be string or number
 * The value could be string or number or null or undefined
 */
pub fn add_inline_style_raw_string_key(
  dom: &web_sys::HtmlElement,
  key: &str,
  value: Option<String>,
) {
  if let Some(value) = value {
    let property_id: CSSProperty = key.into();
    let (transformed, _) = query_transform_rules(&property_id, &value);
    let style = dom.style();
    if transformed.is_empty() {
      let _ = style.set_property(key, &value);
    } else {
      for (k, v) in transformed.iter() {
        let _ = style.set_property(k, v);
      }
    }
  } else {
    let _ = dom.style().remove_property(key);
  }
}

#[wasm_bindgen]
pub fn set_inline_styles_number_key(dom: &web_sys::HtmlElement, key: usize, value: Option<String>) {
  let property_id: CSSProperty = key.into();
  if let Some(value) = value {
    let (transformed, _) = query_transform_rules(&property_id, &value);
    let style = dom.style();
    if transformed.is_empty() {
      let _ = style.set_property(&property_id.to_string(), &value);
    } else {
      for (k, v) in transformed.iter() {
        let _ = style.set_property(k, v);
      }
    }
  } else {
    let _ = dom.style().remove_property(&property_id.to_string());
  }
}
#[wasm_bindgen]
pub fn set_inline_styles_in_str(dom: &web_sys::HtmlElement, styles: String) -> bool {
  let transformed_style_str = transform_inline_style_string(&styles);
  // we compare the transformed style string with the original one
  // The reason is copy utf-8 string from wasm to js is expensive
  if transformed_style_str == styles {
    return false;
  }
  let _ = dom.set_attribute("style", &transformed_style_str);
  true
}

#[wasm_bindgen]
pub fn get_inline_styles_in_key_value_vec(dom: &web_sys::HtmlElement, k_v_vec: Vec<String>) {
  let transformed_style_str = transform_inline_style_key_value_vec(k_v_vec);
  let _ = dom.set_attribute("style", &transformed_style_str);
}
