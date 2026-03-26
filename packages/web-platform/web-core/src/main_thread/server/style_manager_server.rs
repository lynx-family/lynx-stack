/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use crate::constants;
use crate::template::template_sections::style_info::StyleSheetResource;
use fnv::FnvHashMap;

pub struct StyleManagerServer {
  css_query_map_by_entry_name: FnvHashMap<String, StyleSheetResource>,
  global_style_buffer: String,
  unique_id_to_style_declarations_map: FnvHashMap<usize, String>,
}

impl StyleManagerServer {
  pub fn new() -> Self {
    Self {
      css_query_map_by_entry_name: FnvHashMap::default(),
      global_style_buffer: String::new(),
      unique_id_to_style_declarations_map: FnvHashMap::default(),
    }
  }

  pub fn push_style_sheet(
    &mut self,
    resource: &StyleSheetResource,
    entry_name: Option<String>,
  ) -> Result<(), String> {
    let entry_key = entry_name.clone().unwrap_or_else(|| "__Card__".to_string());

    if let Some(content) = &resource.style_content_str {
      self.global_style_buffer.push_str(content);
    }
    if let Some(content) = &resource.font_face_content_str {
      self.global_style_buffer.push_str(content);
    }

    self
      .css_query_map_by_entry_name
      .insert(entry_key, resource.clone());
    Ok(())
  }

  pub fn update_css_og_style(
    &mut self,
    unique_id: usize,
    css_id: i32,
    class_names: Vec<String>,
    entry_name: Option<String>,
  ) -> Result<(), String> {
    let entry_name = entry_name.as_deref().unwrap_or("__Card__");
    let declarations = if let Some(resource) = self.css_query_map_by_entry_name.get(entry_name) {
      resource.query_css_og_declarations_by_css_id(css_id, class_names)
    } else {
      String::new()
    };

    if !declarations.is_empty() {
      // Format: [unique_id="{unique_id}"] { declarations }
      let rule = format!(
        "[{}=\"{unique_id}\"] {{{declarations}}}",
        constants::LYNX_UNIQUE_ID_ATTRIBUTE
      );
      self
        .unique_id_to_style_declarations_map
        .insert(unique_id, rule);
    }

    Ok(())
  }

  pub fn get_css_string(&self) -> String {
    let mut css = self.global_style_buffer.clone();
    for rule in self.unique_id_to_style_declarations_map.values() {
      css.push_str(rule);
    }
    css
  }
}
