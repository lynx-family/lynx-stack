use super::{
  // element_apis::ElementTemplatesInstance,
  style::StyleManager,
};

use crate::js_binding::{BackgroundThreadRPC, JSRealm, MainThreadJSBinding};
use crate::main_thread::element_apis::LynxElementData;
use crate::{constants, template};
use std::cell::RefCell;
use std::{
  collections::{HashMap, HashSet},
  rc::Rc,
  vec,
};
use wasm_bindgen::prelude::*;

// marco set css id
#[inline(always)]
pub(crate) fn set_css_id_status(element_data: &mut LynxElementData, css_id: i32) {
  if css_id != element_data.css_id {
    if css_id == 0 {
      element_data
        .dom_ref
        .remove_attribute(constants::CSS_ID_ATTRIBUTE)
        .unwrap();
    } else {
      let _ = element_data
        .dom_ref
        .set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }
  }
  element_data.css_id = css_id;
}

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  pub(super) unique_id_counter: i32,
  pub(super) tag_name_to_html_tag_map: HashMap<String, String>,
  pub(super) unique_id_to_element_map: HashMap<i32, Rc<RefCell<Box<LynxElementData>>>>,
  pub(super) timing_flags: Vec<String>,
  pub(super) exposure_changed_elements: Vec<i32>,
  pub(super) style_manager: StyleManager,
  pub(super) enabled_events: HashSet<String>,
  pub(super) page_element_unique_id: Option<i32>,
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
  ) -> MainThreadGlobalThis {
    let style_manager = StyleManager::new(
      root_node.clone(),
      config_enable_css_selector,
      config_enable_remove_css_scope,
    );
    MainThreadGlobalThis {
      // template,
      mts_realm,
      mts_binding,
      bts_rpc,
      unique_id_counter: 1,
      // element_templates_instances: HashMap::new(),
      unique_id_to_element_map: HashMap::new(),
      enabled_events: HashSet::new(),
      tag_name_to_html_tag_map: HashMap::new(),
      timing_flags: vec![],
      exposure_changed_elements: vec![],
      // document,
      style_manager,
      entry_template_url: None,
      // root_node,
      page_element_unique_id: None,
      config_enable_css_selector,
      config_default_display_linear,
      config_default_overflow_visible,
    }
  }

  #[wasm_bindgen(js_name = "__wasm_set_page_element_unique_id")]
  pub fn set_page_element_unique_id(&mut self, unique_id: i32) {
    self.page_element_unique_id = Some(unique_id);
  }

  #[wasm_bindgen(js_name = "__CreateElementCommon")]
  pub fn create_element_common(
    self: &mut MainThreadGlobalThis,
    parent_component_unique_id: i32,
    dom: web_sys::HtmlElement,
    css_id: Option<i32>,
    component_id: Option<String>,
  ) -> i32 {
    // unique id
    /*
     if the css selector is disabled, we need to set the unique id attribute for element lookup by using attribute selector
    */
    self.unique_id_counter += 1;
    let unique_id = self.unique_id_counter;
    if !self.config_enable_css_selector {
      let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    }
    let mut element_data = Box::new(LynxElementData {
      unique_id,
      css_id: 0,
      parent_component_unique_id,
      component_id,
      dataset: None,
      component_config: None,
      event_handlers_map: None,
      dom_ref: dom,
    });

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
    set_css_id_status(&mut element_data, css_id);
    self
      .unique_id_to_element_map
      .insert(unique_id, Rc::new(RefCell::new(element_data)));
    unique_id
  }

  #[wasm_bindgen(js_name = "__wasm_PushTemplate")]
  pub fn push_template(
    &mut self,
    template_manager: &template::TemplateManager,
    template_url: String,
  ) {
    if self.entry_template_url.is_none() {
      self.entry_template_url = template_url.clone().into();
      self.style_manager.push_style_sheet(
        template_manager
          .get_cached_template(&template_url)
          .unwrap()
          .get_style_info(),
        None,
      );
    } else {
      self.style_manager.push_style_sheet(
        template_manager
          .get_cached_template(&template_url)
          .unwrap()
          .get_style_info(),
        Some(&template_url),
      );
    }
  }

  // #[wasm_bindgen(js_name = "__wasm_GC")]
  // pub fn gc(&mut self) {
  //   self.unique_id_to_element_map.retain(|_, value| {
  //     let dom = value.get_dom();
  //     dom.is_connected()
  //   });
  // }
}
