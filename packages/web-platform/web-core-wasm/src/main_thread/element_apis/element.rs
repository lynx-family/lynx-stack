use super::MainThreadGlobalThis;
use crate::{constants, main_thread::mts_global_this};
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
    mts_global_this: &mut MainThreadGlobalThis,
    tag: &str,
    parent_component_unique_id: i32,
    css_id: Option<i32>,
    component_id: Option<String>,
  ) -> Self {
    // tag and html element creating
    let tag = tag.to_string();
    let html_tag = if let Some(html_tag) = mts_global_this.tag_name_to_html_tag_map.get(&tag) {
      html_tag.clone()
    } else {
      tag
    };
    let parent_component = mts_global_this
      .unique_id_to_element_map
      .get(&parent_component_unique_id);
    let dom = mts_global_this.document.create_element(&html_tag).unwrap();
    let _ = dom.set_attribute(constants::LYNX_TAG_ATTRIBUTE, html_tag.as_str());

    // css id
    let css_id = {
      if let Some(css_id) = css_id {
        css_id
      } else if let Some(parent_component) = parent_component {
        parent_component.data.borrow().css_id
      } else {
        0
      }
    };
    if css_id != 0 {
      let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }

    // unique id
    /*
     if the css selector is disabled, we need to set the unique id attribute for element lookup by using attribute selector
    */
    mts_global_this.unique_id_counter += 1;
    let unique_id = mts_global_this.unique_id_counter;
    if !mts_global_this.config_enable_css_selector {
      let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    }
    js_sys::Reflect::set(
      &dom,
      &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
      &wasm_bindgen::JsValue::from(unique_id),
    )
    .unwrap();

    let element = Box::new(LynxElement {
      data: Rc::new(
        LynxElementData {
          unique_id,
          css_id,
          tag: html_tag,
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
    });

    mts_global_this
      .unique_id_to_element_map
      .insert(unique_id, element.clone());
    *element
  }

  pub fn clone_with_cloned_dom(
    &self,
    mts_global_this: &mut MainThreadGlobalThis,
    dom: web_sys::Element,
  ) -> Self {
    let unique_id = mts_global_this.unique_id_counter + 1;
    mts_global_this.unique_id_counter = unique_id;
    // unique id, same logic as LynxElement::new
    mts_global_this.unique_id_counter += 1;
    let unique_id = mts_global_this.unique_id_counter;
    if !mts_global_this.config_enable_css_selector {
      let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    }

    let data = self.data.borrow();
    let new_data = LynxElementData {
      unique_id,
      css_id: data.css_id,
      tag: data.tag.clone(),
      parent_component_unique_id: data.parent_component_unique_id,
      id: data.id.clone(),
      part_id: data.part_id.clone(),
      dataset: data.dataset.clone(),
      component_id: data.component_id.clone(),
      component_config: data.component_config.clone(),
      component_at_index: data.component_at_index.clone(),
      enqueue_component: data.enqueue_component.clone(),
      dom_ref: Some(dom),
    };
    LynxElement {
      data: Rc::new(RefCell::new(new_data)),
    }
  }
}
