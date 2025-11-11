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

  #[wasm_bindgen(js_name = "__AddInlineStyle")]
  /**
   * The key could be string or number
   * The value could be string or number or null or undefined
   */
  pub fn add_inline_style(
    &self,
    element: &LynxElement,
    key: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) {
    // firstly we should map the number back to string
    let key_str: String = if let Some(key) = key.as_string() {
      key
    } else if let Some(num) = key.as_f64() {
      if let Some(key) = STYLE_PROPERTY_MAP.get(&(num as i32)) {
        key.to_string()
      } else {
        panic!("Unsupported key number {num}");
      }
    } else {
      panic!("Unsupported key type for inline style key");
    };
    let dom = element.get_dom();
    if value.is_null_or_undefined() {
      dom.style().remove_property(&key_str).unwrap();
    } else {
      let value_str = if let Some(v) = value.as_string() {
        v
      } else if let Some(num) = value.as_f64() {
        num.to_string()
      } else {
        panic!("Unsupported value type for inline style value");
      };
      // now do the transform
      let declaration = [(key_str, value_str)];
      let (new_declarations, _) = transform_declarations(&declaration);
      for (k, v) in new_declarations.iter() {
        dom.style().set_property(k, v).unwrap();
      }
    }
  }

  #[wasm_bindgen(js_name = "__SetInlineStyles")]
  /**
   * The value could be a map of string/number or null/undefined or a string
   */
  pub fn set_inline_styles(&self, element: &LynxElement, styles: &wasm_bindgen::JsValue) {
    let dom = element.get_dom();
    if styles.is_null_or_undefined() {
      dom.remove_attribute("style").unwrap();
    } else if styles.is_string() {
      let style_str = styles.as_string().unwrap();
      let (transformed_style_str, _) = transform_inline_style_string(&style_str);
      dom.set_attribute("style", &transformed_style_str).unwrap();
    } else {
      let styles: &js_sys::Object = styles.dyn_ref::<js_sys::Object>().unwrap();
      let declarations: Vec<(String, String)> = js_sys::Object::entries(styles)
        .iter()
        .map(|entry| {
          let entry_array: js_sys::Array = entry.into();
          let key = entry_array.get(0).as_string().unwrap();
          let value_js = entry_array.get(1);
          let value = if value_js.is_null_or_undefined() {
            "".to_string()
          } else if let Some(v) = value_js.as_string() {
            v
          } else if let Some(num) = value_js.as_f64() {
            num.to_string()
          } else {
            panic!("Unsupported value type for inline style value");
          };
          (key, value)
        })
        .collect();
      let (new_declarations, _) = transform_declarations(&declarations);
      for (k, v) in new_declarations.iter() {
        dom.style().set_property(k, v).unwrap();
      }
    }
  }

  #[wasm_bindgen(js_name = "__AddClass")]
  pub fn add_class(&self, element: &LynxElement, class_name: &str) {
    let dom = element.get_dom();
    dom.class_list().add_1(class_name).unwrap();
  }
}
