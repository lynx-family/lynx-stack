use std::{cell::RefCell, collections::HashMap, rc::Rc};

use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::constants;

pub struct LynxElementData {
  pub(crate) unique_id: i32,
  pub(crate) css_id: i32,
  pub(crate) tag: String,
  pub(crate) parent_component_unique_id: i32,
  pub(crate) id: Option<String>,
  pub(crate) part_id: Option<i32>,
  pub(crate) dataset: HashMap<String, String>,
  pub(crate) component_at_index: Option<JsValue>,
  pub(crate) enqueue_component: Option<JsValue>,
}

/**
 * This this the struct that owned by Javascript World
 */
#[wasm_bindgen]
#[derive(Clone)]
pub struct LynxElement {
  pub(crate) data: Rc<RefCell<LynxElementData>>,
  pub(crate) dom_ref: Option<web_sys::Element>,
  pub(crate) self_js_value: wasm_bindgen::JsValue,
}

#[derive(Serialize)]
pub struct LynxElementJsonData {
  #[serde(rename = "ssrID")]
  ssr_id: i32,
}

#[wasm_bindgen]
impl LynxElement {
  #[wasm_bindgen(js_name = "toJSON")]
  pub fn to_json(&self) -> JsValue {
    let data = self.data.borrow();
    let json_data = LynxElementJsonData {
      ssr_id: data.part_id.unwrap_or(data.unique_id),
    };
    serde_wasm_bindgen::to_value(&json_data).unwrap()
  }
}

#[wasm_bindgen]
impl LynxElement {
  pub fn new(
    unique_id: i32,
    css_id: i32,
    tag: String,
    parent_component_unique_id: i32,
    dom: web_sys::Element,
  ) -> Self {
    let _ = dom.set_attribute(constants::LYNX_TAG_ATTRIBUTE, tag.as_str());
    let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    if css_id != 0 {
      let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }
    let mut lynx_element = LynxElement {
      data: Rc::new(
        LynxElementData {
          unique_id,
          css_id,
          tag,
          parent_component_unique_id,
          id: None,
          part_id: None,
          dataset: HashMap::new(),
          component_at_index: None,
          enqueue_component: None,
        }
        .into(),
      ),
      dom_ref: Some(dom),
      self_js_value: JsValue::NULL,
    };
    lynx_element.self_js_value = lynx_element.clone().into();
    lynx_element
  }

  pub fn ssr_set_dom_ref(&mut self, dom: web_sys::Element) {
    assert!(self.dom_ref.is_none(), "DOM ref is already set");
    self.dom_ref = Some(dom);
  }
}
