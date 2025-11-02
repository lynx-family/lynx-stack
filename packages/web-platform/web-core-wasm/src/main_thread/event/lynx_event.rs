use std::collections::HashMap;

use bincode::config::Config;
use serde::{Deserialize, Serialize};
use wasm_bindgen::prelude::*;

use crate::main_thread::element::{ConfigValue, LynxElement};

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
  dataset: HashMap<String, ConfigValue>,
  #[serde(skip)]
  dataset_js_value: Option<wasm_bindgen::JsValue>,
  #[serde(skip)]
  /**
   * for elementRefptr
   */
  target_element_js_value: Option<wasm_bindgen::JsValue>,
}

impl LynxEventTarget {
  pub fn new(target: &LynxElement) -> LynxEventTarget {
    let element_data = target.data.borrow();
    LynxEventTarget {
      unique_id: element_data.unique_id,
      id: element_data.id.clone(),
      dataset: element_data.dataset.clone().unwrap_or_default(),
      dataset_js_value: None,
      target_element_js_value: Some(target.as_js_value().clone()),
    }
  }
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
    if self.dataset_js_value.is_none() {
      let entries: js_sys::Array =
        js_sys::Array::from_iter(self.dataset.iter().map(|(key, value)| {
          let value: wasm_bindgen::JsValue = value.as_js_value().clone();
          js_sys::Array::from_iter(vec![wasm_bindgen::JsValue::from_str(key), value])
        }));
      let obj = js_sys::Object::from_entries(&entries).unwrap();
      self.dataset_js_value = Some(obj.into());
    }
    self.dataset_js_value.as_ref().unwrap().clone()
  }

  #[wasm_bindgen(getter = "elementRefptr")]
  pub fn get_element_refptr(&self) -> wasm_bindgen::JsValue {
    match &self.target_element_js_value {
      Some(value) => value.clone(),
      None => wasm_bindgen::JsValue::UNDEFINED,
    }
  }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LynxEventData {
  #[serde(rename = "type")]
  event_name: String,
  time_stamp: f64,
  bubbles: bool,
  cancelable: bool,
  #[serde(skip_deserializing, default)]
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
}

/**
 * Lynx Synthetic Event
 * This is the exactly the object of https://lynxjs.org/api/lynx-api/event/event#event
 * The event is designed to be serializable and transferable between Rust <-> JS and main thread <-> worker thread.
 */
impl LynxEventData {
  pub fn new(name: String, event: &web_sys::Event) -> LynxEventData {
    // if detail is object, we need to deserialize it separately
    let detail_js = js_sys::Reflect::get(event, &JsValue::from_str("detail")).ok();
    let detail = match detail_js {
      Some(js_value) => {
        if js_value.is_object() {
          let detail: EventDetail = serde_wasm_bindgen::from_value(js_value).unwrap();
          Some(detail)
        } else {
          None
        }
      }
      None => None,
    };
    let mut raw_event: LynxEventData = serde_wasm_bindgen::from_value(event.into()).unwrap();
    raw_event.event_name = name;
    raw_event.detail = detail;
    raw_event
  }
}
#[wasm_bindgen]
impl LynxEventData {}
