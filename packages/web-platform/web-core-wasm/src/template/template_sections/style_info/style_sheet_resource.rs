/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::decoded_style_data::DecodedStyleData;

pub struct StyleSheetResource {
  pub(crate) style_content_element: Option<web_sys::Element>,
  pub(crate) font_face_element: Option<web_sys::Element>,
  pub(crate) css_og_css_id_to_class_selector_name_to_declarations_map:
    Option<super::CssOgCssIdToClassSelectorNameToDeclarationsMap>,
}

impl StyleSheetResource {
  pub fn new(
    buffer: js_sys::Uint8Array,
    document: &web_sys::Document,
  ) -> Result<StyleSheetResource, wasm_bindgen::JsError> {
    let decoded_style_data: DecodedStyleData = buffer.try_into()?;
    let style_content_element = if let Some(style_content) = decoded_style_data.style_content {
      let style_content_element = document.create_element("style").map_err(|e| {
        wasm_bindgen::JsError::new(&format!("Failed to create style element: {e:?}"))
      })?;
      style_content_element.set_text_content(Some(&style_content));
      Some(style_content_element)
    } else {
      None
    };
    let font_face_element = if let Some(font_face_content) = decoded_style_data.font_face_content {
      let style_content_element = document.create_element("style").map_err(|e| {
        wasm_bindgen::JsError::new(&format!("Failed to create style element: {e:?}"))
      })?;
      style_content_element.set_text_content(Some(&font_face_content));
      Some(style_content_element)
    } else {
      None
    };
    Ok(Self {
      style_content_element,
      font_face_element,
      css_og_css_id_to_class_selector_name_to_declarations_map: decoded_style_data
        .css_og_css_id_to_class_selector_name_to_declarations_map,
    })
  }

  pub(crate) fn query_css_og_declarations_by_css_id(
    &self,
    css_id: i32,
    class_name: Vec<String>,
  ) -> String {
    let mut result = String::new();
    if let Some(map) = &self.css_og_css_id_to_class_selector_name_to_declarations_map {
      if let Some(class_selector_map) = map.get(&css_id) {
        for class_name in class_name.iter() {
          if let Some(declarations) = class_selector_map.get(class_name) {
            result.push_str(declarations);
          }
        }
      }
    }
    result
  }
}
