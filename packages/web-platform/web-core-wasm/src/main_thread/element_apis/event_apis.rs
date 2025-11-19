use super::MainThreadGlobalThis;
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
    unique_id: usize,
    event_type: String,
    event_name: String,
    event_handler: wasm_bindgen::JsValue,
  ) {
    let event_type = event_type.to_ascii_lowercase();
    let event_name = event_name.to_ascii_lowercase();
    self.enable_event(&event_name);
    let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
    let mut element_data = binding.borrow_mut();
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
    unique_id: usize,
    event_name: &str,
    event_type: &str,
  ) -> wasm_bindgen::JsValue {
    let binding = self.get_element_data_by_unique_id(unique_id).unwrap();
    let element_data = binding.borrow();
    wasm_bindgen::JsValue::from(
      element_data.get_framework_cross_thread_event_handler(event_name, event_type),
    )
  }

  #[wasm_bindgen(js_name = "__GetEvents")]
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
    bubble_path: &[usize],
    event_name: &str,
    is_capture: bool,
    target_element: &web_sys::HtmlElement,
    serialized_event: &wasm_bindgen::JsValue,
  ) -> bool {
    let event_name = event_name.to_ascii_lowercase();
    for unique_id in bubble_path.iter() {
      let mut has_catched = false;
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
              let binding = self
                .get_element_data_by_unique_id(parent_component_unique_id)
                .unwrap();
              let parent_component_element_data = binding.borrow();
              parent_component_element_data.component_id.clone()
            }
          };
          has_catched = catch_handler.is_some();
          for handler in [bind_handler, catch_handler].iter().flatten() {
            if let Some(parent_component_id) = &current_target_parent_component_id {
              self.mts_binding.public_component_event(
                parent_component_id,
                handler,
                serialized_event,
                target_element,
                &current_target_element_data.dom_ref.clone(),
              );
            } else {
              self.mts_binding.publish_event(
                handler,
                serialized_event,
                target_element,
                &current_target_element_data.dom_ref.clone(),
              );
            }
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
          has_catched = catch_handler.is_some();
          if let Some(handler) = bind_handler {
            self.mts_binding.run_worklet(
              &handler,
              serialized_event,
              target_element,
              &current_target_element_data.dom_ref.clone(),
            );
          }
          if let Some(handler) = catch_handler {
            self.mts_binding.run_worklet(
              &handler,
              serialized_event,
              target_element,
              &current_target_element_data.dom_ref.clone(),
            );
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
  fn enable_event(&mut self, event_name: &str) {
    if !self.enabled_events.contains(event_name) {
      self.enabled_events.insert(event_name.to_string());
      self.mts_binding.enable_event(event_name);
    }
  }
}
