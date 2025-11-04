use crate::constants;
use serde::Deserialize;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

use super::{LynxElement, MainThreadGlobalThis};

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    let element_data = element.data.borrow();
    let unique_id = element_data.unique_id;
    let dom = element_data.dom_ref.as_ref().unwrap();
    let _ = dom.set_attribute(
      constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
      &unique_id.to_string(),
    );
  }

  #[wasm_bindgen(js_name = "__MarkPartElement")]
  pub fn mark_part_element(&self, element: &LynxElement, part_id: Option<String>) {
    let element_data = &mut element.data.borrow_mut();
    let dom = element_data.dom_ref.as_ref().unwrap();
    if let Some(part_id) = &part_id {
      let _ = dom.set_attribute(constants::LYNX_PART_ID_ATTRIBUTE, part_id);
    } else {
      let _ = dom.remove_attribute(constants::LYNX_PART_ID_ATTRIBUTE);
    }
    element_data.part_id = part_id;
  }

  #[wasm_bindgen(js_name = "__GetTemplateParts")]
  pub fn get_template_parts(&self, element: &LynxElement) -> js_sys::Object {
    // check if the element is marked as template
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    let is_template = dom
      .get_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE)
      .is_some();
    let mut part_id_to_element_map: HashMap<String, LynxElement> = HashMap::new();
    if is_template {
      let unique_id = element_data.unique_id;
      let part_elements_node_list = dom
        .query_selector_all(&format!(
          "[{}]:not([{}=\"{}\"] [{}] [{}])",
          constants::LYNX_PART_ID_ATTRIBUTE,
          constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
          unique_id,
          constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
          constants::LYNX_PART_ID_ATTRIBUTE
        ))
        .unwrap();
      for i in 0..part_elements_node_list.length() {
        let part_element_node: web_sys::Element =
          part_elements_node_list.item(i).unwrap().dyn_into().unwrap();
        let part_element = self.get_lynx_element_by_dom(&part_element_node).unwrap();
        let part_element_data = part_element.data.borrow();
        let part_id = part_element_data.part_id.as_ref().unwrap().clone();
        part_id_to_element_map.insert(part_id, part_element.clone());
      }
    }
    js_sys::Object::from_entries(
      &part_id_to_element_map
        .into_iter()
        .map(|(k, v)| {
          let key = wasm_bindgen::JsValue::from_str(&k);
          let value = wasm_bindgen::JsValue::from(v);
          js_sys::Array::from_iter(vec![key, value])
        })
        .collect::<js_sys::Array>(),
    )
    .unwrap()
  }

  #[wasm_bindgen(js_name = "__ElementFromBinary")]
  pub fn element_from_binary(&mut self, binary: &[u8]) -> LynxElement {
    todo!()
  }
}
