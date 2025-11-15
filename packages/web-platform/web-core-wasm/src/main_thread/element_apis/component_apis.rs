use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
pub struct ComponentInfoParams {
  #[serde(rename = "componentID")]
  component_id: Option<String>,
  name: Option<String>,
  // path: Option<String>,
  entry: Option<String>,
  #[serde(rename = "cssID")]
  css_id: Option<i32>,
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__GetComponentID")]
  pub fn get_component_id(&self, element: &LynxElement) -> Option<String> {
    element.get_component_id()
  }

  #[wasm_bindgen(js_name = "__GetElementConfig")]
  pub fn get_element_config(&self, element: &LynxElement) -> Option<js_sys::Object> {
    element.get_element_config()
  }

  #[wasm_bindgen(js_name = "__SetConfig")]
  /**
   * key: String
   * value: stringifyed js value
   */
  pub fn set_config(&self, element: &mut LynxElement, config: &js_sys::Object) {
    // convert Object to HashMap<String, String>, we should stringify the values
    // traverse the object properties
    element.set_element_config(config);
  }

  #[wasm_bindgen(js_name = "__GetConfig")]
  pub fn get_config(&self, element: &LynxElement) -> Option<js_sys::Object> {
    element.get_element_config()
  }

  #[wasm_bindgen(js_name = "__UpdateComponentID")]
  pub fn update_component_id(&self, element: &mut LynxElement, component_id: &str) {
    element.set_component_id(Some(component_id.to_string()));
  }

  #[wasm_bindgen(js_name = "__UpdateComponentInfo")]
  pub fn update_component_info(
    &self,
    element: &mut LynxElement,
    component_info: wasm_bindgen::JsValue,
  ) {
    let component_info =
      serde_wasm_bindgen::from_value::<ComponentInfoParams>(component_info).unwrap();
    element.set_component_id(component_info.component_id);
    if let Some(css_id) = component_info.css_id {
      if css_id != element.get_css_id() {
        element.set_css_id(css_id);
      }
    }
    if let Some(name) = component_info.name {
      let _ = element.set_or_remove_attribute("name", Some(&name));
    }
    if let Some(entry) = component_info.entry {
      let _ = element.set_or_remove_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE, Some(&entry));
    }
  }

  #[wasm_bindgen(js_name = "__AddConfig")]
  pub fn add_config(
    &mut self,
    element: &mut LynxElement,
    type_: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) {
    element.set_element_config_by_key(type_, value);
  }
}
