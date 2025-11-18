use super::MainThreadGlobalThis;
use crate::constants;
use std::{cell::RefCell, collections::HashMap, rc::Rc};
use wasm_bindgen::prelude::*;
use wasm_bindgen_derive::TryFromJsValue;

#[derive(Default, Clone)]
pub(crate) struct EventHandler {
  /* bind capture-bind catch capture-catch */
  framework_cross_thread_identifier: HashMap<String, String>,
  /* bind capture-bind catch capture-catch */
  framework_run_worklet_identifier: HashMap<String, wasm_bindgen::JsValue>,
  /* bind capture-bind catch capture-catch */
  // event_type_to_handlers: HashMap<String, Vec<js_sys::Function>>,
}

pub(crate) struct LynxElementData {
  pub(crate) unique_id: i32,
  pub(crate) css_id: i32,
  pub(crate) parent_component_unique_id: i32,
  pub(crate) component_id: Option<String>,
  pub(crate) dataset: Option<js_sys::Object>,
  pub(crate) component_config: Option<js_sys::Object>,
  pub(crate) event_handlers_map: Option<HashMap<String, EventHandler>>,
  pub(crate) dom_ref: web_sys::HtmlElement,
}

impl LynxElementData {
  pub(crate) fn new(dom_ref: web_sys::HtmlElement) -> Self {
    Self {
      unique_id: -1,
      css_id: 0,
      parent_component_unique_id: -1,
      component_id: None,
      dataset: None,
      component_config: None,
      event_handlers_map: None,
      dom_ref,
    }
  }

  pub(crate) fn get_framework_cross_thread_event_handler(
    &self,
    event_name: &str,
    event_type: &str,
  ) -> Option<String> {
    let event_handlers_map = self.event_handlers_map.as_ref()?;
    let event_handler_store = event_handlers_map.get(event_name)?;
    event_handler_store
      .framework_cross_thread_identifier
      .get(event_type)
      .cloned()
  }

  pub(crate) fn replace_framework_cross_thread_event_handler(
    &mut self,
    event_name: String,
    event_type: String,
    identifier: Option<String>,
  ) {
    let event_handlers_map = self.event_handlers_map.get_or_insert_default();
    let event_handler_store = event_handlers_map.entry(event_name).or_default();
    if let Some(identifier) = identifier {
      event_handler_store
        .framework_cross_thread_identifier
        .insert(event_type, identifier);
    } else {
      event_handler_store
        .framework_cross_thread_identifier
        .remove(&event_type);
    }
  }

  pub(crate) fn get_framework_run_worklet_event_handler(
    &self,
    event_name: &str,
    event_type: &str,
  ) -> Option<wasm_bindgen::JsValue> {
    let event_handlers_map = self.event_handlers_map.as_ref()?;
    let event_handler_store = event_handlers_map.get(event_name)?;
    event_handler_store
      .framework_run_worklet_identifier
      .get(event_type)
      .cloned()
  }

  pub(crate) fn replace_framework_run_worklet_event_handler(
    &mut self,
    event_name: String,
    event_type: String,
    mts_event_identifier: Option<wasm_bindgen::JsValue>,
  ) {
    let event_handlers_map = self.event_handlers_map.get_or_insert_default();
    let event_handler_store = event_handlers_map.entry(event_name).or_default();
    if let Some(identifier) = mts_event_identifier {
      event_handler_store
        .framework_run_worklet_identifier
        .insert(event_type, identifier);
    } else {
      event_handler_store
        .framework_run_worklet_identifier
        .remove(&event_type);
    }
  }

  pub(crate) fn create_event_target_object(&self) -> js_sys::Object {
    let entries = js_sys::Array::new();
    entries.push(&js_sys::Array::of2(
      &wasm_bindgen::JsValue::from_str("uniqueId"),
      &wasm_bindgen::JsValue::from_f64(self.unique_id as f64),
    ));
    entries.push(&js_sys::Array::of2(
      &wasm_bindgen::JsValue::from_str("id"),
      &self.dom_ref.id().into(),
    ));
    entries.push(&js_sys::Array::of2(
      &wasm_bindgen::JsValue::from_str("dataset"),
      &self
        .dataset
        .clone()
        .unwrap_or_else(|| js_sys::Object::new()),
    ));
    js_sys::Object::from_entries(&entries).unwrap()
  }

  // pub(crate) fn add_event_listener_with_js_function(
  //   &self,
  //   event_name: String,
  //   event_type: String,
  //   js_function: js_sys::Function,
  // ) {
  //   let event_handlers_map = self.event_handlers_map.get_or_insert_default();
  //   let event_handler_store = event_handlers_map.entry(event_name).or_default();
  //   event_handler_store
  //     .event_type_to_handlers
  //     .entry(event_type)
  //     .or_default()
  //     .push(js_function);
  // }

  // pub(crate) fn remove_js_function_event_listener(
  //   &self,
  //   event_name: String,
  //   event_type: &str,
  //   js_function: js_sys::Function,
  // ) {
  //   let mut element_data = self.data.borrow_mut();
  //   let event_handlers_map = self.event_handlers_map.get_or_insert_default();
  //   let event_handler_store = event_handlers_map.entry(event_name).or_default();
  //   event_handler_store
  //     .event_type_to_handlers
  //     .entry(event_type.to_string())
  //     .or_default()
  //     .retain(|f| !f.loose_eq(&js_function));
  // }
}
