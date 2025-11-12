use std::collections::hash_set::Iter;

use super::{LynxElement, MainThreadGlobalThis};
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
    } else {
      if event_handler.is_object() {
        element.replace_framework_run_worklet_event_handler(
          event_name.clone(),
          event_type,
          Some(event_handler),
        );
      } else if let Some(identifier) = event_handler.as_string() {
        element.replace_framework_cross_thread_event_handler(
          event_name.clone(),
          event_type,
          Some(identifier),
        );
      }
      self.enable_event(&event_name);
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
      for event_name in self.get_enabled_events() {
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
  pub fn set_events(&mut self, element: &LynxElement, events: Vec<EventInfo>) {
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

  //   fn dispatch_event_by_path(
  //     &self,
  //     bubble_path: &Vec<&LynxElement>,
  //     event_name: &str,
  //     target: &LynxElement,
  //     serialized_event: &wasm_bindgen::JsValue,
  //     capture: bool,
  //   ) -> bool {
  //     let target_js_object = create_event_target_object(target);
  //     let page_unique_id = if let Some(page) = &self.page {
  //       page.get_unique_id()
  //     } else {
  //       -1
  //     };
  //     // if current is capture phase, we should iterate from root to target
  //     let iter: Box<dyn Iterator<Item = &&LynxElement>> = if capture {
  //       Box::new(bubble_path.iter().rev())
  //     } else {
  //       Box::new(bubble_path.iter())
  //     };
  //     let element_ref_ptr_str = wasm_bindgen::JsValue::from_str("elementRefptr");
  //     for current_element in iter {
  //       let mut has_catched = false;
  //       // assign element target and currentTarget
  //       let target_js_object_shallow_copied =
  //         js_sys::Object::assign(&js_sys::Object::new(), &target_js_object);
  //       let current_target_js_object = create_event_target_object(current_element);
  //       let _ = js_sys::Reflect::set(
  //         serialized_event,
  //         &wasm_bindgen::JsValue::from_str("target"),
  //         &target_js_object_shallow_copied,
  //       );
  //       let _ = js_sys::Reflect::set(
  //         serialized_event,
  //         &wasm_bindgen::JsValue::from_str("currentTarget"),
  //         &current_target_js_object,
  //       );
  //       // now dispatch event
  //       // if has cross thread handler, we should get the parent component id
  //       let bind_handler_name = format!("{}bind", if capture { "capture-" } else { "" });
  //       let catch_handler_name = format!("{}catch", if capture { "capture-" } else { "" });
  //       {
  //         // cross thread handler
  //         let bind_handler =
  //           current_element.get_framework_cross_thread_event_handler(event_name, &bind_handler_name);
  //         let catch_handler =
  //           current_element.get_framework_cross_thread_event_handler(event_name, &catch_handler_name);
  //         if bind_handler.is_some() || catch_handler.is_some() {
  //           let current_target_parent_component_id = {
  //             let parent_component_unique_id = current_element.get_parent_component_unique_id();
  //             if page_unique_id == parent_component_unique_id {
  //               None
  //             } else {
  //               self
  //                 .get_lynx_element_by_unique_id(current_element.get_parent_component_unique_id())
  //                 .and_then(|e| e.get_component_id())
  //             }
  //           };
  //           if let Some(handler) = bind_handler {
  //             if let Some(parent_component_id) = &current_target_parent_component_id {
  //               self.bts_rpc.publish_component_event(
  //                 parent_component_id,
  //                 event_name,
  //                 serialized_event,
  //               );
  //             } else {
  //               self.bts_rpc.publish_event(&handler, serialized_event);
  //             }
  //           }
  //           if let Some(handler) = catch_handler {
  //             has_catched = true;
  //             if let Some(parent_component_id) = &current_target_parent_component_id {
  //               self.bts_rpc.publish_component_event(
  //                 parent_component_id,
  //                 event_name,
  //                 serialized_event,
  //               );
  //             } else {
  //               self.bts_rpc.publish_event(&handler, serialized_event);
  //             }
  //           }
  //         }
  //       }
  //       {
  //         // run worklet handler
  //         let bind_handler =
  //           current_element.get_framework_run_worklet_event_handler(event_name, &bind_handler_name);
  //         let catch_handler =
  //           current_element.get_framework_run_worklet_event_handler(event_name, &catch_handler_name);
  //         if bind_handler.is_some() || catch_handler.is_some() {
  //           // assign elementRefptr to event targets
  //           let _ = js_sys::Reflect::set(
  //             &target_js_object_shallow_copied,
  //             &element_ref_ptr_str,
  //             &wasm_bindgen::JsValue::from(target.clone()),
  //           );
  //           let _ = js_sys::Reflect::set(
  //             &current_target_js_object,
  //             &element_ref_ptr_str,
  //             &wasm_bindgen::JsValue::from((*current_element).clone()),
  //           );
  //           if let Some(handler) = bind_handler {
  //             self.mts_binding.run_worklet(&handler, serialized_event);
  //           }
  //           if let Some(handler) = catch_handler {
  //             self.mts_binding.run_worklet(&handler, serialized_event);
  //           }
  //         }
  //       }
  //       // assign elementRefptr to target and current_target

  //       if has_catched {
  //         return has_catched;
  //       }
  //     }
  //     false
  //   }
}

// fn create_event_target_object(target_element: &LynxElement) -> js_sys::Object {
//   let entries = js_sys::Array::new();
//   entries.push(&js_sys::Array::of2(
//     &wasm_bindgen::JsValue::from_str("uniqueId"),
//     &wasm_bindgen::JsValue::from_f64(target_element.get_unique_id() as f64),
//   ));
//   entries.push(&js_sys::Array::of2(
//     &wasm_bindgen::JsValue::from_str("id"),
//     &match target_element.get_id() {
//       Some(id) => wasm_bindgen::JsValue::from_str(&id),
//       None => wasm_bindgen::JsValue::NULL,
//     },
//   ));
//   entries.push(&js_sys::Array::of2(
//     &wasm_bindgen::JsValue::from_str("dataset"),
//     &self.get_dataset(target_element),
//   ));
//   js_sys::Object::from_entries(&entries).unwrap()
// }

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__WasmBindingCommonEventHandler")]
  pub fn __wasm_binding_common_event_handler(
    &self,
    event_name: &str,
    target_dom: web_sys::HtmlElement,
    serialized_event: wasm_bindgen::JsValue,
  ) {
    // let event_name: String = constants::WEB_EVENT_NAME_TO_LYNX_MAPPING
    //   .get(event_name)
    //   .cloned()
    //   .unwrap_or(event_name)
    //   .to_string();
    // if self.enabled_events.contains(&event_name) {
    //   // generate path from target to root
    //   let mut current_element: Option<web_sys::HtmlElement> = Some(target_dom);
    //   let mut bubble_path: Vec<&LynxElement> = vec![];
    //   while let Some(element) = current_element {
    //     if let Some(lynx_element) = self.get_lynx_element_by_dom(&element) {
    //       bubble_path.push(lynx_element);
    //     }
    //     if let Some(parent) = element.parent_element() {
    //       let parent: web_sys::Node = parent.unchecked_into::<web_sys::Node>();
    //       if self.root_node.is_same_node(Some(&parent)) {
    //         break;
    //       }
    //       current_element = Some(parent.unchecked_into::<web_sys::HtmlElement>());
    //     } else {
    //       current_element = None;
    //     }
    //   }
    //   let target_element = bubble_path[0];
    //   self.dispatch_event_by_path(
    //     &bubble_path,
    //     &event_name,
    //     target_element,
    //     &serialized_event,
    //     true,
    //   );
    //   // remove target from path for bubble phase
    //   bubble_path.remove(0);
    //   self.dispatch_event_by_path(
    //     &bubble_path,
    //     &event_name,
    //     target_element,
    //     &serialized_event,
    //     false,
    //   );
    // }
  }
}
