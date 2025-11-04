use crate::constants;
use serde::{Deserialize, Serialize};
use std::{cell::RefCell, collections::HashMap, fmt::Display, rc::Rc};
use wasm_bindgen::prelude::*;
use wasm_bindgen_derive::TryFromJsValue;

#[derive(Serialize, Deserialize, Default, PartialEq, Clone, Debug)]
pub enum ConfigValueType {
  #[default]
  String,
  Object,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct ConfigValue {
  value_type: ConfigValueType,
  /**
   * if it is not a String value we
   */
  value: String,
}

impl ConfigValue {
  pub fn new(value: &wasm_bindgen::JsValue) -> ConfigValue {
    if value.is_string() {
      ConfigValue {
        value_type: ConfigValueType::String,
        value: value.as_string().unwrap(),
      }
    } else {
      ConfigValue {
        value_type: ConfigValueType::Object,
        value: js_sys::JSON::stringify(&value)
          .unwrap()
          .as_string()
          .unwrap(),
      }
    }
  }

  pub fn as_js_value(&self) -> wasm_bindgen::JsValue {
    match self.value_type {
      ConfigValueType::String => wasm_bindgen::JsValue::from_str(&self.value),
      ConfigValueType::Object => js_sys::JSON::parse(&self.value).unwrap(),
    }
  }
}

impl std::cmp::PartialEq for ConfigValue {
  fn eq(&self, other: &Self) -> bool {
    self.value_type == other.value_type && self.value == other.value
  }
}

impl Display for ConfigValue {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.value)
  }
}

#[derive(Debug)]
pub struct LynxElementData {
  pub(crate) unique_id: i32,
  pub(crate) css_id: i32,
  pub(crate) tag: String,
  pub(crate) parent_component_unique_id: i32,
  pub(crate) id: Option<String>,
  pub(crate) part_id: Option<String>,
  pub(crate) dataset: Option<HashMap<String, ConfigValue>>,
  pub(crate) component_id: Option<String>,
  pub(crate) component_config: Option<HashMap<String, ConfigValue>>,
  pub(crate) component_at_index: Option<JsValue>,
  pub(crate) enqueue_component: Option<JsValue>,
  pub(crate) dom_ref: Option<web_sys::Element>,
}

#[derive(Clone, TryFromJsValue, Debug)]
#[wasm_bindgen]
pub struct LynxElement {
  pub(crate) data: Rc<RefCell<LynxElementData>>,
}

#[derive(Serialize)]
pub struct LynxElementJsonData {
  #[serde(rename = "ssrID")]
  ssr_id: String,
}

#[wasm_bindgen]
impl LynxElement {
  #[wasm_bindgen(js_name = "toJSON")]
  pub fn to_json(&self) -> JsValue {
    let data = self.data.borrow();
    let json_data = LynxElementJsonData {
      ssr_id: data.part_id.clone().unwrap_or(data.unique_id.to_string()),
    };
    serde_wasm_bindgen::to_value(&json_data).unwrap()
  }
}

impl LynxElement {
  pub fn new(
    unique_id: i32,
    css_id: i32,
    tag: String,
    parent_component_unique_id: i32,
    component_id: Option<String>,
    dom: web_sys::Element,
  ) -> Self {
    let _ = dom.set_attribute(constants::LYNX_TAG_ATTRIBUTE, tag.as_str());
    if css_id != 0 {
      let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }
    LynxElement {
      data: Rc::new(
        LynxElementData {
          unique_id,
          css_id,
          tag: tag.clone(),
          parent_component_unique_id,
          id: None,
          part_id: None,
          dataset: None,
          component_id,
          component_config: None,
          component_at_index: None,
          enqueue_component: None,
          dom_ref: Some(dom),
        }
        .into(),
      ),
    }
  }
}
