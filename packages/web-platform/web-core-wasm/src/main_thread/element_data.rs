/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use fnv::FnvHashMap;

#[cfg(feature = "server")]
use rkyv::Serialize;
use rkyv::{Archive, Deserialize};
#[derive(Default, Clone, Archive, Deserialize)]
#[cfg_attr(feature = "server", derive(Serialize))]
pub struct EventHandler {
  /* bind capture-bind catch capture-catch */
  pub(crate) framework_cross_thread_identifier: FnvHashMap<String, String>,
  /* bind capture-bind catch capture-catch */
  #[with(rkyv::with::Skip)]
  pub(crate) framework_run_worklet_identifier: FnvHashMap<String, wasm_bindgen::JsValue>,
}

#[derive(Archive, Deserialize, Clone)]
#[cfg_attr(feature = "server", derive(Serialize))]
pub struct LynxElementData {
  pub(crate) parent_component_unique_id: usize,
  pub(crate) css_id: i32,
  #[with(rkyv::with::Skip)]
  pub(crate) component_id: Option<String>,
  #[with(rkyv::with::Skip)]
  pub(crate) dataset: Option<js_sys::Object>,
  #[with(rkyv::with::Skip)]
  pub(crate) component_config: Option<js_sys::Object>,
  #[with(rkyv::with::Skip)]
  pub(crate) event_handlers_map: Option<FnvHashMap<String, EventHandler>>,

  #[cfg(feature = "server")]
  #[with(rkyv::with::Skip)]
  pub(crate) tag_name: String,

  #[cfg(feature = "server")]
  #[with(rkyv::with::Skip)]
  pub(crate) attributes: FnvHashMap<String, String>,

  #[cfg(feature = "server")]
  #[with(rkyv::with::Skip)]
  pub(crate) children: Vec<usize>,
}

impl LynxElementData {
  pub(crate) fn new(
    parent_component_unique_id: usize,
    css_id: i32,
    component_id: Option<String>,
  ) -> Self {
    LynxElementData {
      parent_component_unique_id,
      css_id,
      component_id,
      dataset: None,
      component_config: None,
      event_handlers_map: None,
      #[cfg(feature = "server")]
      tag_name: String::new(),
      #[cfg(feature = "server")]
      attributes: FnvHashMap::default(),
      #[cfg(feature = "server")]
      children: Vec::new(),
    }
  }
}

#[cfg(feature = "client")]
impl LynxElementData {
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

  /**
   * Replace or remove the framework cross-thread event handler identifier
   * event_type: bind, capture-bind, catch, capture-catch
   * event_name: the name of the event, like "tap"
   */
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
    let event_handler_store = event_handlers_map.entry(event_name.to_owned()).or_default();
    if let Some(identifier) = mts_event_identifier {
      event_handler_store
        .framework_run_worklet_identifier
        .insert(event_type.to_owned(), identifier);
    } else {
      event_handler_store
        .framework_run_worklet_identifier
        .remove(&event_type);
    }
  }
}

#[cfg(feature = "server")]
impl LynxElementData {
  pub(crate) fn new_with_tag_name(
    parent_component_unique_id: usize,
    css_id: i32,
    component_id: Option<String>,
    tag_name: String,
  ) -> Self {
    let mut data = Self::new(parent_component_unique_id, css_id, component_id);
    data.tag_name = tag_name;
    data
  }

  pub(crate) fn set_attribute(&mut self, key: String, value: String) {
    self.attributes.insert(key, value);
  }

  pub(crate) fn set_style(&mut self, key: String, value: String) {
    if value.is_empty() {
      // In SSR we do not support remove style
      panic!("Remove style is not supported in SSR");
    }
    let style = self.attributes.entry("style".to_string()).or_default();
    style.push_str(&key);
    style.push(':');
    style.push_str(&value);
    style.push(';');
  }

  pub(crate) fn append_child(&mut self, child_id: usize) {
    self.children.push(child_id);
  }

  // pub(crate) fn clone_node(&self, parent_component_unique_id: usize, css_id: i32) -> Self {
  //   LynxElementData {
  //     parent_component_unique_id,
  //     css_id,
  //     dataset: self
  //       .dataset
  //       .as_ref()
  //       .map(|dataset| js_sys::Object::assign(&js_sys::Object::default(), dataset)),
  //     component_config: self.component_config.as_ref().map(|component_config| {
  //       js_sys::Object::assign(&js_sys::Object::default(), component_config)
  //     }),
  //     component_id: self.component_id.clone(),
  //     event_handlers_map: self.event_handlers_map.clone(),
  //     exposure_id_assigned: self.exposure_id_assigned,
  //   }
  // }

  // /**
  //  * There are two conditions to enable exposure/disexposure(InsectionObserver) detection:
  //  * 1. an element has exposure-id attribute
  //  * 2. an element has 'appear'/'disappear' event listener added
  //  */
  // pub(crate) fn should_enable_exposure_event(&self) -> bool {
  //   self.exposure_id_assigned || {
  //     if let Some(event_handlers_map) = &self.event_handlers_map {
  //       event_handlers_map.contains_key("appear") || event_handlers_map.contains_key("disappear")
  //     } else {
  //       false
  //     }
  //   }
  // }

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
  //   event_type: String,
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
