use std::collections::hash_set::Iter;

use super::MainThreadGlobalThis;
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
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__AddEvent")]
  pub fn add_event(
    &mut self,
    unique_id: i32,
    event_type: String,
    event_name: String,
    event_handler: wasm_bindgen::JsValue,
  ) {
    self.enable_event(&event_name);
    let mut element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow_mut();
    if event_handler.is_null_or_undefined() {
      element_data.replace_framework_cross_thread_event_handler(
        event_name.clone(),
        event_type.clone(),
        None,
      );
      element_data.replace_framework_run_worklet_event_handler(event_name, event_type, None);
    } else if event_handler.is_object() {
      element_data.replace_framework_run_worklet_event_handler(
        event_name.clone(),
        event_type,
        Some(event_handler),
      );
    } else if let Some(identifier) = event_handler.as_string() {
      element_data.replace_framework_cross_thread_event_handler(
        event_name.clone(),
        event_type,
        Some(identifier),
      );
    }
  }

  #[wasm_bindgen(js_name = "__GetEvent")]
  pub fn get_event(
    &self,
    unique_id: i32,
    event_name: &str,
    event_type: &str,
  ) -> wasm_bindgen::JsValue {
    let element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow();
    wasm_bindgen::JsValue::from(
      element_data.get_framework_cross_thread_event_handler(event_name, event_type),
    )
  }

  #[wasm_bindgen(js_name = "__GetEvents")]
  pub fn get_events(&self, unique_id: i32) -> Vec<EventInfo> {
    let mut event_infos: Vec<EventInfo> = vec![];
    let event_types = vec!["bind", "capture-bind", "catch", "capture-catch"];
    let element_data = self
      .unique_id_to_element_map
      .get(&unique_id)
      .unwrap()
      .borrow();
    for event_type in event_types {
      for event_name in self.get_enabled_events() {
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
impl MainThreadGlobalThis {
  fn get_enabled_events(&self) -> Iter<'_, String> {
    self.enabled_events.iter()
  }

  fn enable_event(&mut self, event_name: &str) {
    if !self.enabled_events.contains(event_name) {
      self.enabled_events.insert(event_name.to_string());
      self.mts_binding.enable_event(event_name);
    }
  }

  fn dispatch_event_by_path(
    &self,
    bubble_path: &[i32],
    event_name: &str,
    target_unique_id: i32,
    serialized_event: &wasm_bindgen::JsValue,
    capture: bool,
  ) -> bool {
    let target_element_data = self
      .unique_id_to_element_map
      .get(&target_unique_id)
      .unwrap()
      .borrow();
    let target_js_object = target_element_data.create_event_target_object();
    // if current is capture phase, we should iterate from root to target
    let iter: Box<dyn Iterator<Item = &i32>> = if capture {
      Box::new(bubble_path.iter().rev())
    } else {
      Box::new(bubble_path.iter())
    };
    let element_ref_ptr_str = wasm_bindgen::JsValue::from_str("elementRefptr");
    for unique_id in iter {
      let mut has_catched = false;
      // assign element target and currentTarget
      let target_js_object_shallow_copied =
        js_sys::Object::assign(&js_sys::Object::new(), &target_js_object);
      let current_target_element_data = self
        .unique_id_to_element_map
        .get(unique_id)
        .unwrap()
        .borrow();
      let current_target_js_object = current_target_element_data.create_event_target_object();
      let _ = js_sys::Reflect::set(
        serialized_event,
        &wasm_bindgen::JsValue::from_str("target"),
        &target_js_object_shallow_copied,
      );
      let _ = js_sys::Reflect::set(
        serialized_event,
        &wasm_bindgen::JsValue::from_str("currentTarget"),
        &current_target_js_object,
      );
      // now dispatch event
      // if has cross thread handler, we should get the parent component id
      let bind_handler_name = format!("{}bind", if capture { "capture-" } else { "" });
      let catch_handler_name = format!("{}catch", if capture { "capture-" } else { "" });
      {
        // cross thread handler
        let bind_handler = current_target_element_data
          .get_framework_cross_thread_event_handler(event_name, &bind_handler_name);
        let catch_handler = current_target_element_data
          .get_framework_cross_thread_event_handler(event_name, &catch_handler_name);
        if bind_handler.is_some() || catch_handler.is_some() {
          let current_target_parent_component_id = {
            let parent_component_unique_id = current_target_element_data.parent_component_unique_id;
            if self.page_element_unique_id == Some(parent_component_unique_id) {
              None
            } else {
              let parent_component_element_data = self
                .unique_id_to_element_map
                .get(&parent_component_unique_id)
                .unwrap()
                .borrow();
              parent_component_element_data.component_id.clone()
            }
          };
          if let Some(handler) = bind_handler {
            if let Some(parent_component_id) = &current_target_parent_component_id {
              self.bts_rpc.publish_component_event(
                parent_component_id,
                event_name,
                serialized_event,
              );
            } else {
              self.bts_rpc.publish_event(&handler, serialized_event);
            }
          }
          if let Some(handler) = catch_handler {
            has_catched = true;
            if let Some(parent_component_id) = &current_target_parent_component_id {
              self.bts_rpc.publish_component_event(
                parent_component_id,
                event_name,
                serialized_event,
              );
            } else {
              self.bts_rpc.publish_event(&handler, serialized_event);
            }
          }
        }
      }
      {
        // run worklet handler
        let bind_handler = current_target_element_data
          .get_framework_run_worklet_event_handler(event_name, &bind_handler_name);
        let catch_handler = current_target_element_data
          .get_framework_run_worklet_event_handler(event_name, &catch_handler_name);
        if bind_handler.is_some() || catch_handler.is_some() {
          // assign elementRefptr to event targets
          let _ = js_sys::Reflect::set(
            &target_js_object_shallow_copied,
            &element_ref_ptr_str,
            &wasm_bindgen::JsValue::from(target_element_data.dom_ref.clone()),
          );
          let _ = js_sys::Reflect::set(
            &current_target_js_object,
            &element_ref_ptr_str,
            &wasm_bindgen::JsValue::from(current_target_element_data.dom_ref.clone()),
          );
          if let Some(handler) = bind_handler {
            self.mts_binding.run_worklet(&handler, serialized_event);
          }
          if let Some(handler) = catch_handler {
            self.mts_binding.run_worklet(&handler, serialized_event);
          }
        }
      }
      // assign elementRefptr to target and current_target

      if has_catched {
        return has_catched;
      }
    }
    false
  }
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__wasmCommonEventHandler")]
  pub fn __wasm_common_event_handler(
    &self,
    event_name: &str,
    mut bubble_path: Vec<i32>,
    serialized_event: wasm_bindgen::JsValue,
  ) {
    let event_name: String = constants::WEB_EVENT_NAME_TO_LYNX_MAPPING
      .get(event_name)
      .cloned()
      .unwrap_or(event_name)
      .to_string();
    if self.enabled_events.contains(&event_name) {
      // generate path from target to root
      js_sys::Reflect::set(
        &serialized_event,
        &wasm_bindgen::JsValue::from_str("type"),
        &wasm_bindgen::JsValue::from_str(&event_name),
      )
      .unwrap();

      let target_unique_id = bubble_path[0];
      self.dispatch_event_by_path(
        &bubble_path,
        &event_name,
        target_unique_id,
        &serialized_event,
        true,
      );
      // remove target from path for bubble phase
      bubble_path.remove(0);
      self.dispatch_event_by_path(
        &bubble_path,
        &event_name,
        target_unique_id,
        &serialized_event,
        false,
      );
    }
  }
}
