use super::super::style::{
  transform_declarations, transform_inline_style_string, STYLE_PROPERTY_MAP,
};
use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__GetClasses")]
  pub fn get_classes(&self, element: &LynxElement) -> js_sys::Array {
    let dom = element.get_dom();
    let class_list = dom.class_list();
    let array = js_sys::Array::new_with_length(class_list.length());
    for i in 0..class_list.length() {
      if let Some(class) = class_list.item(i) {
        array.set(i, class.into());
      }
    }
    array
  }

  #[wasm_bindgen(js_name = "__SetCSSId")]
  pub fn set_css_id(
    &mut self,
    #[wasm_bindgen(unchecked_param_type = "LynxElement[]")] elements: js_sys::Array,
    css_id: i32,
    entry_name: Option<String>,
  ) {
    let elements = wasm_bindgen_derive::try_from_js_array::<LynxElement>(elements).unwrap();
    for element in elements.iter() {
      element.set_css_id(css_id);
      if let Some(entry_name) = &entry_name {
        if !entry_name.is_empty() {
          let _ = element.set_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE, entry_name);
        }
      }
      if !self.config_enable_css_selector {
        let dom = element.get_dom();
        let class_value: Option<String> = dom.get_attribute("class");
        self.set_classes(element, class_value);
      }
    }
  }

  #[wasm_bindgen(js_name = "__SetClasses")]
  pub fn set_classes(&mut self, element: &LynxElement, classname: Option<String>) {
    let _ = element.set_or_remove_attribute("class", classname.as_deref());
    if !self.config_enable_css_selector {
      let dom = element.get_dom();
      let class_list: Vec<String> = dom
        .class_list()
        .values()
        .into_iter()
        .filter_map(|v| v.ok())
        .filter_map(|v| v.as_string())
        .collect();
      let css_id = element.get_css_id();
      let entry_name = if let Some(name) = dom.get_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE) {
        name
      } else {
        "".to_string()
      };
      let unique_id = element.get_unique_id();
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
    element: &LynxElement,
    key: String,
    value: Option<String>,
  ) {
    let dom = element.get_dom();
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
  pub fn set_inline_styles_number_key(
    &self,
    element: &LynxElement,
    key: i32,
    value: Option<String>,
  ) {
    if let Some(style_property) = STYLE_PROPERTY_MAP.get(key as usize) {
      self.add_inline_style_raw_string_key(element, style_property.to_string(), value.clone());
    }
  }

  #[wasm_bindgen(js_name = "__wasm_binding_SetInlineStyles")]
  pub fn set_inline_styles_in_str(&self, element: &LynxElement, styles: String) {
    let dom = element.get_dom();
    if styles.is_empty() {
      let _ = dom.remove_attribute("style");
      return;
    }
    let (transformed_style_str, _) = transform_inline_style_string(&styles);
    let _ = dom.set_attribute("style", &transformed_style_str);
  }

  #[wasm_bindgen(js_name = "__AddClass")]
  pub fn add_class(&self, element: &LynxElement, class_name: &str) {
    let dom = element.get_dom();
    dom.class_list().add_1(class_name).unwrap();
  }
}
