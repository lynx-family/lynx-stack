/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use crate::constants;
use crate::template::template_sections::style_info::StyleSheetResource;
use fnv::FnvHashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;
use web_sys::{CssStyleSheet, HtmlStyleElement, Node};

pub struct StyleManager {
  root_node: Node,
  css_query_map_by_entry_name: FnvHashMap<String, StyleSheetResource>,
  css_og_style_sheet: Option<CssStyleSheet>,
  unique_id_to_style_declarations_map: Option<FnvHashMap<usize, web_sys::CssStyleDeclaration>>,
}

impl StyleManager {
  pub fn new(root_node: Node) -> StyleManager {
    StyleManager {
      root_node,
      css_query_map_by_entry_name: FnvHashMap::default(),
      css_og_style_sheet: None,
      unique_id_to_style_declarations_map: None,
    }
  }

  pub fn update_css_og_style(
    &mut self,
    unique_id: usize,
    css_id: i32,
    class_names: Vec<String>,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    let entry_name = entry_name.as_deref().unwrap_or("__Card__");
    let new_declarations = if let Some(resource) = self.css_query_map_by_entry_name.get(entry_name)
    {
      resource.query_css_og_declarations_by_css_id(css_id, class_names)
    } else {
      String::new()
    };

    if self.css_og_style_sheet.is_none() {
      let document = self
        .root_node
        .owner_document()
        .ok_or(JsError::new("No owner document"))?;
      let css_og_style_element = document
        .create_element("style")
        .map_err(|e| JsError::new(&format!("Failed to create style element: {e:?}")))?;
      self
        .root_node
        .append_child(&css_og_style_element)
        .map_err(|e| JsError::new(&format!("Failed to append child: {e:?}")))?;
      let sheet = css_og_style_element
        .unchecked_into::<HtmlStyleElement>()
        .sheet();
      self.css_og_style_sheet = sheet.map(|s| s.unchecked_into::<CssStyleSheet>());
    }

    if let Some(sheet) = &self.css_og_style_sheet {
      if self.unique_id_to_style_declarations_map.is_none() {
        self.unique_id_to_style_declarations_map = Some(FnvHashMap::default());
      }
      let map = self
        .unique_id_to_style_declarations_map
        .as_mut()
        .ok_or(JsError::new("Failed to get style declarations map"))?;

      if let Some(style_declaration) = map.get(&unique_id) {
        style_declaration.set_css_text(&new_declarations);
      } else if !new_declarations.is_empty() {
        let rule_index = sheet
          .insert_rule_with_index(
            &format!(
              "[{}=\"{unique_id}\"] {{{new_declarations}}}",
              constants::LYNX_UNIQUE_ID_ATTRIBUTE
            ),
            sheet
              .css_rules()
              .map_err(|e| JsError::new(&format!("Failed to get css rules: {e:?}")))?
              .length(),
          )
          .map_err(|e| JsError::new(&format!("Failed to insert rule: {e:?}")))?;
        let rule = sheet
          .css_rules()
          .map_err(|e| JsError::new(&format!("Failed to get css rules: {e:?}")))?
          .item(rule_index)
          .ok_or(JsError::new("Failed to get rule"))?;
        map.insert(
          unique_id,
          rule.unchecked_into::<web_sys::CssStyleRule>().style(),
        );
      }
    }

    Ok(())
  }

  pub fn push_style_sheet(
    &mut self,
    resource: &StyleSheetResource,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    let entry_key = entry_name.clone().unwrap_or_else(|| "__Card__".to_string());

    if let Some(style_element) = &resource.style_content_element {
      let new_style_element = style_element
        .clone_node_with_deep(true)
        .map_err(|e| JsError::new(&format!("Failed to clone style element: {e:?}")))?
        .unchecked_into::<HtmlStyleElement>();

      if let Some(name) = &entry_name {
        new_style_element
          .set_attribute("name", name)
          .map_err(|e| JsError::new(&format!("Failed to set attribute: {e:?}")))?;
      }
      self
        .root_node
        .append_child(&new_style_element)
        .map_err(|e| JsError::new(&format!("Failed to append child: {e:?}")))?;
    }

    if let Some(font_face_element) = &resource.font_face_element {
      let new_font_face_element = font_face_element
        .clone_node_with_deep(true)
        .map_err(|e| JsError::new(&format!("Failed to clone font face element: {e:?}")))?
        .unchecked_into::<HtmlStyleElement>();

      if let Some(name) = &entry_name {
        new_font_face_element
          .set_attribute("name", name)
          .map_err(|e| JsError::new(&format!("Failed to set attribute: {e:?}")))?;
      }
      if let Some(parent) = self.root_node.parent_element() {
        parent
          .append_child(&new_font_face_element)
          .map_err(|e| JsError::new(&format!("Failed to append child: {e:?}")))?;
      }
    }

    self
      .css_query_map_by_entry_name
      .insert(entry_key, resource.clone());
    Ok(())
  }
}
