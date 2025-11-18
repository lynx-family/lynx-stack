use super::MainThreadGlobalThis;
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
  #[wasm_bindgen(js_name = "__SetDataset")]
  pub fn set_dataset(&mut self, unique_id: i32, new_dataset: &js_sys::Object) {
    let mut element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut();
    let dom = element_data.dom_ref.clone();
    let dataset = element_data.dataset.get_or_insert_with(js_sys::Object::new);
    // compare old dataset and new dataset and update dom attributes
    let old_keys = js_sys::Object::keys(dataset);
    let new_keys = js_sys::Object::keys(new_dataset);
    // remove old keys not in new dataset
    for i in 0..old_keys.length() {
      let key = old_keys.get(i);
      if !js_sys::Reflect::has(new_dataset, &key).unwrap_or(false) {
        let key_str = key.as_string().unwrap();
        let _ = dom.remove_attribute(&format!("data-{key_str}"));
      }
    }
    // set/ update new keys
    for i in 0..new_keys.length() {
      let key = new_keys.get(i);
      let new_value =
        js_sys::Reflect::get(new_dataset, &key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
      let old_value =
        js_sys::Reflect::get(dataset, &key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
      if old_value != new_value {
        let key_str = key.as_string().unwrap();
        if new_value.is_undefined() || new_value.is_null() {
          let _ = dom.remove_attribute(&format!("data-{key_str}"));
        } else {
          let value_str = new_value.as_string().unwrap_or_default();
          let _ = dom.set_attribute(&format!("data-{key_str}"), &value_str);
        }
      }
    }
    element_data.dataset = Some(new_dataset.clone());
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
