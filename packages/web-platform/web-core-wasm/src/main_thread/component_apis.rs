use std::collections::HashMap;

use super::element::{ConfigValue, LynxElement};
use super::mts_global_this::MainThreadGlobalThis;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__GetComponentID")]
  pub fn get_component_id(&self, element: &LynxElement) -> Option<String> {
    element.data.borrow().component_id.clone()
  }

  #[wasm_bindgen(js_name = "__GetElementConfig")]
  pub fn get_element_config(&self, element: &LynxElement) -> wasm_bindgen::JsValue {
    let element_config = &element.data.borrow().component_config;
    if let Some(config) = element_config {
      let entries: js_sys::Array = js_sys::Array::from_iter(config.iter().map(|(key, value)| {
        let value: wasm_bindgen::JsValue = value.as_js_value().clone();
        js_sys::Array::from_iter(vec![wasm_bindgen::JsValue::from_str(key), value.into()])
      }));
      js_sys::Object::from_entries(&entries).unwrap().into()
    } else {
      wasm_bindgen::JsValue::UNDEFINED
    }
  }

  #[wasm_bindgen(js_name = "__SetConfig")]
  /**
   * key: String
   * value: stringifyed js value
   */
  pub fn set_config(&self, element: &LynxElement, config: &js_sys::Object) {
    let mut element_data = element.data.borrow_mut();
    // convert Object to HashMap<String, String>, we should stringify the values
    // traverse the object properties
    element_data.component_config.take();

    let new_component_config = js_sys::Object::entries(config)
      .iter()
      .map(|entry| {
        let entry_array: js_sys::Array = entry.into();
        let key = entry_array.get(0).as_string().unwrap();
        let value = entry_array.get(1);
        (key, ConfigValue::new(&value))
      })
      .collect();
    element_data.component_config = Some(new_component_config);
  }

  #[wasm_bindgen(js_name = "__UpdateComponentID")]
  pub fn update_component_id(&self, element: &LynxElement, component_id: &str) {
    let mut element_data = element.data.borrow_mut();
    element_data.component_id = Some(component_id.to_string());
  }
}
