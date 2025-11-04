use super::{
  LynxElement, // event::event_delegation::EventSystem,
};
use crate::constants;
use crate::template::ElementTemplate;
use std::{collections::HashMap, rc::Rc, vec};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  pub(super) unique_id_counter: i32,
  pub(super) tag_name_to_html_tag_map: HashMap<String, String>,
  pub(super) unique_id_to_element_map: HashMap<i32, Box<LynxElement>>,
  pub(super) unique_id_to_config_map: HashMap<i32, HashMap<String, String>>,
  pub(super) component_id_to_unique_id_map: HashMap<String, i32>,
  pub(super) timing_flags: Vec<String>,
  pub(super) document: web_sys::Document,
  pub(super) root_node: web_sys::Node,
  pub(super) exposure_changed_elements: Vec<i32>,
  pub(super) page: Option<LynxElement>,
  pub(super) config_enable_css_selector: bool,
  pub(super) config_enable_remove_css_scope: bool,
  pub(super) config_default_display_linear: bool,
  pub(super) config_default_overflow_visible: bool,
  pub(super) config_enable_js_dataprocessor: bool,
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(constructor)]
  pub fn new(
    tag_name_to_html_tag_map: wasm_bindgen::JsValue,
    document: web_sys::Document,
    root_node: web_sys::Node,
    enable_css_selector: bool,
    enable_remove_css_scope: bool,
    default_display_linear: bool,
    default_overflow_visible: bool,
    enable_js_dataprocessor: bool,
  ) -> MainThreadGlobalThis {
    let unique_id_counter = 1;
    let tag_name_to_html_tag_map: HashMap<String, String> =
      serde_wasm_bindgen::from_value(tag_name_to_html_tag_map).unwrap();
    MainThreadGlobalThis {
      unique_id_counter,
      unique_id_to_element_map: HashMap::new(),
      unique_id_to_config_map: HashMap::new(),
      component_id_to_unique_id_map: HashMap::new(),
      timing_flags: vec![],
      document,
      tag_name_to_html_tag_map,
      exposure_changed_elements: vec![],
      page: None,
      root_node,
      config_enable_css_selector: enable_css_selector,
      config_enable_remove_css_scope: enable_remove_css_scope,
      config_default_display_linear: default_display_linear,
      config_default_overflow_visible: default_overflow_visible,
      config_enable_js_dataprocessor: enable_js_dataprocessor,
    }
  }

  // #[wasm_bindgen(js_name = "__FlushElementTree")]
  //   let timing_flags = js_sys::Array::from_iter(self.timing_flags.iter().map(JsValue::from));

  //   self.timing_flags.clear();
  //   self.exposure_changed_elements.clear();
  #[wasm_bindgen(js_name = "__wasm_GC")]
  pub fn gc(&mut self) {
    self.unique_id_to_element_map.retain(|_, value| {
      let value = value.data.borrow();
      value.dom_ref.as_ref().unwrap().is_connected()
    });
  }
}
