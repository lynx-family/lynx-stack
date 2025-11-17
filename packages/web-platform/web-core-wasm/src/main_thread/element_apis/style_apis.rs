use super::super::style::{
  transform_declarations, transform_inline_style_string, STYLE_PROPERTY_MAP,
};
use super::{set_css_id_status, LynxElement, MainThreadGlobalThis};
use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__wasm_binding_update_css_id")]
  pub fn set_css_id(&mut self, elements_unique_id: Vec<i32>, css_id: i32) {
    for unique_id in elements_unique_id.iter() {
      {
        let mut element_data = self
          .unique_id_to_element_map
          .get(unique_id)
          .unwrap()
          .borrow_mut();
        set_css_id_status(&mut element_data, css_id);
      }
      if !self.config_enable_css_selector {
        self.update_css_og_style(*unique_id);
      }
    }
  }

  #[wasm_bindgen(js_name = "__wasm_binding_update_css_og_style")]
  pub fn update_css_og_style(&mut self, unique_id: i32) {
    if let Some(element_data_cell) = self.unique_id_to_element_map.get(&unique_id) {
      let element_data = element_data_cell.borrow();
      let dom = &element_data.dom_ref;
      let class_list: Vec<String> = dom
        .class_list()
        .values()
        .into_iter()
        .filter_map(|v| v.unwrap().as_string())
        .collect();
      let css_id = element_data.css_id;
      let entry_name = if let Some(name) = dom.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE) {
        name
      } else {
        "".to_string()
      };
      self
        .style_manager
        .update_css_og_style(unique_id, css_id, &entry_name, &class_list);
    }
  }

  #[wasm_bindgen(js_name = "__wasm_binding_AddInlineStyle_str_key")]
  /**
   * The key could be string or number
   * The value could be string or number or null or undefined
   */
  pub fn add_inline_style_raw_string_key(
    &self,
    unique_id: i32,
    key: String,
    value: Option<String>,
  ) {
    let dom = &self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow()
      .dom_ref;
    if let Some(value) = value {
      let declarations = vec![(key, value)];
      let (transformed, _) = transform_declarations(&declarations);
      let style = dom.style();
      for (k, v) in transformed.iter() {
        style.set_property(k, v).unwrap();
      }
    } else {
      dom.style().remove_property(&key).unwrap();
    }
  }

  #[wasm_bindgen(js_name = "__wasm_binding_AddInlineStyle_number_key")]
  pub fn set_inline_styles_number_key(&self, unique_id: i32, key: i32, value: Option<String>) {
    if let Some(style_property) = STYLE_PROPERTY_MAP.get(key as usize) {
      self.add_inline_style_raw_string_key(unique_id, style_property.to_string(), value.clone());
    }
  }

  #[wasm_bindgen(js_name = "__wasm_binding_SetInlineStyles")]
  pub fn set_inline_styles_in_str(&self, unique_id: i32, styles: String) {
    let dom = &self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow()
      .dom_ref;
    if styles.is_empty() {
      let _ = dom.remove_attribute("style");
      return;
    }
    let (transformed_style_str, _) = transform_inline_style_string(&styles);
    let _ = dom.set_attribute("style", &transformed_style_str);
  }
}
