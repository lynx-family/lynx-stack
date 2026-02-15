/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::style_manager::StyleManager;
use crate::constants;
use crate::js_binding::RustMainthreadContextBinding;
use crate::main_thread::element_data::LynxElementData;
use crate::template::template_sections::style_info::StyleSheetResource;
use fnv::{FnvHashMap, FnvHashSet};
use std::cell::RefCell;
use std::{rc::Rc, vec};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct MainThreadWasmContext {
  pub(super) unique_id_to_element_map: Vec<Option<Rc<RefCell<Box<LynxElementData>>>>>,
  pub(super) unique_id_to_dom_map: FnvHashMap<usize, web_sys::HtmlElement>,
  pub(super) timing_flags: Vec<String>,

  pub(super) enabled_events: FnvHashSet<String>,
  pub(super) page_element_unique_id: Option<usize>,
  pub(super) mts_binding: RustMainthreadContextBinding,
  pub(super) config_enable_css_selector: bool,
  pub(super) style_manager: StyleManager,
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
    config_enable_css_selector: bool,
  ) -> MainThreadWasmContext {
    let style_manager = StyleManager::new(root_node.clone());
    MainThreadWasmContext {
      mts_binding,
      unique_id_to_element_map: vec![None],
      unique_id_to_dom_map: FnvHashMap::default(),
      enabled_events: FnvHashSet::default(),
      timing_flags: vec![],
      page_element_unique_id: None,
      config_enable_css_selector,
      style_manager,
    }
  }

  pub fn push_style_sheet(
    &mut self,
    style_info: &StyleSheetResource,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    self.style_manager.push_style_sheet(style_info, entry_name)
  }

  pub fn set_page_element_unique_id(&mut self, unique_id: usize) {
    self.page_element_unique_id = Some(unique_id);
  }

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
    self.unique_id_to_dom_map.insert(unique_id, dom.clone());
    unique_id
  }

  pub fn get_dom_by_unique_id(&self, unique_id: usize) -> Option<web_sys::HtmlElement> {
    self.unique_id_to_dom_map.get(&unique_id).cloned()
  }

  pub fn take_timing_flags(&mut self) -> Vec<String> {
    std::mem::take(&mut self.timing_flags)
  }

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

  pub fn get_css_id_by_unique_id(&self, unique_id: usize) -> Option<i32> {
    self
      .unique_id_to_element_map
      .get(unique_id)
      .and_then(|opt| opt.as_ref())
      .map(|element_data_cell| element_data_cell.borrow().css_id)
  }

  // pub fn gc(&mut self) {
  //   self.unique_id_to_element_map.retain(|_, value| {
  //     let dom = value.get_dom();
  //     dom.is_connected()
  //   });
  // }
}
