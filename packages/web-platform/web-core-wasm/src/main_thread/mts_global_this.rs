use super::{
  // element_apis::ElementTemplatesInstance,
  style::StyleManager,
  LynxElement, // event::event_delegation::EventSystem,
};

use crate::js_binding::{BackgroundThreadRPC, JSRealm, MainThreadJSBinding};
use crate::main_thread::element_apis::LynxElementData;
use crate::template::{DecodedTemplateImpl, PageConfig};
use crate::{constants, template};
use std::cell::RefCell;
use std::{
  collections::{HashMap, HashSet},
  rc::Rc,
  vec,
};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  pub(super) unique_id_counter: i32,
  pub(super) tag_name_to_html_tag_map: HashMap<String, String>,
  // pub(super) unique_id_to_element_map: HashMap<i32, Box<LynxElement>>,
  pub(super) unique_id_to_element_map: HashMap<i32, Rc<RefCell<Box<LynxElementData>>>>,
  pub(super) component_id_to_unique_id_map: HashMap<String, i32>,
  pub(super) timing_flags: Vec<String>,
  pub(super) document: web_sys::Document,
  pub(super) root_node: web_sys::Node,
  pub(super) exposure_changed_elements: Vec<i32>,
  pub(super) page: Option<LynxElement>,
  pub(super) style_manager: StyleManager,
  pub(super) enabled_events: HashSet<String>,
  // pub(super) template: DecodedTemplateImpl,
  // pub(super) element_templates_instances: HashMap<String, ElementTemplatesInstance>,
  pub(super) mts_realm: JSRealm,
  pub(super) mts_binding: MainThreadJSBinding,
  pub(super) bts_rpc: BackgroundThreadRPC,
  pub(super) entry_template_url: Option<String>,
  pub(super) config_enable_css_selector: bool,
  pub(super) config_default_display_linear: bool,
  pub(super) config_default_overflow_visible: bool,
}

impl MainThreadGlobalThis {
  // pub(crate) fn get_lynx_element_by_dom(&self, dom: &web_sys::HtmlElement) -> Option<&LynxElement> {
  //   let unique_id: i32 = js_sys::Reflect::get(
  //     dom,
  //     &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
  //   )
  //   .unwrap()
  //   .as_f64()
  //   .unwrap() as i32;
  //   self.get_lynx_element_by_unique_id(unique_id)
  // }

  // pub(crate) fn get_lynx_element_by_unique_id(&self, unique_id: i32) -> Option<&LynxElement> {
  //   self
  //     .unique_id_to_element_map
  //     .get(&unique_id)
  //     .map(|boxed_element| boxed_element.as_ref())
  // }
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
      unique_id_counter: 1,
      // element_templates_instances: HashMap::new(),
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

  #[wasm_bindgen(js_name = "__CreateElementCommon")]
  pub fn create_element_common(
    self: &mut MainThreadGlobalThis,
    parent_component_unique_id: i32,
    dom: web_sys::HtmlElement,
    css_id: Option<i32>,
    component_id: Option<String>,
  ) -> i32 {
    // css id
    let css_id = {
      if let Some(css_id) = css_id {
        css_id
      } else if let Some(parent_component) = self
        .unique_id_to_element_map
        .get(&parent_component_unique_id)
      {
        parent_component.borrow().css_id
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
    self.unique_id_counter += 1;
    let unique_id = self.unique_id_counter;
    // if !self.config_enable_css_selector {
    //   let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    // }
    self.unique_id_to_element_map.insert(
      unique_id,
      Rc::new(RefCell::new(Box::new(LynxElementData {
        unique_id,
        css_id,
        parent_component_unique_id,
        part_id: None,
        component_id,
        // dataset: None,
        // component_config: None,
        // component_at_index: None,
        // enqueue_component: None,
        // event_handlers_map: None,
        // event_handlers_map: None,
        dom_ref: dom,
      }))),
    );
    unique_id
  }

  #[wasm_bindgen(js_name = "__FlushElementTree")]
  pub fn flush_element_tree(&mut self) {
    if let Some(page) = &mut self.page {
      let page_dom = page.get_dom();
      if !page_dom.is_connected() {
        self.root_node.append_child(&page_dom).unwrap();
      }
    }
  }

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

  // #[wasm_bindgen(js_name = "__wasm_GC")]
  // pub fn gc(&mut self) {
  //   self.unique_id_to_element_map.retain(|_, value| {
  //     let dom = value.get_dom();
  //     dom.is_connected()
  //   });
  // }
}
