/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::style_manager_server::StyleManagerServer;
use crate::main_thread::element_data::LynxElementData;
use crate::style_transformer::{query_transform_rules, transform_inline_style_string};
use crate::template::template_sections::style_info::css_property::CSSProperty;
use crate::template::template_sections::style_info::StyleSheetResource;
// use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadServerContext {
  elements: Vec<Option<LynxElementData>>,
  style_manager: StyleManagerServer,
}

#[wasm_bindgen]
impl MainThreadServerContext {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    Self {
      elements: Vec::new(),
      style_manager: StyleManagerServer::new(),
    }
  }

  pub fn push_style_sheet(
    &mut self,
    resource: &StyleSheetResource,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    self
      .style_manager
      .push_style_sheet(resource, entry_name)
      .map_err(|e| JsError::new(&e))
  }

  pub fn update_css_og_style(
    &mut self,
    unique_id: usize,
    css_id: i32,
    class_names: Vec<String>,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    self
      .style_manager
      .update_css_og_style(unique_id, css_id, class_names, entry_name)
      .map_err(|e| JsError::new(&e))
  }

  pub fn get_page_css(&self) -> String {
    self.style_manager.get_css_string()
  }

  pub fn create_element(&mut self, tag_name: String) -> usize {
    let id = self.elements.len();
    let element = LynxElementData::new_with_tag_name(0, 0, None, tag_name);
    self.elements.push(Some(element));
    id
  }

  pub fn append_child(&mut self, parent_id: usize, child_id: usize) {
    if let Some(Some(parent)) = self.elements.get_mut(parent_id) {
      parent.append_child(child_id);
      // If parent is not set yet (implicit root?) - we might need to handle root logic,
      // but usually the caller manages the structure.
    }
  }

  pub fn set_attribute(&mut self, element_id: usize, key: String, value: String) {
    if let Some(Some(element)) = self.elements.get_mut(element_id) {
      if key == "style" {
        let transformed = transform_inline_style_string(&value);
        element.set_attribute(key, transformed);
      } else {
        element.set_attribute(key, value);
      }
    }
  }

  pub fn set_style(&mut self, element_id: usize, key: String, value: String) {
    if let Some(Some(element)) = self.elements.get_mut(element_id) {
      let property_id: CSSProperty = key.as_str().into();
      let (transformed, _) = query_transform_rules(&property_id, &value);
      if transformed.is_empty() {
        element.set_style(key, value);
      } else {
        for (k, v) in transformed {
          element.set_style(k.to_string(), v.to_string());
        }
      }
    }
  }

  pub fn generate_html_segment(&self, element_id: usize) -> String {
    let mut buffer = String::with_capacity(1024);
    self.render_element(element_id, &mut buffer);
    buffer
  }

  pub fn add_class(&mut self, element_id: usize, class_name: String) {
    if let Some(Some(element)) = self.elements.get_mut(element_id) {
      let classes_attr = element.attributes.entry("class".to_string()).or_default();
      let exists = classes_attr.split_whitespace().any(|c| c == class_name);
      if !exists {
        if !classes_attr.is_empty() {
          classes_attr.push(' ');
        }
        classes_attr.push_str(&class_name);
      }
    }
  }
}

impl MainThreadServerContext {
  fn render_element(&self, root_id: usize, buffer: &mut String) {
    enum Action {
      Open(usize),
      Close(usize),
    }

    let mut stack = vec![Action::Open(root_id)];

    while let Some(action) = stack.pop() {
      match action {
        Action::Open(element_id) => {
          if let Some(Some(element)) = self.elements.get(element_id) {
            buffer.push('<');
            buffer.push_str(&element.tag_name);

            // Attributes
            for (key, value) in &element.attributes {
              buffer.push(' ');
              buffer.push_str(key);
              buffer.push_str("=\"");
              buffer.push_str(value); // TODO: Escape value
              buffer.push('"');
            }

            buffer.push('>');

            stack.push(Action::Close(element_id));

            for child_id in element.children.iter().rev() {
              stack.push(Action::Open(*child_id));
            }
          }
        }
        Action::Close(element_id) => {
          if let Some(Some(element)) = self.elements.get(element_id) {
            buffer.push_str("</");
            buffer.push_str(&element.tag_name);
            buffer.push('>');
          }
        }
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_html_generation() {
    let mut ctx = MainThreadServerContext::new();

    // Create <div>
    let div_id = ctx.create_element("div".to_string());
    ctx.set_attribute(div_id, "id".to_string(), "container".to_string());
    ctx.set_style(div_id, "color".to_string(), "red".to_string());

    // Create <span> child
    let span_id = ctx.create_element("span".to_string());
    ctx.set_attribute(span_id, "class".to_string(), "text".to_string());
    ctx.append_child(div_id, span_id);

    let html = ctx.generate_html_segment(div_id);

    // Check structural correctness (attributes/style order might vary in HashMaps)
    assert!(html.starts_with("<div"));
    assert!(html.contains("id=\"container\""));
    assert!(html.contains("style=\"")); // checks for style attribute presence
    assert!(html.contains("color:red;"));
    assert!(html.contains("<span"));
    assert!(html.contains("class=\"text\""));
    assert!(html.ends_with("</span></div>"));

    // Verify initial CSS is empty
    assert_eq!(ctx.get_page_css(), "");
  }
}
