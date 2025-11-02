use std::collections::HashMap;

use super::element::{ConfigValue, LynxElement};
use super::mts_global_this::MainThreadGlobalThis;
use crate::constants;
use wasm_bindgen::{convert::TryFromJsValue, prelude::*};

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    let _ = element
      .dom_ref
      .as_ref()
      .unwrap()
      .set_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE, "true");
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
        let dom = element.dom_ref.as_ref().unwrap();
        let _ = dom.set_attribute(key, &value);
      }
    }
  }

  #[wasm_bindgen(js_name = "__GetElementUniqueID")]
  pub fn get_element_unique_id(&self, element: wasm_bindgen::JsValue) -> i32 {
    let lynx_element = LynxElement::try_from_js_value(element);
    if let Ok(lynx_element) = lynx_element {
      let element_data = &lynx_element.data.borrow();
      return element_data.unique_id;
    }
    -1
  }

  #[wasm_bindgen(js_name = "__SwapElement")]
  pub fn swap_element(&mut self, child_a: &LynxElement, child_b: &LynxElement) {
    let temp = self.document.create_element("div").unwrap();
    let child_a_dom = child_a.dom_ref.as_ref().unwrap();
    let child_b_dom = child_b.dom_ref.as_ref().unwrap();
    child_a_dom.replace_with_with_node_1(&temp).unwrap();
    child_b_dom.replace_with_with_node_1(child_a_dom).unwrap();
    temp.replace_with_with_node_1(child_b_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__GetPageElement")]
  pub fn get_page_element(&self) -> Option<wasm_bindgen::JsValue> {
    self.page.clone().map(|e| e.as_js_value())
  }

  #[wasm_bindgen(js_name = "__AppendElement")]
  pub fn append_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_dom = parent.dom_ref.as_ref().unwrap();
    let child_dom = child.dom_ref.as_ref().unwrap();
    parent_dom.append_child(child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__ElementIsEqual")]
  pub fn element_is_equal(&self, left: &LynxElement, right: &LynxElement) -> bool {
    left
      .dom_ref
      .as_ref()
      .unwrap()
      .is_equal_node(Some(right.dom_ref.as_ref().unwrap()))
  }

  #[wasm_bindgen(js_name = "__FirstElement")]
  pub fn first_element(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    element
      .dom_ref
      .as_ref()
      .unwrap()
      .first_element_child()
      .and_then(|e| {
        self
          .get_lynx_element_by_dom(&e)
          .map(|b| b.as_js_value().clone())
      })
  }

  #[wasm_bindgen(js_name = "__GetChildren")]
  pub fn get_children(&self, element: &LynxElement) -> js_sys::Array {
    let children = element.dom_ref.as_ref().unwrap().children();
    let array = js_sys::Array::new();
    let children_length = children.length();
    for i in 0..children_length {
      let child = children.item(i).unwrap();
      if let Some(element) = self.get_lynx_element_by_dom(&child) {
        let element: wasm_bindgen::JsValue = element.as_js_value().clone();
        array.push(&element);
      }
    }
    array
  }

  #[wasm_bindgen(js_name = "__GetParent")]
  pub fn get_parent(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    let parent_dom_option = element.dom_ref.as_ref().unwrap().parent_element();
    if let Some(parent_dom) = parent_dom_option {
      self
        .get_lynx_element_by_dom(&parent_dom)
        .map(|element| element.as_js_value().clone())
    } else {
      None
    }
  }

  #[wasm_bindgen(js_name = "__InsertElementBefore")]
  pub fn insert_element_before(
    &self,
    parent: &LynxElement,
    child: &LynxElement,
    ref_node: &LynxElement,
  ) {
    let parent_dom = parent.dom_ref.as_ref().unwrap();
    let child_dom = child.dom_ref.as_ref().unwrap();
    let ref_node_dom = ref_node.dom_ref.as_ref().map(|e| e as &web_sys::Node);
    parent_dom.insert_before(child_dom, ref_node_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__LastElement")]
  pub fn last_element(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    element
      .dom_ref
      .as_ref()
      .unwrap()
      .last_element_child()
      .and_then(|e| {
        self
          .get_lynx_element_by_dom(&e)
          .map(|b| b.as_js_value().clone())
      })
  }

  #[wasm_bindgen(js_name = "__NextElement")]
  pub fn next_element(&self, element: &LynxElement) -> Option<wasm_bindgen::JsValue> {
    element
      .dom_ref
      .as_ref()
      .unwrap()
      .next_element_sibling()
      .and_then(|e| {
        self
          .get_lynx_element_by_dom(&e)
          .map(|b| b.as_js_value().clone())
      })
  }

  #[wasm_bindgen(js_name = "__RemoveElement")]
  pub fn remove_element(&self, parent: &LynxElement, child: &LynxElement) {
    let parent_dom = parent.dom_ref.as_ref().unwrap();
    let child_dom = child.dom_ref.as_ref().unwrap();
    parent_dom.remove_child(child_dom).unwrap();
  }

  #[wasm_bindgen(js_name = "__ReplaceElement")]
  pub fn replace_element(&self, new_element: &LynxElement, old_element: &LynxElement) {
    let old_element_dom = old_element.dom_ref.as_ref().unwrap();
    let new_element_dom = new_element.dom_ref.as_ref().unwrap();
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
        let new_children_array: js_sys::Array = js_sys::Array::from(new_children);
        new_children_array.map(&mut |lynx_element, _, _| {
          let lynx_element = LynxElement::try_from_js_value(lynx_element).unwrap();
          let dom = lynx_element.dom_ref.clone().unwrap();
          dom.into()
        })
      } else if new_children.is_object() {
        let arr = js_sys::Array::new();
        arr.push(
          &LynxElement::try_from_js_value_ref(new_children)
            .unwrap()
            .dom_ref
            .as_ref()
            .unwrap()
            .clone()
            .into(),
        );
        arr
      } else {
        js_sys::Array::new()
      }
    };
    let old_children: Vec<LynxElement> = {
      // the old_children could be 1. array of LynxElement 2. single LynxElement
      if old_children.is_array() {
        let old_children_array: js_sys::Array =
          old_children.unchecked_ref::<js_sys::Array>().clone();
        old_children_array
          .iter()
          .map(|v| LynxElement::try_from_js_value(v).unwrap())
          .collect()
      } else if old_children.is_object() {
        vec![LynxElement::try_from_js_value_ref(old_children).unwrap()]
      } else {
        vec![]
      }
    };

    let parent_dom = parent.dom_ref.as_ref().unwrap();

    if old_children.is_empty() {
      // just append new children
      parent_dom.append_with_node(&new_children).unwrap();
    } else {
      let first_old_child_dom = old_children[0].dom_ref.as_ref().unwrap();
      for child in &old_children[1..] {
        self.remove_element(parent, child);
      }
      first_old_child_dom
        .replace_with_with_node(&new_children)
        .unwrap();
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
    let dataset = &mut element.data.borrow_mut().dataset;
    let dom = element.dom_ref.as_ref().unwrap();
    if value.is_truthy() {
      // if the value is string, set it directly, otherwise convert it to string by using JSON.stringify
      let value = ConfigValue::new(value);
      let map = dataset.get_or_insert_with(HashMap::new);
      // check if the value is different
      if map.get(key) != Some(&value) {
        let _ = dom.set_attribute(key, &value.value);
        map.insert(key.to_string(), value);
      }
    } else {
      // remove the key
      if let Some(map) = dataset {
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
    element.dom_ref.as_ref().unwrap().get_attribute(name)
  }

  #[wasm_bindgen(js_name = "__GetID")]
  pub fn get_id(&self, element: &LynxElement) -> Option<String> {
    element.data.borrow().id.clone()
  }

  #[wasm_bindgen(js_name = "__SetID")]
  pub fn set_id(&self, element: &LynxElement, id: Option<String>) {
    let mut element_data = element.data.borrow_mut();
    let dom = element.dom_ref.as_ref().unwrap();
    if let Some(id) = &id {
      let _ = dom.set_attribute("id", &id);
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
