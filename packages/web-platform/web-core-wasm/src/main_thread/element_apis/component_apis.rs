use super::MainThreadWasmContext;
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
  pub fn update_component_id(&self, unique_id: usize, component_id: Option<String>) {
    self
      .get_element_data_by_unique_id(unique_id)
      .unwrap()
      .borrow_mut()
      .component_id = component_id;
  }
}
