use super::MainThreadGlobalThis;
use crate::constants;
use std::{cell::RefCell, collections::HashMap, fmt::Display, rc::Rc};
use wasm_bindgen::prelude::*;
use wasm_bindgen_derive::TryFromJsValue;

#[derive(Default, Clone)]
struct EventHandler {
  /* bind capture-bind catch capture-catch */
  framework_cross_thread_identifier: HashMap<String, String>,
  /* bind capture-bind catch capture-catch */
  framework_run_worklet_identifier: HashMap<String, wasm_bindgen::JsValue>,
  /* bind capture-bind catch capture-catch */
  // event_type_to_handlers: HashMap<String, Vec<js_sys::Function>>,
}

pub struct LynxElementData {
  unique_id: i32,
  css_id: i32,
  tag: String,
  parent_component_unique_id: i32,
  id: Option<String>,
  part_id: Option<String>,
  component_id: Option<String>,
  dataset: Option<js_sys::Object>,
  component_config: Option<js_sys::Object>,
  component_at_index: Option<JsValue>,
  enqueue_component: Option<JsValue>,
  dom_ref: Option<web_sys::HtmlElement>,
  event_handlers_map: Option<HashMap<String, EventHandler>>,
}

#[derive(Clone, TryFromJsValue)]
#[wasm_bindgen]
pub struct LynxElement {
  data: Rc<RefCell<LynxElementData>>,
}

impl LynxElement {
  pub(crate) fn new(
    mts_global_this: &mut MainThreadGlobalThis,
    tag: &str,
    parent_component_unique_id: i32,
    css_id: Option<i32>,
    component_id: Option<String>,
  ) -> Self {
    // tag and html element creating
    let tag = tag.to_string();
    let html_tag = if let Some(html_tag) = mts_global_this.tag_name_to_html_tag_map.get(&tag) {
      html_tag.clone()
    } else {
      tag
    };
    let parent_component = mts_global_this
      .unique_id_to_element_map
      .get(&parent_component_unique_id);
    let dom: web_sys::HtmlElement = mts_global_this
      .document
      .create_element(&html_tag)
      .unwrap()
      .unchecked_into();
    let _ = dom.set_attribute(constants::LYNX_TAG_ATTRIBUTE, html_tag.as_str());

    // css id
    let css_id = {
      if let Some(css_id) = css_id {
        css_id
      } else if let Some(parent_component) = parent_component {
        parent_component.data.borrow().css_id
      } else {
        0
      }
    };
    if css_id != 0 {
      let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }

    // unique id
    /*
     if the css selector is disabled, we need to set the unique id attribute for element lookup by using attribute selector
    */
    mts_global_this.unique_id_counter += 1;
    let unique_id = mts_global_this.unique_id_counter;
    if !mts_global_this.config_enable_css_selector {
      let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    }
    js_sys::Reflect::set(
      &dom,
      &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
      &wasm_bindgen::JsValue::from(unique_id),
    )
    .unwrap();

    let element = Box::new(LynxElement {
      data: Rc::new(
        LynxElementData {
          unique_id,
          css_id,
          tag: html_tag,
          parent_component_unique_id,
          id: None,
          part_id: None,
          dataset: None,
          component_id,
          component_config: None,
          component_at_index: None,
          enqueue_component: None,
          event_handlers_map: None,
          dom_ref: Some(dom),
        }
        .into(),
      ),
    });

    mts_global_this
      .unique_id_to_element_map
      .insert(unique_id, element.clone());
    *element
  }

  pub(crate) fn create_dummy_element(
    mts_global_this: &MainThreadGlobalThis,
    tag: &str,
    dummy_id: i32,
  ) -> Self {
    let tag = tag.to_string();
    let html_tag = if let Some(html_tag) = mts_global_this.tag_name_to_html_tag_map.get(&tag) {
      html_tag.clone()
    } else {
      tag
    };
    let dom: web_sys::HtmlElement = mts_global_this
      .document
      .create_element(&html_tag)
      .unwrap()
      .unchecked_into();
    let _ = js_sys::Reflect::set(
      &dom,
      &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
      &wasm_bindgen::JsValue::from(dummy_id),
    );
    LynxElement {
      data: Rc::new(RefCell::new(LynxElementData {
        unique_id: dummy_id,
        css_id: 0,
        tag: "".to_string(),
        parent_component_unique_id: 0,
        id: None,
        part_id: None,
        dataset: None,
        component_id: None,
        component_config: None,
        component_at_index: None,
        enqueue_component: None,
        event_handlers_map: None,
        dom_ref: Some(dom),
      })),
    }
  }

  pub(crate) fn clone_with_new_dom(
    &self,
    mts_global_this: &MainThreadGlobalThis,
    dom: web_sys::HtmlElement,
    parent_component_unique_id: i32,
    unique_id: i32,
  ) -> Self {
    // css id
    let parent_component = mts_global_this
      .unique_id_to_element_map
      .get(&parent_component_unique_id);
    let css_id = if let Some(parent_component) = parent_component {
      parent_component.data.borrow().css_id
    } else {
      0
    };

    let data = self.data.borrow();
    let new_data = LynxElementData {
      unique_id,
      css_id,
      tag: data.tag.clone(),
      parent_component_unique_id: data.parent_component_unique_id,
      id: data.id.clone(),
      part_id: data.part_id.clone(),
      dataset: data.dataset.clone(),
      component_id: data.component_id.clone(),
      component_config: data.component_config.clone(),
      component_at_index: data.component_at_index.clone(),
      enqueue_component: data.enqueue_component.clone(),
      event_handlers_map: data.event_handlers_map.clone(),
      dom_ref: Some(dom),
    };
    LynxElement {
      data: Rc::new(RefCell::new(new_data)),
    }
  }

  pub(crate) fn get_unique_id(&self) -> i32 {
    let element_data = self.data.borrow();
    element_data.unique_id
  }

  pub(crate) fn set_attribute(&self, name: &str, value: &str) -> Result<(), JsValue> {
    let element_data = self.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    dom.set_attribute(name, value)
  }

  pub(crate) fn get_attribute(&self, name: &str) -> Option<String> {
    let element_data = self.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    dom.get_attribute(name)
  }

  pub(crate) fn set_or_remove_attribute(
    &self,
    name: &str,
    value: Option<&str>,
  ) -> Result<(), JsValue> {
    let element_data = self.data.borrow();
    let dom = element_data.dom_ref.as_ref().unwrap();
    if let Some(value) = value {
      dom.set_attribute(name, value)
    } else {
      dom.remove_attribute(name)
    }
  }

  pub(crate) fn set_component_id(&mut self, component_id: Option<String>) {
    let mut element_data = self.data.borrow_mut();
    element_data.component_id = component_id;
  }

  pub(crate) fn get_component_id(&self) -> Option<String> {
    let element_data = self.data.borrow();
    element_data.component_id.clone()
  }

  pub(crate) fn get_css_id(&self) -> i32 {
    let element_data = self.data.borrow();
    element_data.css_id
  }

  pub(crate) fn set_css_id(&self, css_id: i32) {
    let mut element_data = self.data.borrow_mut();
    if css_id != element_data.css_id {
      element_data.css_id = css_id;
      let _ = element_data
        .dom_ref
        .as_ref()
        .unwrap()
        .set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }
  }

  pub(crate) fn set_list_callbacks(
    &mut self,
    component_at_index: wasm_bindgen::JsValue,
    enqueue_component: wasm_bindgen::JsValue,
  ) {
    let mut element_data = self.data.borrow_mut();
    element_data.component_at_index = Some(component_at_index);
    element_data.enqueue_component = Some(enqueue_component);
  }

  pub(crate) fn get_list_callbacks(&self) -> (Option<JsValue>, Option<JsValue>) {
    let element_data = self.data.borrow();
    (
      element_data.component_at_index.clone(),
      element_data.enqueue_component.clone(),
    )
  }

  pub(crate) fn mark_template(&self) {
    let element_data = self.data.borrow();
    let unique_id = element_data.unique_id;
    let dom = element_data.dom_ref.as_ref().unwrap();
    let _ = dom.set_attribute(
      constants::LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE,
      &unique_id.to_string(),
    );
  }

  pub(crate) fn mark_part(&self, part_id: Option<&str>) {
    let element_data = &mut self.data.borrow_mut();
    let dom = element_data.dom_ref.as_ref().unwrap();
    if let Some(part_id) = part_id {
      let _ = dom.set_attribute(constants::LYNX_PART_ID_ATTRIBUTE, part_id);
      element_data.part_id = Some(part_id.to_string());
    } else {
      let _ = dom.remove_attribute(constants::LYNX_PART_ID_ATTRIBUTE);
      element_data.part_id = None;
    }
  }

  pub(crate) fn get_part_id(&self) -> String {
    let element_data = self.data.borrow();
    element_data.part_id.clone().unwrap_or_default()
  }

  pub(crate) fn get_dom(&self) -> web_sys::HtmlElement {
    let element_data = self.data.borrow();
    element_data.dom_ref.clone().unwrap()
  }

  pub(crate) fn set_id(&self, id: Option<String>) {
    let _ = self.set_or_remove_attribute("id", id.as_deref());
    let mut element_data = self.data.borrow_mut();
    element_data.id = id;
  }

  pub(crate) fn get_id(&self) -> Option<String> {
    let element_data = self.data.borrow();
    element_data.id.clone()
  }

  pub(crate) fn get_tag(&self) -> String {
    let element_data = self.data.borrow();
    element_data.tag.clone()
  }

  pub(crate) fn get_framework_cross_thread_event_handler(
    &self,
    event_name: &str,
    event_type: &str,
  ) -> Option<String> {
    let element_data = self.data.borrow();
    let event_handlers_map = element_data.event_handlers_map.as_ref()?;
    let event_handler_store = event_handlers_map.get(event_name)?;
    event_handler_store
      .framework_cross_thread_identifier
      .get(event_type)
      .cloned()
  }

  pub(crate) fn replace_framework_cross_thread_event_handler(
    &self,
    event_name: String,
    event_type: String,
    identifier: Option<String>,
  ) {
    let mut element_data = self.data.borrow_mut();
    let event_handlers_map = element_data.event_handlers_map.get_or_insert_default();
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
    let element_data = self.data.borrow();
    let event_handlers_map = element_data.event_handlers_map.as_ref()?;
    let event_handler_store = event_handlers_map.get(event_name)?;
    event_handler_store
      .framework_run_worklet_identifier
      .get(event_type)
      .cloned()
  }

  pub(crate) fn replace_framework_run_worklet_event_handler(
    &self,
    event_name: String,
    event_type: String,
    mts_event_identifier: Option<wasm_bindgen::JsValue>,
  ) {
    let mut element_data = self.data.borrow_mut();
    let event_handlers_map = element_data.event_handlers_map.get_or_insert_default();
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

  // pub(crate) fn add_event_listener_with_js_function(
  //   &self,
  //   event_name: String,
  //   event_type: String,
  //   js_function: js_sys::Function,
  // ) {
  //   let mut element_data = self.data.borrow_mut();
  //   let event_handlers_map = element_data.event_handlers_map.get_or_insert_default();
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
  //   let event_handlers_map = element_data.event_handlers_map.get_or_insert_default();
  //   let event_handler_store = event_handlers_map.entry(event_name).or_default();
  //   event_handler_store
  //     .event_type_to_handlers
  //     .entry(event_type.to_string())
  //     .or_default()
  //     .retain(|f| !f.loose_eq(&js_function));
  // }

  pub(crate) fn get_parent_component_unique_id(&self) -> i32 {
    let element_data = self.data.borrow();
    element_data.parent_component_unique_id
  }

  pub(crate) fn get_element_config(&self) -> Option<js_sys::Object> {
    let element_data = self.data.borrow();
    element_data.component_config.clone()
  }

  pub(crate) fn set_element_config(&mut self, config: &js_sys::Object) {
    let mut element_data = self.data.borrow_mut();
    element_data.component_config = Some(config.clone());
  }

  pub(crate) fn set_element_config_by_key(
    &mut self,
    key: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) {
    let mut element_data = self.data.borrow_mut();
    let config = element_data
      .component_config
      .get_or_insert_with(js_sys::Object::new);
    js_sys::Reflect::set(config, key, value).unwrap();
  }

  pub(crate) fn get_dataset(&self) -> js_sys::Object {
    let element_data = self.data.borrow();
    if let Some(dataset) = &element_data.dataset {
      js_sys::Object::assign(&js_sys::Object::new(), dataset)
    } else {
      js_sys::Object::new()
    }
  }

  pub(crate) fn get_dataset_by_key(&self, key: &str) -> wasm_bindgen::JsValue {
    let element_data = self.data.borrow();
    if let Some(dataset) = &element_data.dataset {
      js_sys::Reflect::get(dataset, &wasm_bindgen::JsValue::from_str(key))
        .unwrap_or(wasm_bindgen::JsValue::UNDEFINED)
    } else {
      wasm_bindgen::JsValue::UNDEFINED
    }
  }

  pub(crate) fn set_dataset_by_key(
    &mut self,
    key: &wasm_bindgen::JsValue,
    value: &wasm_bindgen::JsValue,
  ) {
    let mut element_data = self.data.borrow_mut();
    let dataset = element_data.dataset.get_or_insert_with(js_sys::Object::new);
    let old_value = js_sys::Reflect::get(dataset, key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
    if old_value == *value {
    } else {
      js_sys::Reflect::set(dataset, key, value).unwrap();
      let dom = element_data.dom_ref.as_ref().unwrap();
      let key_str = key.as_string().unwrap();
      if value.is_undefined() || value.is_null() {
        let _ = dom.remove_attribute(&format!("data-{key_str}"));
      } else {
        let value_str = value.as_string().unwrap_or_default();
        let _ = dom.set_attribute(&format!("data-{key_str}"), &value_str);
      }
    }
  }

  pub(crate) fn set_dataset(&mut self, new_dataset: &js_sys::Object) {
    let mut element_data = self.data.borrow_mut();
    let dom = element_data.dom_ref.as_ref().unwrap().clone();
    let dataset = element_data.dataset.get_or_insert_with(js_sys::Object::new);
    // compare old dataset and new dataset and update dom attributes
    let old_keys = js_sys::Object::keys(dataset);
    let new_keys = js_sys::Object::keys(new_dataset);
    // remove old keys not in new dataset
    for i in 0..old_keys.length() {
      let key = old_keys.get(i);
      if !js_sys::Reflect::has(new_dataset, &key).unwrap_or(false) {
        let key_str = key.as_string().unwrap();
        let _ = dom.remove_attribute(&format!("data-{key_str}"));
      }
    }
    // set/ update new keys
    for i in 0..new_keys.length() {
      let key = new_keys.get(i);
      let new_value =
        js_sys::Reflect::get(new_dataset, &key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
      let old_value =
        js_sys::Reflect::get(dataset, &key).unwrap_or(wasm_bindgen::JsValue::UNDEFINED);
      if old_value != new_value {
        let key_str = key.as_string().unwrap();
        if new_value.is_undefined() || new_value.is_null() {
          let _ = dom.remove_attribute(&format!("data-{key_str}"));
        } else {
          let value_str = new_value.as_string().unwrap_or_default();
          let _ = dom.set_attribute(&format!("data-{key_str}"), &value_str);
        }
      }
    }
    element_data.dataset = Some(new_dataset.clone());
  }
}
