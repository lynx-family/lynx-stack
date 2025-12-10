/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::element_apis::{DecodedElementTemplate, LynxElementData};
use super::style_manager::StyleManager;
use crate::constants;
use crate::js_binding::RustMainthreadContextBinding;
use crate::template::template_manager::TemplateManager;
use fnv::{FnvHashMap, FnvHashSet};
use std::cell::RefCell;
use std::{rc::Rc, vec};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadWasmContext {
  pub(super) root_node: web_sys::Node,
  pub(super) unique_id_to_element_map: Vec<Option<Rc<RefCell<Box<LynxElementData>>>>>,
  pub(super) unique_id_symbol: wasm_bindgen::JsValue,
  pub(super) timing_flags: Vec<String>,
  /**
   * key: template_url
   * value: key: element_template_name, value: DecodedElementTemplate
   */
  pub(super) element_templates_instances:
    FnvHashMap<String, FnvHashMap<String, Box<DecodedElementTemplate>>>,
  pub(super) style_manager: StyleManager,
  pub(super) enabled_events: FnvHashSet<String>,
  pub(super) page_element_unique_id: Option<usize>,
  // pub(super) template: DecodedTemplateImpl,
  // pub(super) element_templates_instances: FnvHashMap<String, ElementTemplatesInstance>,
  pub(super) mts_binding: RustMainthreadContextBinding,
  pub(super) config_enable_css_selector: bool,
}

impl MainThreadWasmContext {
  pub(crate) fn get_element_data_by_unique_id(
    &self,
    unique_id: usize,
  ) -> Option<Rc<RefCell<Box<LynxElementData>>>> {
    self
      .unique_id_to_element_map
      .get(unique_id)
      .and_then(|opt| opt.clone())
  }
}

#[wasm_bindgen]
impl MainThreadWasmContext {
  #[wasm_bindgen(constructor)]
  pub fn new(
    root_node: web_sys::Node,
    mts_binding: RustMainthreadContextBinding,
    unique_id_symbol: wasm_bindgen::JsValue,
    config_enable_css_selector: bool,
  ) -> MainThreadWasmContext {
    let style_manager = StyleManager::new(root_node.clone(), config_enable_css_selector);
    MainThreadWasmContext {
      root_node,
      // template,
      mts_binding,
      element_templates_instances: FnvHashMap::default(),
      unique_id_to_element_map: vec![None],
      unique_id_symbol,
      enabled_events: FnvHashSet::default(),
      timing_flags: vec![],
      // document,
      style_manager,
      // root_node,
      page_element_unique_id: None,
      config_enable_css_selector,
    }
  }

  #[wasm_bindgen(js_name = "__wasm_set_page_element_unique_id")]
  pub fn set_page_element_unique_id(&mut self, unique_id: usize) {
    self.page_element_unique_id = Some(unique_id);
  }

  #[wasm_bindgen(js_name = "__CreateElementCommon")]
  pub fn create_element_common(
    self: &mut MainThreadWasmContext,
    parent_component_unique_id: usize,
    dom: web_sys::HtmlElement,
    css_id: Option<i32>,
    component_id: Option<String>,
  ) -> usize {
    // unique id
    /*
     if the css selector is disabled, we need to set the unique id attribute for element lookup by using attribute selector
    */
    let unique_id = self.unique_id_to_element_map.len();

    let css_id = {
      if let Some(css_id) = css_id {
        css_id
      } else if let Some(parent_component_data) =
        self.get_element_data_by_unique_id(parent_component_unique_id)
      {
        parent_component_data.borrow().css_id
      } else {
        0
      }
    };
    if !self.config_enable_css_selector {
      let _ = dom.set_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE, &unique_id.to_string());
    }

    if css_id != 0 {
      let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    }
    let element_data = LynxElementData::new(parent_component_unique_id, css_id, component_id);

    let element_data = Box::new(element_data);
    self
      .unique_id_to_element_map
      .push(Some(Rc::new(RefCell::new(element_data))));
    unique_id
  }

  #[wasm_bindgen(js_name = "__wasm_take_timing_flags")]
  pub fn take_timing_flags(&mut self) -> Vec<String> {
    std::mem::take(&mut self.timing_flags)
  }

  #[wasm_bindgen(js_name = "__wasm_load_style")]
  pub fn load_style(
    &mut self,
    template_manager: &TemplateManager,
    template_url: String,
  ) -> Result<(), JsValue> {
    let style_info = template_manager
      .get_template_by_url(&template_url)
      .ok_or_else(|| JsValue::from_str("Template not found"))?
      .style_info
      .as_ref()
      .ok_or_else(|| JsValue::from_str("StyleInfo not set"))?;
    self.style_manager.push_style_sheet(style_info);
    Ok(())
  }

  #[wasm_bindgen(js_name = "__wasm_get_unique_id_by_component_id")]
  pub fn get_unique_id_by_component_id(&self, component_id: &str) -> Option<usize> {
    for (unique_id, element_data_option) in self.unique_id_to_element_map.iter().enumerate() {
      if let Some(element_data_cell) = element_data_option {
        let element_data = element_data_cell.borrow();
        if let Some(ref cid) = element_data.component_id {
          if cid == component_id {
            return Some(unique_id);
          }
        }
      }
    }
    None
  }

  // #[wasm_bindgen(js_name = "__wasm_GC")]
  // pub fn gc(&mut self) {
  //   self.unique_id_to_element_map.retain(|_, value| {
  //     let dom = value.get_dom();
  //     dom.is_connected()
  //   });
  // }
}
