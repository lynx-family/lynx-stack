use super::{
  element_apis::ElementTemplatesInstance,
  style::StyleManager,
  LynxElement, // event::event_delegation::EventSystem,
};

use crate::js_binding::{BackgroundThreadRPC, JSRealm, MainThreadJSBinding};
use crate::template::{DecodedTemplateImpl, PageConfig};
use crate::{constants, template};
use std::{
  collections::{HashMap, HashSet},
  vec,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  pub(super) unique_id_counter: i32,
  pub(super) tag_name_to_html_tag_map: HashMap<String, String>,
  pub(super) unique_id_to_element_map: HashMap<i32, Box<LynxElement>>,
  pub(super) component_id_to_unique_id_map: HashMap<String, i32>,
  pub(super) timing_flags: Vec<String>,
  pub(super) document: web_sys::Document,
  pub(super) root_node: web_sys::Node,
  pub(super) exposure_changed_elements: Vec<i32>,
  pub(super) page: Option<LynxElement>,
  pub(super) style_manager: StyleManager,
  pub(super) enabled_events: HashSet<String>,
  // pub(super) template: DecodedTemplateImpl,
  pub(super) element_templates_instances: HashMap<String, ElementTemplatesInstance>,
  pub(super) mts_realm: JSRealm,
  pub(super) mts_binding: MainThreadJSBinding,
  pub(super) bts_rpc: BackgroundThreadRPC,
  pub(super) entry_template_url: Option<String>,
  pub(super) config_enable_css_selector: bool,
  pub(super) config_default_display_linear: bool,
  pub(super) config_default_overflow_visible: bool,
}

impl MainThreadGlobalThis {
  pub(crate) fn get_lynx_element_by_dom(&self, dom: &web_sys::HtmlElement) -> Option<&LynxElement> {
    let unique_id: i32 = js_sys::Reflect::get(
      dom,
      &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
    )
    .unwrap()
    .as_f64()
    .unwrap() as i32;
    self.get_lynx_element_by_unique_id(unique_id)
  }

  pub(crate) fn get_lynx_element_by_unique_id(&self, unique_id: i32) -> Option<&LynxElement> {
    self
      .unique_id_to_element_map
      .get(&unique_id)
      .map(|boxed_element| boxed_element.as_ref())
  }
}

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(constructor)]
  pub fn new(
    root_node: web_sys::Node,
    mts_realm: JSRealm,
    mts_binding: MainThreadJSBinding,
    bts_rpc: BackgroundThreadRPC,
    config_enable_css_selector: bool,
    config_enable_remove_css_scope: bool,
    config_default_display_linear: bool,
    config_default_overflow_visible: bool,
    // tag_name_to_html_tag_map: wasm_bindgen::JsValue,
  ) -> MainThreadGlobalThis {
    let unique_id_counter = 1;
    // let tag_name_to_html_tag_map: HashMap<String, String> =
    //   serde_wasm_bindgen::from_value(tag_name_to_html_tag_map).unwrap();
    let style_manager = StyleManager::new(
      root_node.clone(),
      config_enable_css_selector,
      config_enable_remove_css_scope,
    );
    let document = web_sys::window().unwrap().document().unwrap();
    MainThreadGlobalThis {
      // template,
      mts_realm,
      mts_binding,
      bts_rpc,
      unique_id_counter,
      element_templates_instances: HashMap::new(),
      unique_id_to_element_map: HashMap::new(),
      component_id_to_unique_id_map: HashMap::new(),
      enabled_events: HashSet::new(),
      tag_name_to_html_tag_map: HashMap::new(),
      timing_flags: vec![],
      exposure_changed_elements: vec![],
      document,
      style_manager,
      entry_template_url: None,
      page: None,
      root_node,
      config_enable_css_selector,
      config_default_display_linear,
      config_default_overflow_visible,
    }
  }
  // #[wasm_bindgen(js_name = "__FlushElementTree")]
  //   let timing_flags = js_sys::Array::from_iter(self.timing_flags.iter().map(JsValue::from));

  //   self.timing_flags.clear();
  //   self.exposure_changed_elements.clear();

  // #[wasm_bindgen(js_name = "__LoadLepusChunk")]
  // pub fn load_lepus_chunk(&mut self, chunk_url: &str) -> bool {
  //   let lepus_chunk_url = self.template.get_lepus_code_url(chunk_url);
  //   let lepus_chunk_url = match lepus_chunk_url {
  //     Some(url) => url,
  //     None => chunk_url,
  //   };
  //   let result = self.mts_realm.loadScriptSync(lepus_chunk_url);
  //   if result.is_err() {
  //     web_sys::console::error_1(&wasm_bindgen::JsValue::from(format!(
  //       "Failed to load lepus chunk from url: {lepus_chunk_url}"
  //     )));
  //     return false;
  //   }
  //   true
  // }

  #[wasm_bindgen(js_name = "__wasm_GC")]
  pub fn gc(&mut self) {
    self.unique_id_to_element_map.retain(|_, value| {
      let dom = value.get_dom();
      dom.is_connected()
    });
  }
}
