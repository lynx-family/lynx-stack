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
  pub fn add_cross_thread_event(
    &self,
    unique_id: usize,
    event_type: String,
    event_name: String,
    event_handler_identifier: Option<String>,
  ) {
    let event_name = event_name.to_ascii_lowercase();
    let event_name_str = event_name.as_str();
    let event_type = event_type.to_ascii_lowercase();
    self.enable_event(&event_name);

    let has_handler = event_handler_identifier.is_some();

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
        event_type.clone(),
        event_handler_identifier,
      );
    }

    if event_type == "global-bindevent" {
      self.update_global_bind_events(unique_id, &event_name, has_handler);
    }

    if should_enable {
      if let Some(element) = self.get_dom_ref_by_unique_id(unique_id) {
        let _ = self
          .mts_binding
          .enable_element_event(&element, event_name_str);
      }
    } else if should_disable {
      if let Some(element) = self.get_dom_ref_by_unique_id(unique_id) {
        let _ = self
          .mts_binding
          .disable_element_event(&element, event_name_str);
      }
    }
  }

  pub fn add_run_worklet_event(
    &self,
    unique_id: usize,
    event_type: String,
    event_name: String,
    event_handler_identifier: Option<JsValue>,
  ) {
    let event_name = event_name.to_ascii_lowercase();
    let event_name_str = event_name.as_str();
    let event_type = event_type.to_ascii_lowercase();
    self.enable_event(&event_name);

    let has_handler = event_handler_identifier.is_some();

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
        event_type.clone(),
        event_handler_identifier,
      );
    }

    if event_type == "global-bindevent" {
      self.update_global_bind_events(unique_id, &event_name, has_handler);
    }

    if should_enable {
      if let Some(element) = self.get_dom_ref_by_unique_id(unique_id) {
        let _ = self
          .mts_binding
          .enable_element_event(&element, event_name_str);
      }
    } else if should_disable {
      if let Some(element) = self.get_dom_ref_by_unique_id(unique_id) {
        let _ = self
          .mts_binding
          .disable_element_event(&element, event_name_str);
      }
    }
  }

  /// Registers or removes a callback bound through `__AddEventListener`.
  ///
  /// `closure` of `None` removes: a specific callback when `remove_target` is
  /// given, otherwise every callback for this event name and type. Unlike the
  /// cross-thread and worklet slots, which hold a single handler each, this one
  /// holds a list, so clearing has to know *which* callback to drop.
  pub fn add_closure_event(
    &self,
    unique_id: usize,
    event_type: String,
    event_name: String,
    closure: Option<JsValue>,
    remove_target: Option<JsValue>,
  ) {
    let event_name = event_name.to_ascii_lowercase();
    let event_name_str = event_name.as_str();
    let event_type = event_type.to_ascii_lowercase();
    self.enable_event(&event_name);

    let is_allowlisted = constants::ELEMENT_REACTIVE_EVENTS.contains(event_name_str);
    let mut should_enable = false;
    let mut should_disable = false;
    let mut has_handler = false;

    if let Some(binding) = self.get_element_data_by_unique_id(unique_id) {
      let mut element_data = binding.borrow_mut();
      let had_handler = !element_data
        .get_closure_event_handlers(&event_name, &event_type)
        .is_empty();

      if let Some(closure) = closure {
        element_data.add_closure_event_handler(event_name.clone(), event_type.clone(), closure);
        has_handler = true;
      } else {
        has_handler = element_data.remove_closure_event_handler(
          &event_name,
          &event_type,
          remove_target.as_ref(),
        );
      }

      if is_allowlisted {
        // Only the transition between "no handler" and "some handler" toggles
        // the delegated DOM listener.
        should_enable = !had_handler && has_handler;
        should_disable = had_handler && !has_handler;
      }
    }

    if event_type == "global-bindevent" {
      self.update_global_bind_events(unique_id, &event_name, has_handler);
    }

    if should_enable {
      if let Some(element) = self.get_dom_ref_by_unique_id(unique_id) {
        let _ = self
          .mts_binding
          .enable_element_event(&element, event_name_str);
      }
    } else if should_disable {
      if let Some(element) = self.get_dom_ref_by_unique_id(unique_id) {
        let _ = self
          .mts_binding
          .disable_element_event(&element, event_name_str);
      }
    }
  }

  fn update_global_bind_events(&self, unique_id: usize, event_name: &str, has_handler: bool) {
    if has_handler {
      self
        .global_bind_events
        .borrow_mut()
        .entry(event_name.to_string())
        .or_default()
        .insert(unique_id);
    } else if let Some(binding) = self.get_element_data_by_unique_id(unique_id) {
      let still_bound = {
        let element_data = binding.borrow();
        element_data
          .get_framework_cross_thread_event_handler(event_name, "global-bindevent")
          .is_some()
          || element_data
            .get_framework_run_worklet_event_handler(event_name, "global-bindevent")
            .is_some()
      };
      if !still_bound {
        if let Some(ids) = self.global_bind_events.borrow_mut().get_mut(event_name) {
          ids.remove(&unique_id);
        }
      }
    }
  }

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

  pub fn get_events(&self, unique_id: usize) -> Vec<EventInfo> {
    let mut event_infos: Vec<EventInfo> = vec![];
    let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
    let element_data = binding.borrow();
    let enabled_events = self.enabled_events.borrow();
    for event_type in constants::EVENT_TYPES.iter() {
      for event_name in enabled_events.iter() {
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

    let binding = match self.get_element_data_by_unique_id(target_unique_id) {
      Some(b) => b,
      None => return false,
    };
    // Cloned out, not held: every JS call below can re-enter and write to this
    // same element data.
    let target_element_dataset: JsValue = binding.borrow().dataset.clone().into();

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
      let binding = match self.get_element_data_by_unique_id(*unique_id) {
        Some(b) => b,
        None => continue,
      };
      // Read out every handler this element carries and release the element
      // data before any of them run. A main-thread handler is free to call the
      // Element PAPIs on the element it is dispatching on - add a listener, set
      // a dataset, and a `once` listener removes itself - which borrows this
      // same cell mutably. Holding the borrow across the call would abort with
      // "recursive use of an object".
      let (
        cross_thread_bind_handler,
        cross_thread_catch_handler,
        worklet_bind_handler,
        worklet_catch_handler,
        closure_bind_handlers,
        closure_catch_handlers,
        current_target_dataset,
        parent_component_unique_id,
      ) = {
        let current_target_element_data = binding.borrow();
        (
          current_target_element_data
            .get_framework_cross_thread_event_handler(&event_name, bind_handler_name),
          current_target_element_data
            .get_framework_cross_thread_event_handler(&event_name, catch_handler_name),
          current_target_element_data
            .get_framework_run_worklet_event_handler(&event_name, bind_handler_name),
          current_target_element_data
            .get_framework_run_worklet_event_handler(&event_name, catch_handler_name),
          current_target_element_data.get_closure_event_handlers(&event_name, bind_handler_name),
          current_target_element_data.get_closure_event_handlers(&event_name, catch_handler_name),
          current_target_element_data.dataset.clone(),
          current_target_element_data.parent_component_unique_id,
        )
      };
      let current_target_dataset: JsValue = current_target_dataset.into();
      {
        // cross thread handler
        let (bind_handler, catch_handler) = (cross_thread_bind_handler, cross_thread_catch_handler);
        if bind_handler.is_some() || catch_handler.is_some() {
          let current_target_parent_component_id = {
            if self.page_element_unique_id.get() == Some(parent_component_unique_id) {
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
              &target_element_dataset,
              *unique_id,
              &current_target_dataset,
            );
          }
        }
      }
      {
        // run worklet handler
        let (bind_handler, catch_handler) = (worklet_bind_handler, worklet_catch_handler);
        if bind_handler.is_some() || catch_handler.is_some() {
          is_caught = catch_handler.is_some();
          if let Some(handler) = bind_handler {
            self.mts_binding.publish_mts_event(
              &handler,
              serialized_event,
              target_unique_id,
              &target_element_dataset,
              *unique_id,
              &current_target_dataset,
            );
          }
          if let Some(handler) = catch_handler {
            self.mts_binding.publish_mts_event(
              &handler,
              serialized_event,
              target_unique_id,
              &target_element_dataset,
              *unique_id,
              &current_target_dataset,
            );
          }
        }
      }
      {
        // callback registered through `__AddEventListener`
        let (bind_handlers, catch_handlers) = (closure_bind_handlers, closure_catch_handlers);
        if !bind_handlers.is_empty() || !catch_handlers.is_empty() {
          // Assigned, not accumulated, matching the two blocks above: the
          // callback form is not expected to be mixed with the handler-name or
          // worklet forms on the same element, event name and type.
          is_caught = !catch_handlers.is_empty();
          for closure in bind_handlers.iter().chain(catch_handlers.iter()) {
            self.mts_binding.run_element_closure(
              closure,
              serialized_event,
              target_unique_id,
              &target_element_dataset,
              *unique_id,
              &current_target_dataset,
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

  pub fn common_event_handler(
    &self,
    event: JsValue,
    bubble_unique_id_path: Vec<usize>,
    event_name: &str,
    is_bubble: bool,
  ) {
    let caught = self.dispatch_event_by_path(&bubble_unique_id_path, event_name, true, &event);
    if !caught {
      if is_bubble {
        self.dispatch_event_by_path(&bubble_unique_id_path, event_name, false, &event);
      } else if let Some(target_id) = bubble_unique_id_path.first() {
        self.dispatch_event_by_path(&[*target_id], event_name, false, &event);
      }
    }

    if is_bubble {
      self.dispatch_global_bind_event(&bubble_unique_id_path, event_name, &event);
    }
  }

  pub fn dispatch_global_bind_event(
    &self,
    bubble_unique_id_path: &[usize],
    event_name: &str,
    serialized_event: &JsValue,
  ) {
    let event_name_lowercase = event_name.to_ascii_lowercase();
    let target_unique_id = bubble_unique_id_path.first().cloned().unwrap_or_default();

    let target_element_dataset: JsValue =
      if let Some(binding) = self.get_element_data_by_unique_id(target_unique_id) {
        binding.borrow().dataset.clone()
      } else {
        None
      }
      .into();

    let global_bind_ids: Vec<usize> = self
      .global_bind_events
      .borrow()
      .get(&event_name_lowercase)
      .map(|ids| ids.iter().copied().collect())
      .unwrap_or_default();

    for unique_id in global_bind_ids {
      let binding = match self.get_element_data_by_unique_id(unique_id) {
        Some(b) => b,
        None => continue,
      };
      // Same rule as `dispatch_event_by_path`: read the handlers out, then drop
      // the element data before running them.
      let (bind_handler, run_worklet_handler, current_target_dataset, parent_component_unique_id) = {
        let current_target_element_data = binding.borrow();
        (
          current_target_element_data
            .get_framework_cross_thread_event_handler(&event_name_lowercase, "global-bindevent"),
          current_target_element_data
            .get_framework_run_worklet_event_handler(&event_name_lowercase, "global-bindevent"),
          current_target_element_data.dataset.clone(),
          current_target_element_data.parent_component_unique_id,
        )
      };
      let current_target_dataset: JsValue = current_target_dataset.into();

      if let Some(handler) = bind_handler {
        let current_target_parent_component_id = {
          if self.page_element_unique_id.get() == Some(parent_component_unique_id) {
            None
          } else {
            self
              .get_element_data_by_unique_id(parent_component_unique_id)
              .and_then(|binding| binding.borrow().component_id.clone())
          }
        };
        self.mts_binding.publish_event(
          &handler,
          current_target_parent_component_id.as_deref(),
          serialized_event,
          target_unique_id,
          &target_element_dataset,
          unique_id,
          &current_target_dataset,
        );
      }

      if let Some(handler) = run_worklet_handler {
        self.mts_binding.publish_mts_event(
          &handler,
          serialized_event,
          target_unique_id,
          &target_element_dataset,
          unique_id,
          &current_target_dataset,
        );
      }
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
  pub(super) fn enable_event(&self, event_name: &String) {
    {
      let mut enabled_events = self.enabled_events.borrow_mut();
      if enabled_events.contains(event_name) {
        return;
      }
      enabled_events.insert(event_name.clone());
    }
    // Outside the borrow: attaching the delegated listener enters JS.
    self.mts_binding.add_event_listener(event_name);
  }
}
