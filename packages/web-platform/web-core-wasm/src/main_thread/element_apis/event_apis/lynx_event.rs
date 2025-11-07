use crate::main_thread::{
  element_apis::{CommonConfigObject, LynxElement},
  MainThreadGlobalThis,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;

// use bincode::config::Config;
// use crate::main_thread::element::{ConfigValue, LynxElement};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListItemEventItem {
  height: f64,
  width: f64,
  item_key: String,
  origin_x: f64,
  origin_y: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Touch {
  pub identifier: i32,
  pub page_y: f64,
  pub page_x: f64,
  pub client_y: f64,
  pub client_x: f64,
  pub screen_y: f64,
  pub screen_x: f64,
  pub radius_x: f64,
  pub radius_y: f64,
  pub rotation_angle: f64,
  pub force: f64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDetail {
  #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
  type_str: Option<String>,
  //animation event only
  animation_type: Option<String>,
  animation_name: Option<String>,
  new_animator: Option<bool>,

  // layoutchange event
  left: Option<f64>,
  right: Option<f64>,
  top: Option<f64>,
  bottom: Option<f64>,

  // error event
  err_msg: Option<String>,
  error_code: Option<i32>,
  from: Option<String>,

  // scroll event
  delta_x: Option<f64>,
  delta_y: Option<f64>,
  scroll_left: Option<f64>,
  scroll_top: Option<f64>,
  scroll_width: Option<f64>,
  scroll_height: Option<f64>,

  // list event
  stage: Option<i32>,
  visible_item_before_update: Option<Vec<ListItemEventItem>>,
  visible_item_after_update: Option<Vec<ListItemEventItem>>,

  // text event
  start: Option<i32>,
  end: Option<i32>,
  direction: Option<String>,
  value: Option<String>,
  text_length: Option<i32>,
  is_composing: Option<bool>,
  selection_start: Option<i32>,
  selection_end: Option<i32>,

  //x-audio-tt event
  code: Option<i32>,
  current_src_id: Option<String>,
  current_time: Option<f64>,

  //refresh view event
  is_manual: Option<bool>,
  is_dragging: Option<bool>,
  offset_percent: Option<f64>,

  //swiper event
  current: Option<i32>,
  is_dragged: Option<bool>,

  // general
  offset: Option<f64>,
  width: Option<f64>,
  height: Option<f64>,
  index: Option<i32>,
}

#[wasm_bindgen]
#[derive(Serialize, Deserialize, Clone)]
pub struct LynxEventTarget {
  unique_id: i32,
  id: Option<String>,
  dataset: CommonConfigObject,
  #[serde(skip)]
  element_refptr: Option<wasm_bindgen::JsValue>,
}

#[wasm_bindgen]
impl LynxEventTarget {
  #[wasm_bindgen(getter = "uniqueID")]
  pub fn get_unique_id(&self) -> i32 {
    self.unique_id
  }

  #[wasm_bindgen(getter = "id")]
  pub fn get_id(&self) -> Option<String> {
    self.id.clone()
  }

  #[wasm_bindgen(getter = "dataset")]
  pub fn get_dataset(&mut self) -> wasm_bindgen::JsValue {
    self.dataset.clone_to_js_object().into()
  }

  #[wasm_bindgen(getter = "elementRefptr")]
  pub fn get_element_refptr(&self) -> Option<wasm_bindgen::JsValue> {
    self.element_refptr.clone()
  }
}

impl From<&LynxElement> for LynxEventTarget {
  fn from(element: &LynxElement) -> Self {
    LynxEventTarget {
      unique_id: element.get_unique_id(),
      id: element.get_attribute("id"),
      dataset: element.get_dataset_clone(),
      element_refptr: Some(wasm_bindgen::JsValue::from(element.clone())),
    }
  }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LynxEvent {
  #[serde(rename = "type")]
  event_name: String,
  time_stamp: f64,
  bubbles: bool,
  cancelable: bool,
  detail: Option<EventDetail>,
  touches: Option<Vec<Touch>>,
  changed_touches: Option<Vec<Touch>>,
  client_x: Option<f64>,
  client_y: Option<f64>,
  page_x: Option<f64>,
  page_y: Option<f64>,
  screen_x: Option<f64>,
  screen_y: Option<f64>,
  x: Option<f64>,
  y: Option<f64>,

  //exposure
  exposure_id: Option<String>,
  #[serde(rename = "exposure-id")]
  exposure_id_dash: Option<String>,
  exposure_scene: Option<String>,
  #[serde(rename = "exposure-scene")]
  exposure_scene_dash: Option<String>,

  // /**
  //  * Mouse event only
  //  */
  button: Option<i32>,
  buttons: Option<i32>,

  #[serde(skip, default)]
  pub(crate) propagation_stopped: bool,

  target_info: Option<LynxEventTarget>,
  current_target_info: Option<LynxEventTarget>,
}

use wasm_bindgen::JsCast;

impl LynxEvent {
  pub(crate) fn new(
    event_name: String,
    event: web_sys::Event,
    mts_global_this: &MainThreadGlobalThis,
  ) -> Self {
    let target_element: web_sys::HtmlElement = event.target().unwrap().dyn_into().unwrap();
    let current_target_element: web_sys::HtmlElement =
      event.current_target().unwrap().dyn_into().unwrap();
    let target_element: &LynxElement = mts_global_this
      .get_lynx_element_by_dom(&target_element)
      .unwrap();
    let current_target_element: &LynxElement = mts_global_this
      .get_lynx_element_by_dom(&current_target_element)
      .unwrap();
    let mut event: LynxEvent = serde_wasm_bindgen::from_value(event.into()).unwrap();
    event.event_name = event_name;
    event.target_info = Some(LynxEventTarget::from(target_element));
    event.current_target_info = Some(LynxEventTarget::from(current_target_element));
    event
  }
}

impl From<LynxEvent> for wasm_bindgen::JsValue {
  fn from(event: LynxEvent) -> Self {
    let js_value = serde_wasm_bindgen::to_value(&event).unwrap();
    let target: wasm_bindgen::JsValue = event.target_info.into();
    let current_target: wasm_bindgen::JsValue = event.current_target_info.into();
    js_sys::Reflect::set(
      &js_value,
      &wasm_bindgen::JsValue::from_str("target"),
      &target,
    )
    .unwrap();
    js_sys::Reflect::set(
      &js_value,
      &wasm_bindgen::JsValue::from_str("currentTarget"),
      &current_target,
    )
    .unwrap();
    js_value
  }
}
