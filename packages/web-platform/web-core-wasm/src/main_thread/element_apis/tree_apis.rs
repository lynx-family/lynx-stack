use std::collections::HashMap;

use super::element::{ConfigValue, LynxElement};
use super::mts_global_this::MainThreadGlobalThis;
use crate::constants;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__SetDataset")]
  pub fn set_dataset(&self, element: &LynxElement, dataset: &js_sys::Object) {
    let new_dataset_map: HashMap<String, ConfigValue> = js_sys::Object::entries(dataset)
      .iter()
      .map(|entry| {
        let entry_array: js_sys::Array = entry.into();
        let key = entry_array.get(0).as_string().unwrap();
        let value = entry_array.get(1);
        (key, ConfigValue::new(&value))
      })
      .collect();

    let mut element_data = element.data.borrow_mut();
    let dom = element_data.dom_ref.as_ref().unwrap();

    if let Some(existing_dataset) = &element_data.dataset {
      // 1. for each key in the new dataset, if the value is different from the existing one, set it to the dom
      for (key, value) in &new_dataset_map {
        let mut should_set = true;
        if let Some(existing_value) = existing_dataset.get(key) {
          if existing_value == value {
            should_set = false;
          }
        }
        if should_set {
          dom
            .set_attribute(&format!("data-{}", key.to_lowercase()), &value.to_string())
            .unwrap();
        }
      }
      // 2. for each key in the existing dataset, if it's not in the new dataset, remove it from the dom
      for key in existing_dataset.keys() {
        if !new_dataset_map.contains_key(key) {
          dom
            .remove_attribute(&format!("data-{}", key.to_lowercase()))
            .unwrap();
        }
      }
    } else {
      // if there's no existing dataset, just set all the new dataset to the dom
      for (key, value) in &new_dataset_map {
        dom
          .set_attribute(&format!("data-{}", key.to_lowercase()), &value.to_string())
          .unwrap();
      }
    }
    element_data.dataset = Some(new_dataset_map);
  }

  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    let _ = dom.set_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE, "true");
  }

  #[wasm_bindgen(js_name = "__SetAttribute")]
  pub fn set_attribute(&mut self, element: &LynxElement, key: &str, value: wasm_bindgen::JsValue) {
    let element_data = element.data.borrow();
    let unique_id = element_data.unique_id;
    let tag = element_data.tag.as_str();
    if key == "update-list-info" && tag == "list" {
      self.handle_update_list_info_attribute(element, value);
    } else if let Some(value) = value.as_string() {
      if key == constants::LYNX_TIMING_FLAG {
        // do not set attributes for timing flag, just record it
        self.timing_flags.push(value);
      } else if constants::EXPOSURE_RELATED_ATTRIBUTES.contains(key) {
        self.exposure_changed_elements.push(unique_id);
      } else {
        let dom = element_data.dom_ref.as_ref().unwrap();
        let _ = dom.set_attribute(key, &value);
      }
    }
  }

  /**
   * Get the unique ID of the element
   * It has a special feature:
   * if the element is not a LynxElement, it will return -1
   * But after benchmarking, casting JsValue to LynxElement dynamically is very slow.
   * So we provide a pure Rust version of this function for internal use.
   * It should be wrapped by a JS function that does the type checking first.
   */
  #[wasm_bindgen(js_name = "__GetElementUniqueID_wasm_impl")]
  pub fn get_element_unique_id_pure(&self, element: &LynxElement) -> i32 {
    let element_data = element.data.borrow();
    element_data.unique_id
  }

  #[wasm_bindgen(js_name = "__SwapElement")]
  pub fn swap_element(&mut self, child_a: &LynxElement, child_b: &LynxElement) {
    let temp = self.document.create_element("div").unwrap();
    let child_a_data = child_a.data.borrow();
    let child_b_data = child_b.data.borrow();
    let child_a_dom = child_a_data.dom_ref.as_ref().unwrap();
    let child_b_dom = child_b_data.dom_ref.as_ref().unwrap();
    child_a_dom.replace_with_with_node_1(&temp).unwrap();
    child_b_dom.replace_with_with_node_1(child_a_dom).unwrap();
    temp.replace_with_with_node_1(child_b_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__GetPageElement")]
  pub fn get_page_element(&self) -> Option<LynxElement> {
    self.page.clone()
  }

  #[wasm_bindgen(js_name = "__AppendElement")]
  pub fn append_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_data = parent.data.borrow();
    let child_data = child.data.borrow();
    let parent_dom = parent_data.dom_ref.as_ref().unwrap();
    let child_dom = child_data.dom_ref.as_ref().unwrap();
    parent_dom.append_child(child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__ElementIsEqual")]
  pub fn element_is_equal(&self, left: &LynxElement, right: &LynxElement) -> bool {
    let left_data = left.data.borrow();
    let right_data = right.data.borrow();
    let left_dom = left_data.dom_ref.as_ref().unwrap();
    let right_dom = right_data.dom_ref.as_ref().unwrap();
    left_dom.is_equal_node(Some(right_dom))
  }

  #[wasm_bindgen(js_name = "__FirstElement")]
  pub fn first_element(&self, element: &LynxElement) -> Option<LynxElement> {
    let element_data = element.data.borrow();
    element_data
      .dom_ref
      .as_ref()
      .unwrap()
      .first_element_child()
      .and_then(|e| self.get_lynx_element_by_dom(&e).cloned())
  }

  #[wasm_bindgen(js_name = "__GetChildren")]
  pub fn get_children(&self, element: &LynxElement) -> Vec<LynxElement> {
    let element_data = element.data.borrow();
    let children = element_data.dom_ref.as_ref().unwrap().children();
    let mut array = Vec::new();
    let children_length = children.length();
    for i in 0..children_length {
      let child = children.item(i).unwrap();
      if let Some(element) = self.get_lynx_element_by_dom(&child) {
        array.push(element.clone());
      }
    }
    array
  }

  #[wasm_bindgen(js_name = "__GetParent")]
  pub fn get_parent(&self, element: &LynxElement) -> Option<LynxElement> {
    let element_data = element.data.borrow();
    let parent_dom_option = element_data.dom_ref.as_ref().unwrap().parent_element();
    if let Some(parent_dom) = parent_dom_option {
      self.get_lynx_element_by_dom(&parent_dom).cloned()
    } else {
      None
    }
  }

  #[wasm_bindgen(js_name = "__InsertElementBefore")]
  pub fn insert_element_before(
    &self,
    parent: &LynxElement,
    child: &LynxElement,
    ref_node: &wasm_bindgen::JsValue,
  ) {
    let parent_ = parent.data.borrow();
    let parent_dom = parent_.dom_ref.as_ref().unwrap();
    let child_data = child.data.borrow();
    let child_dom = child_data.dom_ref.as_ref().unwrap();

    if !ref_node.is_null_or_undefined() {
      let ref_node = wasm_bindgen_derive::try_from_js_option::<LynxElement>(ref_node)
        .unwrap()
        .unwrap();
      let ref_node_data = ref_node.data.borrow();
      let ref_node_dom = ref_node_data.dom_ref.as_ref().unwrap();
      parent_dom
        .insert_before(child_dom, Some(ref_node_dom))
        .unwrap();
    } else {
      parent_dom.insert_before(child_dom, None).unwrap();
    };
  }

  #[wasm_bindgen(js_name = "__LastElement")]
  pub fn last_element(&self, element: &LynxElement) -> Option<LynxElement> {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    dom
      .last_element_child()
      .and_then(|e| self.get_lynx_element_by_dom(&e).cloned())
  }

  #[wasm_bindgen(js_name = "__NextElement")]
  pub fn next_element(&self, element: &LynxElement) -> Option<LynxElement> {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    dom
      .next_element_sibling()
      .and_then(|e| self.get_lynx_element_by_dom(&e).cloned())
  }

  #[wasm_bindgen(js_name = "__RemoveElement")]
  pub fn remove_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_data = parent.data.borrow();
    let parent_dom = parent_data.dom_ref.as_ref().unwrap();
    let child_data = child.data.borrow();
    let child_dom = child_data.dom_ref.as_ref().unwrap();
    parent_dom.remove_child(child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__ReplaceElement")]
  pub fn replace_element(&self, new_element: &LynxElement, old_element: &LynxElement) {
    let old_element_data = old_element.data.borrow();
    let new_element_data = new_element.data.borrow();
    let old_element_dom = old_element_data.dom_ref.as_ref().unwrap();
    let new_element_dom = new_element_data.dom_ref.as_ref().unwrap();
    old_element_dom
      .replace_with_with_node_1(new_element_dom)
      .unwrap();
  }

  #[wasm_bindgen(js_name = "__ReplaceElements")]
  pub fn replace_elements(
    &self,
    parent: &LynxElement,
    new_children: &wasm_bindgen::JsValue,
    old_children: &wasm_bindgen::JsValue,
  ) {
    let new_children: js_sys::Array = {
      // the new_children could be 1. array of LynxElement 2. single LynxElement
      if new_children.is_array() {
        js_sys::Array::from_iter(
          wasm_bindgen_derive::try_from_js_array::<LynxElement>(new_children)
            .unwrap()
            .iter()
            .map(|element| {
              let element_data = element.data.borrow();
              let dom = element_data.dom_ref.clone().unwrap();
              wasm_bindgen::JsValue::from(dom)
            }),
        )
      } else if new_children.is_object() {
        let arr = js_sys::Array::new();
        arr.push(&{
          let element = wasm_bindgen_derive::try_from_js_option::<LynxElement>(new_children)
            .unwrap()
            .unwrap();
          let element_data = element.data.borrow();
          let dom = element_data.dom_ref.clone().unwrap();
          wasm_bindgen::JsValue::from(dom)
        });
        arr
      } else {
        return;
      }
    };
    let parent_data = parent.data.borrow();
    let parent_dom = parent_data.dom_ref.as_ref().unwrap();
    if old_children.is_falsy() {
      // just append new children
      let _ = parent_dom.append_with_node(&new_children);
    } else if !old_children.is_array() {
      // old_children is a single LynxElement
      let old_child_element = wasm_bindgen_derive::try_from_js_option::<LynxElement>(old_children)
        .unwrap()
        .unwrap();
      let old_child_data = old_child_element.data.borrow();
      let old_child_dom = old_child_data.dom_ref.as_ref().unwrap();
      old_child_dom.replace_with_with_node(&new_children).unwrap();
    } else {
      let old_children =
        wasm_bindgen_derive::try_from_js_array::<LynxElement>(old_children).unwrap();
      for (ii, old_child) in old_children.iter().enumerate() {
        let old_child_data = old_child.data.borrow();
        let old_child_dom = old_child_data.dom_ref.as_ref().unwrap();
        if ii == 0 {
          let _ = old_child_dom.replace_with_with_node(&new_children);
        } else {
          parent_dom.remove_child(old_child_dom).unwrap();
        }
      }
    }
  }

  #[wasm_bindgen(js_name = "__AddConfig")]
  pub fn add_config(&mut self, element: &LynxElement, type_: &str, value: &wasm_bindgen::JsValue) {
    let unique_id = element.data.borrow().unique_id;
    self
      .unique_id_to_config_map
      .entry(unique_id)
      .or_default()
      .insert(
        type_.to_string(),
        js_sys::JSON::stringify(value).unwrap().as_string().unwrap(),
      );
  }

  #[wasm_bindgen(js_name = "__AddDataset")]
  pub fn add_dataset(&self, element: &LynxElement, key: &str, value: &wasm_bindgen::JsValue) {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    if value.is_truthy() {
      // if the value is string, set it directly, otherwise convert it to string by using JSON.stringify
      let value = ConfigValue::new(value);
      let mut element_data_mut = element.data.borrow_mut();
      let dataset = &mut element_data_mut.dataset;
      let map = dataset.get_or_insert_with(HashMap::new);
      // check if the value is different
      if map.get(key) != Some(&value) {
        let _ = dom.set_attribute(key, &value.to_string());
        map.insert(key.to_string(), value);
      }
    } else {
      // remove the key
      let mut element_data_mut = element.data.borrow_mut();
      if let Some(map) = &mut element_data_mut.dataset {
        map.remove(key);
      }
      let _ = dom.remove_attribute(key);
    }
  }

  #[wasm_bindgen(js_name = "__GetDataset")]
  pub fn get_dataset(&self, element: &LynxElement) -> js_sys::Object {
    let element_data = element.data.borrow();
    if let Some(dataset) = &element_data.dataset {
      let entries = js_sys::Array::from_iter(dataset.iter().map(|(key, value)| {
        js_sys::Array::from_iter(vec![
          &wasm_bindgen::JsValue::from_str(key),
          &value.as_js_value(),
        ])
      }));
      js_sys::Object::from_entries(&entries).unwrap()
    } else {
      js_sys::Object::new()
    }
  }

  #[wasm_bindgen(js_name = "__GetDataByKey")]
  pub fn get_data_by_key(&self, element: &LynxElement, key: &str) -> wasm_bindgen::JsValue {
    let dataset = &element.data.borrow().dataset;
    if let Some(map) = dataset {
      if let Some(value) = map.get(key) {
        return value.as_js_value();
      }
    }
    wasm_bindgen::JsValue::UNDEFINED
  }

  #[wasm_bindgen(js_name = "__GetAttributeByName")]
  pub fn get_attribute_by_name(&self, element: &LynxElement, name: &str) -> Option<String> {
    let element_data = element.data.borrow();
    element_data.dom_ref.as_ref().unwrap().get_attribute(name)
  }

  #[wasm_bindgen(js_name = "__GetID")]
  pub fn get_id(&self, element: &LynxElement) -> Option<String> {
    element.data.borrow().id.clone()
  }

  #[wasm_bindgen(js_name = "__SetID")]
  pub fn set_id(&self, element: &LynxElement, id: Option<String>) {
    let mut element_data = element.data.borrow_mut();
    let dom = element_data.dom_ref.as_ref().unwrap();
    if let Some(id) = &id {
      let _ = dom.set_attribute("id", id);
    } else {
      let _ = dom.remove_attribute("id");
    }
    element_data.id = id;
  }

  #[wasm_bindgen(js_name = "__GetTag")]
  pub fn get_tag(&self, element: &LynxElement) -> String {
    element.data.borrow().tag.clone()
  }
}
