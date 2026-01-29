/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::MainThreadWasmContext;
use crate::constants;
use wasm_bindgen::prelude::*;

/**
 * for return of __GetEvents
 */
#[wasm_bindgen]
pub struct EventInfo {
  #[wasm_bindgen(getter_with_clone)]
  pub event_name: String,
  #[wasm_bindgen(getter_with_clone)]
  pub event_type: String,
  #[wasm_bindgen(getter_with_clone)]
  pub event_handler: wasm_bindgen::JsValue,
}

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen]
  pub fn add_cross_thread_event(
    &mut self,
    unique_id: usize,
    event_type: String,
    event_name: String,
    event_handler_identifier: Option<String>,
  ) {
    let event_name = event_name.to_ascii_lowercase();
    let event_name_str = event_name.as_str();
    let event_type = event_type.to_ascii_lowercase();
    self.enable_event(&event_name);

    let is_allowlisted = constants::ELEMENT_REACTIVE_EVENTS.contains(event_name_str);
    let mut should_enable = false;
    let mut should_disable = false;

    if let Some(binding) = self.get_element_data_by_unique_id(unique_id) {
      let mut element_data = binding.borrow_mut();
      if is_allowlisted {
        let old_handler =
          element_data.get_framework_cross_thread_event_handler(&event_name, &event_type);
        match (&old_handler, &event_handler_identifier) {
          (None, Some(_)) => should_enable = true,
          (Some(_), None) => should_disable = true,
          _ => {}
        }
      }

      element_data.replace_framework_cross_thread_event_handler(
        event_name.clone(),
        event_type,
        event_handler_identifier,
      );
    }
    if should_enable {
      if let Some(element) = self.unique_id_to_dom_map.get(&unique_id) {
        self
          .mts_binding
          .enable_element_event(element, event_name_str);
      }
    } else if should_disable {
      if let Some(element) = self.unique_id_to_dom_map.get(&unique_id) {
        self
          .mts_binding
          .disable_element_event(element, event_name_str);
      }
    }
  }

  #[wasm_bindgen]
  pub fn add_run_worklet_event(
    &mut self,
    unique_id: usize,
    event_type: String,
    event_name: String,
    event_handler_identifier: Option<JsValue>,
  ) {
    let event_name = event_name.to_ascii_lowercase();
    let event_name_str = event_name.as_str();
    let event_type = event_type.to_ascii_lowercase();
    self.enable_event(&event_name);

    let is_allowlisted = constants::ELEMENT_REACTIVE_EVENTS.contains(event_name_str);
    let mut should_enable = false;
    let mut should_disable = false;

    if let Some(binding) = self.get_element_data_by_unique_id(unique_id) {
      let mut element_data = binding.borrow_mut();
      if is_allowlisted {
        let old_handler =
          element_data.get_framework_run_worklet_event_handler(&event_name, &event_type);
        match (&old_handler, &event_handler_identifier) {
          (None, Some(_)) => should_enable = true,
          (Some(_), None) => should_disable = true,
          _ => {}
        }
      }

      element_data.replace_framework_run_worklet_event_handler(
        event_name.clone(),
        event_type,
        event_handler_identifier,
      );
    }
    if should_enable {
      if let Some(element) = self.unique_id_to_dom_map.get(&unique_id) {
        self
          .mts_binding
          .enable_element_event(element, event_name_str);
      }
    } else if should_disable {
      if let Some(element) = self.unique_id_to_dom_map.get(&unique_id) {
        self
          .mts_binding
          .disable_element_event(element, event_name_str);
      }
    }
  }

  #[wasm_bindgen]
  pub fn get_event(
    &self,
    unique_id: usize,
    event_name: String,
    event_type: String,
  ) -> wasm_bindgen::JsValue {
    let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
    let element_data = binding.borrow();
    let event_name = event_name.to_ascii_lowercase();
    let event_type = event_type.to_ascii_lowercase();
    wasm_bindgen::JsValue::from(
      element_data.get_framework_cross_thread_event_handler(&event_name, &event_type),
    )
  }

  #[wasm_bindgen]
  pub fn get_events(&self, unique_id: usize) -> Vec<EventInfo> {
    let mut event_infos: Vec<EventInfo> = vec![];
    let event_types = vec!["bindevent", "capture-bind", "catchevent", "capture-catch"];
    let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
    let element_data = binding.borrow();
    for event_type in event_types {
      for event_name in self.enabled_events.iter() {
        if let Some(event_handlers) =
          element_data.get_framework_cross_thread_event_handler(event_name, event_type)
        {
          event_infos.push(EventInfo {
            event_name: event_name.clone(),
            event_type: event_type.to_string(),
            event_handler: wasm_bindgen::JsValue::from(&event_handlers),
          });
        }
        if let Some(event_handlers) =
          element_data.get_framework_run_worklet_event_handler(event_name, event_type)
        {
          event_infos.push(EventInfo {
            event_name: event_name.clone(),
            event_type: event_type.to_string(),
            event_handler: wasm_bindgen::JsValue::from(&event_handlers),
          });
        }
      }
    }
    event_infos
  }

  pub fn dispatch_event_by_path(
    &self,
    bubble_unique_id_path: &[usize],
    event_name: &str,
    is_capture: bool,
    serialized_event: &JsValue,
  ) -> bool {
    let event_name = event_name.to_ascii_lowercase();
    let target_unique_id = bubble_unique_id_path.first().cloned().unwrap_or_default();

    let binding = self
      .get_element_data_by_unique_id(target_unique_id)
      .unwrap();
    let target_element_data = binding.borrow();

    let target_element_dataset = target_element_data.dataset.clone();

    let iter: Box<dyn Iterator<Item = &usize> + '_> = if is_capture {
      Box::new(bubble_unique_id_path.iter().rev())
    } else {
      Box::new(bubble_unique_id_path.iter())
    };
    for unique_id in iter {
      let mut is_caught = false;
      // now dispatch event
      // if has cross thread handler, we should get the parent component id
      let bind_handler_name = if is_capture {
        "capture-bind"
      } else {
        "bindevent"
      };
      let catch_handler_name = if is_capture {
        "capture-catch"
      } else {
        "catchevent"
      };
      let binding = self.get_element_data_by_unique_id(*unique_id).unwrap();
      let current_target_element_data = binding.borrow();
      {
        // cross thread handler
        let bind_handler = current_target_element_data
          .get_framework_cross_thread_event_handler(&event_name, bind_handler_name);
        let catch_handler = current_target_element_data
          .get_framework_cross_thread_event_handler(&event_name, catch_handler_name);
        if bind_handler.is_some() || catch_handler.is_some() {
          let current_target_parent_component_id = {
            let parent_component_unique_id = current_target_element_data.parent_component_unique_id;
            if self.page_element_unique_id == Some(parent_component_unique_id) {
              None
            } else {
              self
                .get_element_data_by_unique_id(parent_component_unique_id)
                .and_then(|binding| binding.borrow().component_id.clone())
            }
          };
          is_caught = catch_handler.is_some();
          for handler in [bind_handler, catch_handler].iter().flatten() {
            self.mts_binding.publish_event(
              handler,
              current_target_parent_component_id.as_deref(),
              serialized_event,
              target_unique_id,
              &target_element_dataset.clone().into(),
              *unique_id,
              &current_target_element_data.dataset.clone().into(),
            );
          }
        }
      }
      {
        // run worklet handler
        let bind_handler = current_target_element_data
          .get_framework_run_worklet_event_handler(&event_name, bind_handler_name);
        let catch_handler = current_target_element_data
          .get_framework_run_worklet_event_handler(&event_name, catch_handler_name);
        if bind_handler.is_some() || catch_handler.is_some() {
          is_caught = catch_handler.is_some();
          if let Some(handler) = bind_handler {
            self.mts_binding.publish_mts_event(
              &handler,
              serialized_event,
              target_unique_id,
              &target_element_dataset.clone().into(),
              *unique_id,
              &current_target_element_data.dataset.clone().into(),
            );
          }
          if let Some(handler) = catch_handler {
            self.mts_binding.publish_mts_event(
              &handler,
              serialized_event,
              target_unique_id,
              &target_element_dataset.clone().into(),
              *unique_id,
              &current_target_element_data.dataset.clone().into(),
            );
          }
        }
      }
      // assign elementRefptr to target and current_target

      if is_caught {
        return true;
      }
    }
    false
  }

  #[wasm_bindgen]
  pub fn common_event_handler(
    &self,
    event: JsValue,
    bubble_unique_id_path: Vec<usize>,
    event_name: &str,
  ) {
    let caught = self.dispatch_event_by_path(&bubble_unique_id_path, event_name, true, &event);
    if !caught {
      self.dispatch_event_by_path(&bubble_unique_id_path, event_name, false, &event);
    }
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
 *
 */
impl MainThreadWasmContext {
  pub(super) fn enable_event(&mut self, event_name: &String) {
    if !self.enabled_events.contains(event_name) {
      self.enabled_events.insert(event_name.clone());
      self.mts_binding.add_event_listener(event_name);
    }
  }
}
