use super::MainThreadWasmContext;
use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen(js_name = "__GetComponentID")]
  pub fn get_component_id(&self, unique_id: usize) -> Option<String> {
    self
      .get_element_data_by_unique_id(unique_id)
      .unwrap()
      .borrow()
      .component_id
      .clone()
  }

  #[wasm_bindgen(js_name = "__GetElementConfig")]
  pub fn get_element_config(&self, unique_id: usize) -> Option<js_sys::Object> {
    self
      .get_element_data_by_unique_id(unique_id)
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
  pub fn set_config(&self, unique_id: usize, config: &js_sys::Object) {
    self
      .get_element_data_by_unique_id(unique_id)
      .unwrap()
      .borrow_mut()
      .component_config = Some(config.clone());
  }

  #[wasm_bindgen(js_name = "__GetConfig")]
  pub fn get_config(&self, unique_id: usize) -> js_sys::Object {
    let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
    let mut element_data = binding.borrow_mut();
    if let Some(config) = &element_data.component_config {
      config.clone()
    } else {
      let js_obj = js_sys::Object::new();
      element_data.component_config = Some(js_obj.clone());
      js_obj
    }
  }

  #[wasm_bindgen(js_name = "__UpdateComponentID")]
  pub fn update_component_id(&self, unique_id: usize, component_id: &str) {
    self
      .get_element_data_by_unique_id(unique_id)
      .unwrap()
      .borrow_mut()
      .component_id = Some(component_id.to_string());
  }

  #[wasm_bindgen(js_name = "__UpdateComponentInfo")]
  pub fn update_component_info(
    &mut self,
    unique_id: usize,
    component_id: Option<String>,
    name: Option<String>,
    entry_name: Option<String>,
    css_id: Option<i32>,
  ) {
    {
      let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
      let mut element_data = binding.borrow_mut();
      element_data.component_id = component_id.clone();
      let dom = &element_data.dom_ref;
      if let Some(name) = name {
        let _ = dom.set_attribute("name", &name);
      } else {
        let _ = dom.remove_attribute("name");
      }
      if let Some(entry_name) = entry_name {
        let _ = dom.set_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE, &entry_name);
      } else {
        let _ = dom.remove_attribute(constants::LYNX_ENTRY_NAME_ATTRIBUTE);
      }
    }
    if let Some(css_id) = css_id {
      self.set_css_id(vec![unique_id], css_id);
    }
  }
}
