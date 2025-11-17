use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
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
  #[wasm_bindgen(js_name = "__wasm_binding_update_list_info")]
  pub fn handle_update_list_info_attribute(
    &mut self,
    unique_id: i32,
    value: wasm_bindgen::JsValue,
  ) {
    // make sure the value is an object
    if value.is_object() {
      let list_info: UpdateListInfoValue = serde_wasm_bindgen::from_value(value).unwrap();
      let dom = &self
        .unique_id_to_element_map
        .get(&unique_id)
        .unwrap()
        .borrow()
        .dom_ref;
      let component_at_index =
        js_sys::Reflect::get(dom, &wasm_bindgen::JsValue::from_str("componentAtIndex")).unwrap();
      let enqueue_component =
        js_sys::Reflect::get(dom, &wasm_bindgen::JsValue::from_str("enqueueComponent")).unwrap();
      // check it is a function
      if component_at_index.is_function() {
        // convert it to js_sys::Function
        let component_at_index: js_sys::Function = component_at_index.clone().into();
        for insert_action in list_info.insert_actions.iter() {
          let this = JsValue::NULL;
          let position = JsValue::from(insert_action.position);
          let _ = component_at_index.call5(
            &this,
            &dom.clone().into(),
            &JsValue::from(unique_id),
            &position,
            &JsValue::from(0),
            &JsValue::FALSE,
          );
        }
      }
      // check it is a function
      if enqueue_component.is_function() {
        // convert it to js_sys::Function
        let enqueue_component: js_sys::Function = enqueue_component.clone().into();
        for remove_action in list_info.remove_actions.iter() {
          let this = JsValue::NULL;
          let position = JsValue::from(remove_action.position);
          let _ = enqueue_component.call3(
            &this,
            &dom.clone().into(),
            &JsValue::from(unique_id),
            &position,
          );
        }
      }
    }
  }

  // #[wasm_bindgen(js_name = "__SetAttribute")]
  // pub fn set_attribute(&mut self, element: &LynxElement, key: &str, value: wasm_bindgen::JsValue) {
  //   let unique_id = element.get_unique_id();
  //   let tag = element.get_tag();
  //   if key == "update-list-info" && tag == "list" {
  //     self.handle_update_list_info_attribute(element, value);
  //   } else if constants::EXPOSURE_RELATED_ATTRIBUTES.contains(key) {
  //     self.exposure_changed_elements.push(unique_id);
  //   } else {
  //     let value_str: Option<String> = if let Some(value) = value.as_string() {
  //       Some(value)
  //     } else if let Some(value_bool) = value.as_bool() {
  //       Some(if value_bool {
  //         "true".to_string()
  //       } else {
  //         "false".to_string()
  //       })
  //     } else {
  //       value.as_f64().map(|value_f64| value_f64.to_string())
  //     };
  //     if key == constants::LYNX_TIMING_FLAG {
  //       if let Some(value_str) = &value_str {
  //         self.timing_flags.push(value_str.clone());
  //       }
  //     } else {
  //       let _ = element.set_or_remove_attribute(key, value_str.as_deref());
  //     }
  //   }

  #[wasm_bindgen(js_name = "__SetDataset")]
  pub fn set_dataset(&mut self, unique_id: i32, dataset: &js_sys::Object) {
    let mut element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut();
    element_data.dataset = Some(dataset.clone());
  }

  #[wasm_bindgen(js_name = "__AddDataset")]
  pub fn add_dataset(
    &mut self,
    unique_id: i32,
    key: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) {
    // get the dataset object, create one if not exists
    let mut element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut();
    let dataset_obj = if let Some(dataset) = element_data.dataset.take() {
      dataset
    } else {
      js_sys::Object::new()
    };
    let _ = js_sys::Reflect::set(&dataset_obj, key, value);
    element_data.dataset = Some(dataset_obj);
  }

  #[wasm_bindgen(js_name = "__GetDataset")]
  pub fn get_dataset(&self, unique_id: i32) -> js_sys::Object {
    let element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow();
    if let Some(dataset) = &element_data.dataset {
      dataset.clone()
    } else {
      js_sys::Object::new()
    }
  }

  #[wasm_bindgen(js_name = "__GetDataByKey")]
  pub fn get_data_by_key(&self, unique_id: i32, key: &str) -> wasm_bindgen::JsValue {
    let element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow();
    if let Some(dataset) = &element_data.dataset {
      if let Ok(value) = js_sys::Reflect::get(dataset, &wasm_bindgen::JsValue::from_str(key)) {
        value
      } else {
        wasm_bindgen::JsValue::UNDEFINED
      }
    } else {
      wasm_bindgen::JsValue::UNDEFINED
    }
  }
}
