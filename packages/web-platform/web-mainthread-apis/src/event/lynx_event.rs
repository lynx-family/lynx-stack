use std::collections::HashMap;

use crate::main_thread::pure_element_papis;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

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
  pub target: LynxTarget,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EventDetail {
  #[serde(rename = "type", skip_serializing_if = "Option::is_none")]
  type_str: Option<String>,
  //animation event only
  #[serde(skip_serializing_if = "Option::is_none")]
  animation_type: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  animation_name: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  new_animator: Option<bool>,

  // layoutchange event
  #[serde(skip_serializing_if = "Option::is_none")]
  left: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  right: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  top: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  bottom: Option<f64>,

  // error event
  #[serde(skip_serializing_if = "Option::is_none")]
  err_msg: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  error_code: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  from: Option<String>,

  // scroll event
  #[serde(skip_serializing_if = "Option::is_none")]
  delta_x: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  delta_y: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  scroll_left: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  scroll_top: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  scroll_width: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  scroll_height: Option<f64>,

  // list event
  #[serde(skip_serializing_if = "Option::is_none")]
  stage: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  visible_item_before_update: Option<Vec<ListItemEventItem>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  visible_item_after_update: Option<Vec<ListItemEventItem>>,

  // text event
  #[serde(skip_serializing_if = "Option::is_none")]
  start: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  end: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  direction: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  value: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  text_length: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  is_composing: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  selection_start: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  selection_end: Option<i32>,

  //x-audio-tt event
  #[serde(skip_serializing_if = "Option::is_none")]
  code: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  current_src_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  current_time: Option<f64>,

  //refresh view event
  #[serde(skip_serializing_if = "Option::is_none")]
  is_manual: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  is_dragging: Option<bool>,
  #[serde(skip_serializing_if = "Option::is_none")]
  offset_percent: Option<f64>,

  //swiper event
  #[serde(skip_serializing_if = "Option::is_none")]
  current: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  is_dragged: Option<bool>,

  // general
  #[serde(skip_serializing_if = "Option::is_none")]
  offset: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  width: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  height: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  index: Option<i32>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[wasm_bindgen]
pub struct LynxTarget {
  unique_id: i32,
  #[serde(skip_serializing_if = "Option::is_none")]
  id: Option<String>,
  // dataset: HashMap<String, String>,
}

impl LynxTarget {
  pub fn new(target: &web_sys::Element) -> LynxTarget {
    LynxTarget {
      unique_id: pure_element_papis::get_element_unique_id(target),
      id: pure_element_papis::get_id(target),
      // dataset: None,
    }
  }
}

#[wasm_bindgen]
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LynxSyntheticEvent {
  #[serde(rename = "type")]
  event_name: String,
  time_stamp: f64,
  bubbles: bool,
  cancelable: bool,
  #[serde(skip_deserializing, default)]
  target: Option<LynxTarget>,
  #[serde(skip_deserializing, default)]
  current_target: Option<LynxTarget>,
  #[serde(skip_deserializing, default)]
  detail: Option<EventDetail>,
  #[serde(skip_serializing_if = "Option::is_none")]
  touches: Option<Vec<Touch>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  changed_touches: Option<Vec<Touch>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  client_x: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  client_y: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  page_x: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  page_y: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  screen_x: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  screen_y: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  x: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  y: Option<f64>,

  //exposure
  #[serde(skip_serializing_if = "Option::is_none")]
  exposure_id: Option<String>,
  #[serde(rename = "exposure-id", skip_serializing_if = "Option::is_none")]
  exposure_id_dash: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  exposure_scene: Option<String>,
  #[serde(rename = "exposure-scene", skip_serializing_if = "Option::is_none")]
  exposure_scene_dash: Option<String>,

  // /**
  //  * Mouse event only
  //  */
  #[serde(skip_serializing_if = "Option::is_none")]
  button: Option<i32>,
  #[serde(skip_serializing_if = "Option::is_none")]
  buttons: Option<i32>,

  #[serde(skip, default)]
  propagation_stopped: bool,
}

impl LynxSyntheticEvent {
  pub fn set_current_target(&mut self, current_target: LynxTarget) {
    self.current_target = Some(current_target);
  }
}

#[wasm_bindgen]
impl LynxSyntheticEvent {
  #[wasm_bindgen(js_name = "toJSON")]
  pub fn to_json(&self) -> String {
    serde_json::to_string(self).unwrap()
  }

  pub fn stop_propagation(&mut self) {
    self.propagation_stopped = true;
  }
}

/**
 * Lynx Synthetic Event
 * This is the exactly the object of https://lynxjs.org/api/lynx-api/event/event#event
 * The event is designed to be serializable and transferable between Rust <-> JS and main thread <-> worker thread.
 */
impl LynxSyntheticEvent {
  pub fn new(name: String, event: &web_sys::Event) -> LynxSyntheticEvent {
    // if detail is object, we need to deserialize it separately
    let detail_js = js_sys::Reflect::get(&event, &JsValue::from_str("detail")).ok();
    let detail = match detail_js {
      Some(js_value) => {
        if js_value.is_object() {
          let detail_deser: EventDetail = serde_wasm_bindgen::from_value(js_value).unwrap();
          Some(detail_deser)
        } else {
          None
        }
      }
      None => None,
    };
    let mut raw_event: LynxSyntheticEvent = serde_wasm_bindgen::from_value(event.into()).unwrap();
    raw_event.event_name = name;
    raw_event.detail = detail;
    raw_event
  }
}
