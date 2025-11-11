use super::MainThreadGlobalThis;
use crate::constants;
use std::{cell::RefCell, collections::HashMap, fmt::Display, rc::Rc};
use wasm_bindgen::prelude::*;
use wasm_bindgen_derive::TryFromJsValue;

#[derive(Default, PartialEq, Clone)]
enum ConfigValueType {
  #[default]
  String,
  Object,
}

#[derive(Clone)]
struct ConfigValue {
  value_type: ConfigValueType,
  /**
   * if it is not a String value we
   */
  value: String,
}

impl ConfigValue {
  pub fn new(value: &wasm_bindgen::JsValue) -> ConfigValue {
    if value.is_string() {
      ConfigValue {
        value_type: ConfigValueType::String,
        value: value.as_string().unwrap(),
      }
    } else {
      ConfigValue {
        value_type: ConfigValueType::Object,
        value: js_sys::JSON::stringify(value).unwrap().as_string().unwrap(),
      }
    }
  }

  pub fn as_js_value(&self) -> wasm_bindgen::JsValue {
    match self.value_type {
      ConfigValueType::String => wasm_bindgen::JsValue::from_str(&self.value),
      ConfigValueType::Object => js_sys::JSON::parse(&self.value).unwrap(),
    }
  }
}

impl std::cmp::PartialEq for ConfigValue {
  fn eq(&self, other: &Self) -> bool {
    self.value_type == other.value_type && self.value == other.value
  }
}

impl Display for ConfigValue {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}", self.value)
  }
}
/**
 * designed for store the one level Record<String, ConfigValue> in js
 */
#[derive(Clone, Default)]
pub(crate) struct CommonConfigObject {
  config_map: HashMap<String, ConfigValue>,
  js_object_cache: RefCell<Option<js_sys::Object>>,
}

impl CommonConfigObject {
  fn new(new_map: &js_sys::Object) -> Self {
    let config_map: HashMap<String, ConfigValue> = js_sys::Object::entries(new_map)
      .iter()
      .map(|entry| {
        let entry_array: js_sys::Array = entry.into();
        let key = entry_array.get(0).as_string().unwrap();
        let value = entry_array.get(1);
        (key, ConfigValue::new(&value))
      })
      .collect();
    CommonConfigObject {
      config_map,
      js_object_cache: RefCell::new(None),
    }
  }

  pub(crate) fn clone_to_js_object(&self) -> js_sys::Object {
    if let Some(cached_obj) = &*self.js_object_cache.borrow() {
      cached_obj.clone()
    } else {
      let entries: js_sys::Array =
        js_sys::Array::from_iter(self.config_map.iter().map(|(key, value)| {
          let js_value: wasm_bindgen::JsValue = value.as_js_value();
          let js_key = wasm_bindgen::JsValue::from_str(key);
          js_sys::Array::of2(&js_key, &js_value)
        }));
      let ret = js_sys::Object::from_entries(&entries).unwrap();
      *self.js_object_cache.borrow_mut() = Some(ret.clone());
      ret
    }
  }
}

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
  dataset: Option<CommonConfigObject>,
  component_config: Option<CommonConfigObject>,
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

  pub(crate) fn get_dataset_js_object(&self) -> js_sys::Object {
    let element_data = self.data.borrow();
    if let Some(dataset) = &element_data.dataset {
      dataset.clone_to_js_object()
    } else {
      js_sys::Object::new()
    }
  }

  pub(crate) fn get_dataset(&self, key: &str) -> wasm_bindgen::JsValue {
    let element_data = self.data.borrow();
    if let Some(dataset) = &element_data.dataset {
      if let Some(value) = dataset.config_map.get(key) {
        return value.as_js_value();
      }
    }
    wasm_bindgen::JsValue::UNDEFINED
  }

  fn update_dataset_impl(
    &self,
    new_dataset: impl Iterator<Item = (String, wasm_bindgen::JsValue)>,
  ) {
    let element_data = &mut self.data.borrow_mut();
    let dom = self.get_dom();
    let mut dataset = element_data.dataset.take().unwrap_or_default();
    {
      let config_map = &mut dataset.config_map;
      for (key, value_option) in new_dataset {
        let value_option = if value_option.is_null_or_undefined() {
          None
        } else {
          Some(ConfigValue::new(&value_option))
        };
        if value_option.as_ref() != config_map.get(&key) {
          if let Some(value) = value_option {
            let value_str = value.to_string();
            let _ = dom.set_attribute(&format!("data-{}", key.to_lowercase()), &value_str);
            config_map.insert(key, value);
          } else {
            let _ = dom.remove_attribute(&format!("data-{}", key.to_lowercase()));
            config_map.remove(&key);
          }
        }
      }
    }
    element_data.dataset = Some(dataset);
  }

  /**
   * this method is only used in element template instantiation
   * no remove operation is supported
   */
  pub(crate) fn set_dataset_by_string_map(&self, new_dataset: &HashMap<String, String>) {
    let data = &mut self.data.borrow_mut();
    let dom = self.get_dom();
    for (key, value) in new_dataset {
      let _ = dom.set_attribute(&format!("data-{}", key.to_lowercase()), value);
      data.dataset.get_or_insert_default().config_map.insert(
        key.to_string(),
        ConfigValue {
          value_type: ConfigValueType::String,
          value: value.to_string(),
        },
      );
    }
  }

  pub(crate) fn set_dataset(&self, key: &str, value: &wasm_bindgen::JsValue) {
    self.update_dataset_impl(std::iter::once((key.to_string(), value.clone())));
  }

  pub(crate) fn replace_dataset(&mut self, new_dataset: &js_sys::Object) {
    self.update_dataset_impl(js_sys::Object::entries(new_dataset).iter().map(|entry| {
      let entry_array: js_sys::Array = entry.into();
      let key = entry_array.get(0).as_string().unwrap();
      let value = entry_array.get(1);
      (key, value)
    }));
  }

  pub(crate) fn set_component_config(&self, key: &str, value: &wasm_bindgen::JsValue) {
    let mut element_data = self.data.borrow_mut();
    if value.is_null_or_undefined() {
      if let Some(config) = &mut element_data.component_config {
        config.config_map.remove(key);
      }
    } else {
      if element_data.component_config.is_none() {
        element_data.component_config = Some(CommonConfigObject::default());
      }
      if let Some(config) = &mut element_data.component_config {
        let value = ConfigValue::new(value);
        if config.config_map.get(key) != Some(&value) {
          config.config_map.insert(key.to_string(), value);
        }
      }
    }
  }

  pub(crate) fn get_component_config_js_object(&self) -> js_sys::Object {
    let element_data = self.data.borrow();
    if let Some(config) = &element_data.component_config {
      config.clone_to_js_object()
    } else {
      js_sys::Object::new()
    }
  }

  pub(crate) fn replace_component_config(&mut self, new_config: &js_sys::Object) {
    let mut element_data = self.data.borrow_mut();
    element_data.component_config = Some(CommonConfigObject::new(new_config));
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
    let mut element_data = self.data.borrow_mut();
    element_data.id = id;
    let _ = self.set_or_remove_attribute("id", element_data.id.as_deref());
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
}
