use std::{collections::HashMap, vec};
use wasm_bindgen::prelude::*;

use crate::{constants, js_helpers, pure_element_papis};

struct FiberElementData {
  unique_id: i32,
  css_id: i32,
  parent_component_unique_id: i32,
  tag: String,
  dom_ref: js_sys::WeakRef,
}

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  unique_id_counter: i32,
  unique_id_to_element_data_map: HashMap<i32, FiberElementData>,
  tag_name_to_html_tag_map: HashMap<String, wasm_bindgen::JsValue>,
  timing_flags: Vec<wasm_bindgen::JsValue>,
  document: web_sys::Document,
  root_node: web_sys::Node,
  page_element: Option<web_sys::Element>,
  exposure_changed_elements: Vec<i32>,
  config_enable_css_selector: bool,
  config_enable_remove_css_scope: bool,
  config_default_display_linear: bool,
  config_default_overflow_visible: bool,
  config_enable_js_dataprocessor: bool,
  callback_flush_element_tree: js_sys::Function,
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(constructor)]
  pub fn new(
    tag_name_to_html_tag_map: js_sys::Object,
    document: web_sys::Document,
    root_node: web_sys::Node,
    enable_css_selector: bool,
    enable_remove_css_scope: bool,
    default_display_linear: bool,
    default_overflow_visible: bool,
    enable_js_dataprocessor: bool,
    flush_element_tree_callback: js_sys::Function,
  ) -> MainThreadGlobalThis {
    let unique_id_counter = 1;
    let tag_name_to_html_tag_map: HashMap<String, wasm_bindgen::JsValue> =
      js_sys::Object::entries(&tag_name_to_html_tag_map)
        .iter()
        .map(|entry| {
          let pair = js_sys::Array::from(&entry);
          let key = pair.get(0).as_string().unwrap();
          let value = pair.get(1);
          (key, value)
        })
        .collect();
    MainThreadGlobalThis {
      unique_id_counter,
      unique_id_to_element_data_map: HashMap::new(),
      timing_flags: vec![],
      document,
      tag_name_to_html_tag_map,
      exposure_changed_elements: vec![],
      page_element: None,
      root_node,
      config_enable_css_selector: enable_css_selector,
      config_enable_remove_css_scope: enable_remove_css_scope,
      config_default_display_linear: default_display_linear,
      config_default_overflow_visible: default_overflow_visible,
      config_enable_js_dataprocessor: enable_js_dataprocessor,
      callback_flush_element_tree: flush_element_tree_callback,
    }
  }

  // #[wasm_bindgen(js_name = "__common_event_handler", skip_typescript)]
  // fn common_event_handler(&self, event: web_sys::Event) {
  //   js_helpers::common_event_handler_js_impl(event);
  // }

  #[wasm_bindgen(js_name = "__CreateElement")]
  pub fn create_element(&mut self, tag: &str, parent_component_unique_id: i32) -> web_sys::Element {
    self.unique_id_counter += 1;
    let unique_id = self.unique_id_counter;
    let tag_name = &wasm_bindgen::JsValue::from_str(tag);
    let html_tag = self.tag_name_to_html_tag_map.get(tag).unwrap_or(tag_name);
    let parent_component_data = self
      .unique_id_to_element_data_map
      .get(&parent_component_unique_id);
    let element = js_helpers::create_element_js_impl(&self.document, html_tag, unique_id);
    let _ = element.set_attribute(constants::LYNX_TAG_ATTRIBUTE, tag);
    let _ = element.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    if let Some(parent_component_data) = parent_component_data {
      if parent_component_data.css_id != 0 {
        let _ = element.set_attribute(
          constants::CSS_ID_ATTRIBUTE,
          &parent_component_data.css_id.to_string(),
        );
      }
    }
    let element_weak_ref = js_sys::WeakRef::new(&element);
    self.unique_id_to_element_data_map.insert(
      unique_id,
      FiberElementData {
        unique_id,
        css_id: 0,
        parent_component_unique_id,
        tag: tag.to_string(),
        dom_ref: element_weak_ref,
      },
    );
    element
  }

  #[wasm_bindgen(js_name = "__CreateView")]
  pub fn create_view(&mut self, parent_component_unique_id: i32) -> web_sys::Element {
    self.create_element("view", parent_component_unique_id)
  }

  #[wasm_bindgen(js_name = "__CreateText")]
  pub fn create_text(&mut self, parent_component_unique_id: i32) -> web_sys::Element {
    self.create_element("text", parent_component_unique_id)
  }

  #[wasm_bindgen(js_name = "__CreateRawText")]
  pub fn create_raw_text(&mut self, text: &str) -> web_sys::Element {
    let element = self.create_element("raw-text", -1);
    let _ = element.set_attribute("text", text);
    element
  }

  #[wasm_bindgen(js_name = "__CreateImage")]
  pub fn create_image(&mut self, parent_component_unique_id: i32) -> web_sys::Element {
    self.create_element("image", parent_component_unique_id)
  }

  #[wasm_bindgen(js_name = "__CreateScrollView")]
  pub fn create_scroll_view(&mut self, parent_component_unique_id: i32) -> web_sys::Element {
    self.create_element("scroll-view", parent_component_unique_id)
  }

  #[wasm_bindgen(js_name = "__CreateWrapperElement")]
  pub fn create_wrapper_element(&mut self, parent_component_unique_id: i32) -> web_sys::Element {
    self.create_element("lynx-wrapper", parent_component_unique_id)
  }

  #[wasm_bindgen(js_name = "__CreatePage")]
  pub fn create_page(&mut self, component_id: &str, css_id: i32) -> web_sys::Element {
    let page = self.create_element("page", 0);
    let _ = page.set_attribute("part", "page");
    let _ = page.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    let _ = page.set_attribute(constants::COMPONENT_ID_ATTRIBUTE, component_id);
    pure_element_papis::mark_template_element(&page);
    if !self.config_default_display_linear {
      let _ = page.set_attribute(constants::LYNX_DEFAULT_DISPLAY_LINEAR_ATTRIBUTE, "false");
    }
    if self.config_default_overflow_visible {
      let _ = page.set_attribute(constants::LYNX_DEFAULT_OVERFLOW_VISIBLE_ATTRIBUTE, "true");
    }
    self.page_element = Some(page.clone());
    page
  }

  #[wasm_bindgen(js_name = "__CreateList")]
  pub fn create_list(
    &mut self,
    parent_component_unique_id: i32,
    component_at_index: wasm_bindgen::JsValue,
    enqueue_component: wasm_bindgen::JsValue,
  ) -> web_sys::Element {
    let element = self.create_element("list", parent_component_unique_id);
    pure_element_papis::update_list_callbacks(&element, &component_at_index, &enqueue_component);
    element
  }

  #[wasm_bindgen(js_name = "__wasm_setAttribute")]
  pub fn set_attribute(
    &mut self,
    element: &web_sys::Element,
    key: &str,
    value: wasm_bindgen::JsValue,
  ) {
    if constants::EXPOSURE_RELATED_ATTRIBUTES.contains(key) {
      let unique_id = pure_element_papis::get_element_unique_id(element);
      self.exposure_changed_elements.push(unique_id);
    } else if key == constants::LYNX_TIMING_FLAG {
      self.timing_flags.push(value);
    } else if key == "update-list-info" {
      let unique_id = pure_element_papis::get_element_unique_id(element);
      let element_data = self.unique_id_to_element_data_map.get(&unique_id);
      assert!(
        element_data.is_some(),
        "SetAttribute: element_data not found for unique_id {unique_id}"
      );
      let element_data = element_data.unwrap();
      let tag = &element_data.tag;
      if tag == "list" {
        js_helpers::update_list_info_js_impl(element, unique_id, &value);
      }
    }
  }

  #[wasm_bindgen(js_name = "__UpdateListCallbacks")]
  pub fn update_list_callbacks(
    &self,
    element: &web_sys::Element,
    component_at_index: wasm_bindgen::JsValue,
    enqueue_component: wasm_bindgen::JsValue,
  ) {
    let _ = js_sys::Reflect::set(
      element,
      &wasm_bindgen::JsValue::from_str(constants::COMPONENT_AT_INDEX_PROPERTY_NAME),
      &component_at_index,
    )
    .unwrap();
    let _ = js_sys::Reflect::set(
      element,
      &wasm_bindgen::JsValue::from_str(constants::ENQUEUE_COMPONENT_PROPERTY_NAME),
      &enqueue_component,
    )
    .unwrap();
  }

  #[wasm_bindgen(js_name = "__SwapElement")]
  pub fn swap_element(&mut self, child_a: &web_sys::Element, child_b: &web_sys::Element) {
    let temp = self.document.create_element("div").unwrap();
    child_a.replace_with_with_node_1(&temp).unwrap();
    child_b.replace_with_with_node_1(child_a).unwrap();
    temp.replace_with_with_node_1(child_b).unwrap();
  }

  #[wasm_bindgen(js_name = "__GetPageElement")]
  pub fn get_page_element(&self) -> Option<web_sys::Element> {
    self.page_element.clone()
  }

  #[wasm_bindgen(js_name = "__GetParentComponent")]
  pub fn get_parent_component_unique_id(
    &self,
    element: &web_sys::Element,
  ) -> Option<web_sys::Element> {
    let unique_id = pure_element_papis::get_element_unique_id(element);
    if let Some(element_data) = self.unique_id_to_element_data_map.get(&unique_id) {
      let parent_component_unique_id = element_data.parent_component_unique_id;
      if let Some(parent_component_data) = self
        .unique_id_to_element_data_map
        .get(&parent_component_unique_id)
      {
        if let Some(dom) = parent_component_data.dom_ref.deref().as_ref() {
          return Some(dom.clone().unchecked_into());
        }
      }
    }
    None
  }

  #[wasm_bindgen(js_name = "__FlushElementTree")]
  pub fn flush_element_tree(&mut self, _: wasm_bindgen::JsValue, options: &wasm_bindgen::JsValue) {
    let timing_flags = js_sys::Array::from_iter(self.timing_flags.iter());
    self.timing_flags.clear();
    // let exposure_changed_elements = js_sys::Array::from_iter(
    //   self.exposure_changed_elements.iter().filter_map(|unique_id|{
    //     self.unique_id_to_element_data_map.get(unique_id).and_then(|element_data|{
    //       element_data.dom_ref.deref()
    //     })
    //   })
    // );
    self.exposure_changed_elements.clear();
    // if let Some(page_element) = &self.page_element {
    //   if page_element.parent_node().is_none()
    //     && js_sys::Reflect::get(page_element, &wasm_bindgen::JsValue::from_str(constants::LYNX_DISPOSED_PROPERTY_NAME)).unwrap().is_falsy() {
    //       let _ = self.root_node.append_child(page_element);
    //     }
    // }
    let _ = self.callback_flush_element_tree.call3(
      &wasm_bindgen::JsValue::NULL,
      options,
      &timing_flags,
      &wasm_bindgen::JsValue::NULL,
    );
  }

  // #[wasm_bindgen(js_name = "__wasm_GC")]
  // pub fn gc(&mut self) {
  //   self.unique_id_to_element_data_map.retain(|_, element_data| {
  //     let dom = element_data.dom_ref.deref();
  //     dom.is_some()
  //   });
  // }
}
