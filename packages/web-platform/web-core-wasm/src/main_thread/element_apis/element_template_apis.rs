use crate::constants;
use serde::Deserialize;

use super::element::{ConfigValue, LynxElement};
use super::mts_global_this::MainThreadGlobalThis;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
pub struct ElementTemplate {}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__MarkTemplateElement")]
  pub fn mark_template_element(&mut self, element: &LynxElement) {
    let element_data = element.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    let _ = dom.set_attribute(constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE, "true");
  }

  #[wasm_bindgen(js_name = "__MarkPartElement")]
  pub fn mark_part_element(&self, element: &LynxElement, part_id: Option<String>) {
    let element_data = &mut element.data.borrow_mut();
    element_data.part_id = part_id;
  }

  #[wasm_bindgen(js_name = "__GetTemplateParts")]
  pub fn get_template_parts(&self, element: &LynxElement) {
    todo!()
  }

  #[wasm_bindgen(js_name = "__ElementFromBinary")]
  pub fn element_from_binary(&mut self, binary: &[u8]) -> LynxElement {
    todo!()
  }
}
