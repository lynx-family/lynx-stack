use super::{LynxElement, MainThreadGlobalThis};
use crate::constants;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

pub struct ElementTemplateInstance {
  // dom:
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    element.mark_template();
  }

  #[wasm_bindgen(js_name = "__MarkPartElement")]
  pub fn mark_part_element(&self, element: &mut LynxElement, part_id: Option<String>) {
    element.mark_part(part_id.as_deref());
  }

  #[wasm_bindgen(js_name = "__GetTemplateParts")]
  pub fn get_template_parts(&self, element: &LynxElement) -> js_sys::Object {
    // check if the element is marked as template
    let dom = element.get_dom();
    let is_template = dom
      .get_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE)
      .is_some();
    let mut part_id_to_element_map: HashMap<String, LynxElement> = HashMap::new();
    if is_template {
      let unique_id = element.get_unique_id();
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
        let part_element_node: web_sys::HtmlElement =
          part_elements_node_list.item(i).unwrap().dyn_into().unwrap();
        let part_element = self.get_lynx_element_by_dom(&part_element_node).unwrap();
        let part_id = part_element.get_part_id();
        part_id_to_element_map.insert(part_id, part_element.clone());
      }
    }
    js_sys::Object::from_entries(
      &part_id_to_element_map
        .into_iter()
        .map(|(k, v)| {
          let key = wasm_bindgen::JsValue::from_str(&k);
          let value = wasm_bindgen::JsValue::from(v);
          js_sys::Array::of2(&key, &value)
        })
        .collect::<js_sys::Array>(),
    )
    .unwrap()
  }

  // #[wasm_bindgen(js_name = "__ElementFromBinary")]
  // pub fn element_from_binary(&mut self, template_id: String, parent_component_unique_id: i32) -> Vec<LynxElement> {
  //   let created_elements = Vec::new();
  //   if self.element_templates.contains_key(&template_id) {
  //     if self.element_templates_dom_cache.contains_key(&template_id) {
  //       let template_dom = self.element_templates_dom_cache.get(&template_id).unwrap();
  //       let content = template_dom.content();
  //       // clone the content
  //       let cloned_content = content.clone_node_with_deep(true).unwrap();
  //       let nodes = cloned_content.child_nodes();
  //     }
  //   }
  //   created_elements
  // }
}
