use super::*;
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use crate::main_thread::pure_element_papis;

/**
 * Lynx Event Types passed from __AddEvent
 */
pub enum LynxEventType {
  /**
   * bubble phase event
   */
  BindEvent,
  /**
   * bubble phase and stop propagation event
   */
  CatchEvent,
  /**
   * capture phase event
   */
  CaptureBind,
  /**
   * capture phase and stop propagation event
   */
  CaptureCatch,
}

struct MTSFunctionEventHandler {
  handler: js_sys::Function,
  is_capture: bool,
}

struct LynxEventStorage {
  /**
   * for cross thread event handler, it is a string id
   * There is only one bind handler and one catch handler for one event type on one element
   */
  cross_thread_handler_bind: Option<String>,
  is_cross_thread_bind_stop_propagation: bool,
  cross_thread_handler_capture: Option<String>,
  is_cross_thread_capture_stop_propagation: bool,

  /**
   * for mts runWorklet() event handler, the value is stored here
   * there is also only one bind handler and one catch handler for one event type on one element
   */
  mts_run_worklet_value_bind: Option<wasm_bindgen::JsValue>,
  is_mts_run_worklet_bind_stop_propagation: bool,
  mts_run_worklet_value_capture: Option<wasm_bindgen::JsValue>,
  is_mts_run_worklet_capture_stop_propagation: bool,

  /**
   * we can have multiple mts function handlers for one event type on one element
   */
  mts_function_handler: Vec<MTSFunctionEventHandler>,
}

impl LynxEventStorage {
  pub fn new() -> Self {
    LynxEventStorage {
      cross_thread_handler_bind: None,
      is_cross_thread_bind_stop_propagation: false,
      cross_thread_handler_capture: None,
      is_cross_thread_capture_stop_propagation: false,
      mts_run_worklet_value_bind: None,
      is_mts_run_worklet_bind_stop_propagation: false,
      mts_run_worklet_value_capture: None,
      is_mts_run_worklet_capture_stop_propagation: false,
      mts_function_handler: vec![],
    }
  }

  pub fn is_empty(&self) -> bool {
    self.cross_thread_handler_bind.is_none()
      && self.cross_thread_handler_capture.is_none()
      && self.mts_run_worklet_value_bind.is_none()
      && self.mts_run_worklet_value_capture.is_none()
      && self.mts_function_handler.is_empty()
  }
}

/**
 * Event delegation system for handling events in the web platform.
 * This module provides functionalities to delegate events efficiently.
 * It helps in managing event listeners and propagating events
 * through the DOM tree.
 *
 * This event system is designed to work with the Lynx web platform,
 * allowing for optimized event handling and improved performance.
 * It includes features such as event bubbling, capturing.
 *
 * The exposure events are also managed in this module.
 *
 * There are two generations of event apis in Lynx:
 *
 *
 *
 *
 * Generation 1:
 *
 * __AddEvent(element, LynxEventType, eventName, handler);
 * For this generation, for bind/catch event handlers, they always replace the previous one.
 * This means that on one element, there is only one bind handler and one catch handler for one event type.
 * Framework side could add a undefined or null handler to remove the event handler.
 * There are 2 types of the Event Handler in this generation.
 * 1. a string which is a id to be dispatched to worker thread, shipped with the SyntheticEvent object
 * 2. a js object {type: 'worklet', value: unknown } for Reactlynx MTS event handler
 *    It has a special behavior to be dispatched in the main thread:
 *      a. there is a special event handler , `runWorklet`, may be assigned to window object
 *      b. when the event is triggered, the `runWorklet` function will be called with `runWorklet(value, [SyntheticEvent]);`
 *        Note: the SyntheticEvent is be decorated with some extra properties:
 *        1. target.elementRefptr is the dom element
 *        2. currentTarget.elementRefptr is the currentTarget dom
 * For this generation, for bind/catch event handlers, they always replace the previous one.
 *
 *
 * Generation 2:
 * __AddEventListener(element, eventName, handler, options);
 * For this generation, multiple event listeners could be added to one element for one event type.
 * The options parameter could be used to specify the behavior of the event listener(capture phase/bubbling phase).
 * There are 2 types of the Event Handler in this generation:
 * 1. a string which is a id to be dispatched to worker thread, shipped with the SyntheticEvent object, same as Generation 1
 * 2. a js function which will be called in the main thread with the SyntheticEvent object.
 *
 * These two generations could co-exist in the same application.
 * The Generation 1 apis could now remove the event listeners added by Generation 2 apis.
 *
 *
 * Oct 30, 2025, after discussed with team, the behavior of interaction between these two generations are defined as below:
 * 1. Generation 1 apis could not remove the event listeners added by Generation 2 apis.
 * 2. Generation 2 apis could remove the "string handler" added by Generation 1&2 apis.
 * 3. Generation 2 apis could not remove the "worklet handler" added by Generation 1 apis.
 *
 */
pub struct EventSystem {
  root_node: web_sys::Node,
  mts_window: wasm_bindgen::JsValue,
  /**
   * event_name -> element_id -> LynxEventStorage
   */
  handler_storage: HashMap<String, HashMap<i32, LynxEventStorage>>,
  common_event_handler: web_sys::EventListener,
  common_event_options: web_sys::AddEventListenerOptions,
}

impl EventSystem {
  pub fn new(root_node: &web_sys::Node, mts_window: wasm_bindgen::JsValue) -> Self {
    let common_event_handler = web_sys::EventListener::new();
    let common_event_options = web_sys::AddEventListenerOptions::new();
    common_event_options.set_capture(true);
    common_event_options.set_passive(true);
    EventSystem {
      root_node: root_node.clone(),
      mts_window,
      handler_storage: HashMap::new(),
      common_event_handler,
      common_event_options,
    }
  }

  pub fn replace_cross_thread_event_handler(
    &mut self,
    element_id: i32,
    event_type: LynxEventType,
    event_name: &str,
    handler_id: String,
  ) {
    self.bind_common_event_handler(event_name);
    let element_map = self
      .handler_storage
      .entry(event_name.to_string())
      .or_insert(HashMap::new());
    let lynx_handler_storage = element_map
      .entry(element_id)
      .or_insert(LynxEventStorage::new());
    match event_type {
      LynxEventType::BindEvent => {
        lynx_handler_storage.cross_thread_handler_bind = Some(handler_id);
        lynx_handler_storage.is_cross_thread_bind_stop_propagation = false;
      }
      LynxEventType::CatchEvent => {
        lynx_handler_storage.cross_thread_handler_bind = Some(handler_id);
        lynx_handler_storage.is_cross_thread_bind_stop_propagation = true;
      }
      LynxEventType::CaptureBind => {
        lynx_handler_storage.cross_thread_handler_capture = Some(handler_id);
        lynx_handler_storage.is_cross_thread_capture_stop_propagation = false;
      }
      LynxEventType::CaptureCatch => {
        lynx_handler_storage.cross_thread_handler_capture = Some(handler_id);
        lynx_handler_storage.is_cross_thread_capture_stop_propagation = true;
      }
    }
  }

  pub fn remove_cross_thread_event_handler(
    &mut self,
    element_id: i32,
    event_type: LynxEventType,
    event_name: &str,
  ) {
    if let Some(element_map) = self.handler_storage.get_mut(event_name) {
      if let Some(lynx_handler_storage) = element_map.get_mut(&element_id) {
        match event_type {
          LynxEventType::BindEvent | LynxEventType::CatchEvent => {
            lynx_handler_storage.cross_thread_handler_bind = None;
          }
          LynxEventType::CaptureBind | LynxEventType::CaptureCatch => {
            lynx_handler_storage.cross_thread_handler_capture = None;
          }
        }
        if lynx_handler_storage.is_empty() {
          element_map.remove(&element_id);
        }
      }
    }
  }

  pub fn replace_run_worklet_event_handler(
    &mut self,
    element_id: i32,
    event_type: LynxEventType,
    event_name: &str,
    worklet_value: wasm_bindgen::JsValue,
  ) {
    self.bind_common_event_handler(event_name);
    let element_map = self
      .handler_storage
      .entry(event_name.to_string())
      .or_insert(HashMap::new());
    let lynx_handler_storage = element_map
      .entry(element_id)
      .or_insert(LynxEventStorage::new());
    match event_type {
      LynxEventType::BindEvent => {
        lynx_handler_storage.mts_run_worklet_value_bind = Some(worklet_value);
        lynx_handler_storage.is_mts_run_worklet_bind_stop_propagation = false;
      }
      LynxEventType::CatchEvent => {
        lynx_handler_storage.mts_run_worklet_value_bind = Some(worklet_value);
        lynx_handler_storage.is_mts_run_worklet_bind_stop_propagation = true;
      }
      LynxEventType::CaptureBind => {
        lynx_handler_storage.mts_run_worklet_value_capture = Some(worklet_value);
        lynx_handler_storage.is_mts_run_worklet_capture_stop_propagation = false;
      }
      LynxEventType::CaptureCatch => {
        lynx_handler_storage.mts_run_worklet_value_capture = Some(worklet_value);
        lynx_handler_storage.is_mts_run_worklet_capture_stop_propagation = true;
      }
    }
  }

  pub fn remove_run_worklet_event_handler(
    &mut self,
    element_id: i32,
    event_type: LynxEventType,
    event_name: &str,
  ) {
    self.bind_common_event_handler(event_name);
    if let Some(element_map) = self.handler_storage.get_mut(event_name) {
      if let Some(lynx_handler_storage) = element_map.get_mut(&element_id) {
        match event_type {
          LynxEventType::BindEvent | LynxEventType::CatchEvent => {
            lynx_handler_storage.mts_run_worklet_value_bind = None;
          }
          LynxEventType::CaptureBind | LynxEventType::CaptureCatch => {
            lynx_handler_storage.mts_run_worklet_value_capture = None;
          }
        }
        if lynx_handler_storage.is_empty() {
          element_map.remove(&element_id);
        }
      }
    }
  }

  pub fn add_mts_function_event_handler(
    &mut self,
    element_id: i32,
    event_name: &str,
    handler: js_sys::Function,
    is_capture: bool,
  ) {
    self.bind_common_event_handler(event_name);
    let element_map = self
      .handler_storage
      .entry(event_name.to_string())
      .or_insert(HashMap::new());
    let lynx_handler_storage = element_map
      .entry(element_id)
      .or_insert(LynxEventStorage::new());
    // check if the handler with same function and config already exists
    let exists = lynx_handler_storage
      .mts_function_handler
      .iter()
      .any(|h| h.is_capture == is_capture && h.handler == handler);
    if !exists {
      lynx_handler_storage
        .mts_function_handler
        .push(MTSFunctionEventHandler {
          handler,
          is_capture,
        });
    }
  }

  pub fn remove_mts_function_event_handler(
    &mut self,
    element_id: i32,
    event_name: &str,
    handler: js_sys::Function,
    is_capture: bool,
  ) {
    if let Some(element_map) = self.handler_storage.get_mut(event_name) {
      if let Some(lynx_handler_storage) = element_map.get_mut(&element_id) {
        lynx_handler_storage
          .mts_function_handler
          .retain(|h| !(h.is_capture == is_capture && h.handler == handler));
        if lynx_handler_storage.is_empty() {
          element_map.remove(&element_id);
        }
      }
    }
  }

  fn bind_common_event_handler(&self, event_name: &str) {
    // to read the bubble:false custom events, we need to add the event listener with capture:true
    // the lynx dosen't provide preventDefault(), therefore, we always use passive:true
    if !self.handler_storage.contains_key(event_name) {
      self
        .root_node
        .add_event_listener_with_event_listener_and_add_event_listener_options(
          event_name,
          &self.common_event_handler,
          &self.common_event_options,
        );
    }
  }

  fn common_event_handler_impl(&self, event: web_sys::Event) {
    let event_name = event.type_();
    if let Some(element_map) = self.handler_storage.get(&event_name) {
      let target_element = event
        .target()
        .unwrap()
        .dyn_into::<web_sys::Element>()
        .unwrap();
      if self.root_node.contains(Some(&target_element)) {
        let mut capture_path: Vec<web_sys::Element> = Vec::new();
        // build the capture path from target to root, only check the parent_element which is an Element
        let mut parent_element = target_element.parent_element();
        while let Some(elem) = parent_element {
          if self.root_node.is_equal_node(Some(&elem)) {
            break;
          }
          parent_element = elem.parent_element();
          capture_path.push(elem);
        }
        capture_path.reverse();
        let target = lynx_event::LynxTarget::new(&target_element);
        let mut synthetic_event = lynx_event::LynxSyntheticEvent::new(event_name.clone(), &event);
        let mut synthetic_event_js_clone: Option<wasm_bindgen::JsValue> = None;
        // capture phase
        // for elem in &capture_path {
        //   let unique_id = pure_element_papis::get_element_unique_id(elem);
        //   if let Some(lynx_handler_storage) = element_map.get(&unique_id) {
        //     // cross thread capture handler
        //     if let Some(handler_id) = &lynx_handler_storage.cross_thread_handler_capture {
        //       let current_target = lynx_event::LynxTarget::new(elem);
        //       synthetic_event.set_current_target(current_target);
        //       todo!("dispatch to worker thread with handler_id: {}", handler_id);
        //     }
        //     // mts runWorklet capture handler
        //     if let Some(worklet_value) = &lynx_handler_storage.mts_run_worklet_value_capture {
        //       let current_target = lynx_event::LynxTarget::new(elem);
        //       let current_target_js = serde_wasm_bindgen::to_value(&current_target).unwrap();
        //       synthetic_event_js_clone = synthetic_event_js_clone.or_else(|| {
        //         Some(serde_wasm_bindgen::to_value(&synthetic_event).unwrap())
        //       });
        //       // we need to assign the elementRefptr to the js object of the currentTarget
        //     }
        //   }
        // }
      }
    }
  }
}
