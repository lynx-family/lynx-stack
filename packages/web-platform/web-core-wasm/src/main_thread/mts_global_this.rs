use super::{
  main_thread_manager::JSRealm,
  style::StyleManager,
  LynxElement, // event::event_delegation::EventSystem,
};
use crate::{
  constants,
  main_thread::style,
  template::{self, ElementTemplate, FlattenedStyleInfo},
  TEMPLATE_MANAGER,
};
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
  pub(super) page_config: template::PageConfig,
  pub(super) page: Option<LynxElement>,
  pub(super) style_manager: StyleManager,
  mts_realm: JSRealm,
  template_url: String,
}

impl MainThreadGlobalThis {
  #[allow(clippy::too_many_arguments)]
  pub(crate) fn new(
    template_url: String,
    document: web_sys::Document,
    root_node: web_sys::Node,
    mts_realm: JSRealm,
    tag_name_to_html_tag_map: wasm_bindgen::JsValue,
    flattened_style_info: &FlattenedStyleInfo,
    page_config: template::PageConfig,
  ) -> MainThreadGlobalThis {
    let unique_id_counter = 1;
    let tag_name_to_html_tag_map: HashMap<String, String> =
      serde_wasm_bindgen::from_value(tag_name_to_html_tag_map).unwrap();
    let style_manager = StyleManager::new(
      &document,
      &root_node,
      flattened_style_info,
      page_config.enable_css_selector,
      page_config.enable_remove_css_scope,
    );
    MainThreadGlobalThis {
      mts_realm,
      template_url,
      unique_id_counter,
      unique_id_to_element_map: HashMap::new(),
      unique_id_to_config_map: HashMap::new(),
      component_id_to_unique_id_map: HashMap::new(),
      timing_flags: vec![],
      document,
      style_manager,
      tag_name_to_html_tag_map,
      exposure_changed_elements: vec![],
      page: None,
      root_node,
      page_config,
    }
  }
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  // #[wasm_bindgen(js_name = "__FlushElementTree")]
  //   let timing_flags = js_sys::Array::from_iter(self.timing_flags.iter().map(JsValue::from));

  //   self.timing_flags.clear();
  //   self.exposure_changed_elements.clear();

  #[wasm_bindgen(js_name = "__LoadLepusChunk")]
  pub fn load_lepus_chunk(&mut self, chunk_url: &str) -> bool {
    let template = TEMPLATE_MANAGER.get_cached_template(&self.template_url);
    if template.is_none() {
      web_sys::console::error_1(&wasm_bindgen::JsValue::from(format!(
        "Template must be loaded before loading lepus chunk, url:{}",
        self.template_url
      )));
      return false;
    }
    let template = template.unwrap();
    let lepus_chunk_url = template.get_lepus_code_url(chunk_url);
    let lepus_chunk_url = match lepus_chunk_url {
      Some(url) => url,
      None => chunk_url,
    };
    let result = self.mts_realm.loadScriptSync(lepus_chunk_url);
    if result.is_err() {
      web_sys::console::error_1(&wasm_bindgen::JsValue::from(format!(
        "Failed to load lepus chunk from url: {}",
        lepus_chunk_url
      )));
      return false;
    }
    true
  }

  #[wasm_bindgen(js_name = "__wasm_GC")]
  pub fn gc(&mut self) {
    self.unique_id_to_element_map.retain(|_, value| {
      let value = value.data.borrow();
      value.dom_ref.as_ref().unwrap().is_connected()
    });
  }
}
