use super::MainThreadGlobalThis;
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
  pub fn get_component_id(&self, unique_id: i32) -> Option<String> {
    self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow()
      .component_id
      .clone()
  }

  #[wasm_bindgen(js_name = "__GetElementConfig")]
  pub fn get_element_config(&self, unique_id: i32) -> Option<js_sys::Object> {
    self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow()
      .component_config
      .clone()
  }

  #[wasm_bindgen(js_name = "__SetConfig")]
  /**
   * key: String
   * value: stringifyed js value
   */
  pub fn set_config(&self, unique_id: i32, config: &js_sys::Object) {
    self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut()
      .component_config = Some(config.clone());
  }

  #[wasm_bindgen(js_name = "__GetConfig")]
  pub fn get_config(&self, unique_id: i32) -> Option<js_sys::Object> {
    self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow()
      .component_config
      .clone()
  }

  #[wasm_bindgen(js_name = "__UpdateComponentID")]
  pub fn update_component_id(&self, unique_id: i32, component_id: &str) {
    self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut()
      .component_id = Some(component_id.to_string());
  }

  #[wasm_bindgen(js_name = "__UpdateComponentInfo")]
  pub fn update_component_info(&mut self, unique_id: i32, component_info: wasm_bindgen::JsValue) {
    let component_info =
      serde_wasm_bindgen::from_value::<ComponentInfoParams>(component_info).unwrap();
    {
      let mut element_data = self
        .unique_id_to_element_map
        .get(&unique_id)
        .unwrap()
        .borrow_mut();
      element_data.component_id = component_info.component_id.clone();
      let dom = &element_data.dom_ref;
      if let Some(name) = component_info.name {
        let _ = dom.set_attribute("name", &name);
      } else {
        let _ = dom.remove_attribute("name");
      }
      if let Some(entry) = component_info.entry {
        let _ = dom.set_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE, &entry);
      } else {
        let _ = dom.remove_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE);
      }
    }
    if let Some(css_id) = component_info.css_id {
      self.set_css_id(vec![unique_id], css_id);
    }
  }

  #[wasm_bindgen(js_name = "__AddConfig")]
  pub fn add_config(
    &mut self,
    unique_id: i32,
    type_: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) {
    let mut element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut();
    if element_data.component_config.is_none() {
      element_data.component_config = Some(js_sys::Object::new());
    }
    let config = element_data.component_config.as_ref().unwrap();
    js_sys::Reflect::set(config, type_, value).unwrap();
  }
}
