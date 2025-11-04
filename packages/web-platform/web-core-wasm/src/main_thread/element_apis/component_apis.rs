use super::{ConfigValue, LynxElement, MainThreadGlobalThis};
use crate::constants;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
pub struct ComponentInfoParams {
  #[serde(rename = "componentID")]
  component_id: Option<String>,
  name: Option<String>,
  path: Option<String>,
  entry: Option<String>,
  #[serde(rename = "cssID")]
  css_id: Option<i32>,
}

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

  #[wasm_bindgen(js_name = "__UpdateComponentInfo")]
  pub fn update_component_info(
    &self,
    element: &LynxElement,
    component_info: wasm_bindgen::JsValue,
  ) {
    let component_info =
      serde_wasm_bindgen::from_value::<ComponentInfoParams>(component_info).unwrap();
    let mut element_data = element.data.borrow_mut();
    element_data.component_id = component_info.component_id;
    if let Some(css_id) = component_info.css_id {
      if css_id != element_data.css_id {
        element_data.css_id = css_id;
        let dom = element_data.dom_ref.as_ref().unwrap();
        let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
      }
    }
    if let Some(name) = component_info.name {
      let dom = element_data.dom_ref.as_ref().unwrap();
      let _ = dom.set_attribute("name", &name);
    }
  }
}
