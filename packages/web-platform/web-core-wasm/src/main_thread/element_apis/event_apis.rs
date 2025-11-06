use super::{LynxElement, MainThreadGlobalThis};
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
    &self,
    element: &LynxElement,
    event_type: String,
    event_name: String,
    event_handler: wasm_bindgen::JsValue,
  ) {
    if event_handler.is_null_or_undefined() {
      element.replace_framework_cross_thread_event_handler(
        event_name.clone(),
        event_type.clone(),
        None,
      );
      element.replace_framework_run_worklet_event_handler(event_name, event_type, None);
    } else if event_handler.is_object() {
      element.replace_framework_run_worklet_event_handler(
        event_name,
        event_type,
        Some(event_handler),
      );
    } else if let Some(identifier) = event_handler.as_string() {
      element.replace_framework_cross_thread_event_handler(
        event_name,
        event_type,
        Some(identifier),
      );
    }
  }

  #[wasm_bindgen(js_name = "__GetEvent")]
  pub fn get_event(
    &self,
    element: &LynxElement,
    event_name: &str,
    event_type: &str,
  ) -> wasm_bindgen::JsValue {
    wasm_bindgen::JsValue::from(
      element.get_framework_cross_thread_event_handler(event_name, event_type),
    )
  }

  #[wasm_bindgen(js_name = "__GetEvents")]
  pub fn get_events(&self, element: &LynxElement) -> Vec<EventInfo> {
    let mut event_infos: Vec<EventInfo> = vec![];
    let event_types = vec!["bind", "capture-bind", "catch", "capture-catch"];
    for event_type in event_types {
      for event_name in self.event_system.get_enabled_events() {
        if let Some(event_handlers) =
          element.get_framework_cross_thread_event_handler(event_name, event_type)
        {
          event_infos.push(EventInfo {
            event_name: event_name.clone(),
            event_type: event_type.to_string(),
            event_handler: wasm_bindgen::JsValue::from(&event_handlers),
          });
        }
        if let Some(event_handlers) =
          element.get_framework_run_worklet_event_handler(event_name, event_type)
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

  #[wasm_bindgen(js_name = "__SetEvents")]
  pub fn set_events(&self, element: &LynxElement, events: Vec<EventInfo>) {
    for event in events {
      self.add_event(
        element,
        event.event_type,
        event.event_name,
        event.event_handler,
      );
    }
  }
}
