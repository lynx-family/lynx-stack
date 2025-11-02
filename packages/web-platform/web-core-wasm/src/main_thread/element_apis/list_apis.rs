use super::element::LynxElement;
use super::mts_global_this::MainThreadGlobalThis;
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
struct InsertAction {
  position: i32,
}

#[derive(Deserialize)]
struct RemoveAction {
  position: i32,
}

#[derive(Deserialize)]
struct UpdateListInfoValue {
  #[serde(rename = "insertAction", skip_serializing)]
  insert_actions: Vec<InsertAction>,
  #[serde(rename = "removeAction", skip_serializing)]
  remove_actions: Vec<RemoveAction>,
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__CreateList")]
  pub fn create_list(
    &mut self,
    parent_component_unique_id: i32,
    component_at_index: wasm_bindgen::JsValue,
    enqueue_component: wasm_bindgen::JsValue,
  ) -> LynxElement {
    let mut element = self.create_element_impl("list", parent_component_unique_id, None, None);
    self.update_list_callbacks(&mut element, component_at_index, enqueue_component);
    element
  }

  #[wasm_bindgen(js_name = "__UpdateListCallbacks")]
  pub fn update_list_callbacks(
    &self,
    element: &mut LynxElement,
    component_at_index: wasm_bindgen::JsValue,
    enqueue_component: wasm_bindgen::JsValue,
  ) {
    let mut data = element.data.borrow_mut();
    data.component_at_index = Some(component_at_index);
    data.enqueue_component = Some(enqueue_component);
  }
}

impl MainThreadGlobalThis {
  pub(crate) fn handle_update_list_info_attribute(
    &mut self,
    element: &LynxElement,
    value: wasm_bindgen::JsValue,
  ) {
    // make sure the value is an object
    if value.is_object() {
      let list_info: UpdateListInfoValue = serde_wasm_bindgen::from_value(value).unwrap();
      let element_data = element.data.borrow();
      let unique_id = JsValue::from(element_data.unique_id);
      if let Some(component_at_index) = &element_data.component_at_index {
        // check it is a function
        if component_at_index.is_function() {
          // convert it to js_sys::Function
          let component_at_index: js_sys::Function = component_at_index.clone().into();
          for insert_action in list_info.insert_actions.iter() {
            let this = JsValue::NULL;
            let position = JsValue::from(insert_action.position);
            let _ = component_at_index.call5(
              &this,
              &element.clone().into(),
              &unique_id,
              &position,
              &JsValue::from(0),
              &JsValue::FALSE,
            );
          }
        }
      }
      if let Some(enqueue_component) = &element_data.enqueue_component {
        // check it is a function
        if enqueue_component.is_function() {
          // convert it to js_sys::Function
          let enqueue_component: js_sys::Function = enqueue_component.clone().into();
          for remove_action in list_info.remove_actions.iter() {
            let this = JsValue::NULL;
            let position = JsValue::from(remove_action.position);
            let _ = enqueue_component.call3(&this, &element.clone().into(), &unique_id, &position);
          }
        }
      }
    }
  }
}
