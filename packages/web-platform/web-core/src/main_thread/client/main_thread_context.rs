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
use std::cell::{Cell, RefCell};
use std::{rc::Rc, vec};
use wasm_bindgen::prelude::*;

/// One element's metadata, shared so a caller can keep it alive past the lookup
/// that produced it.
pub(crate) type ElementDataCell = Rc<RefCell<Box<LynxElementData>>>;

// The main thread state, shared with JS through `wasm-bindgen`.
//
// # Re-entrancy
//
// Every exported method takes `&self`, never `&mut self`, and reaches its
// mutable state through the `RefCell`/`Cell` fields below. This is load
// bearing rather than stylistic: `wasm-bindgen` wraps an exported struct in a
// `WasmRefCell` and holds a borrow for the whole duration of an exported call,
// taking a *shared* borrow for `&self` and an *exclusive* one for `&mut self`.
//
// Dispatch re-enters JS while such a call is on the stack -
// `common_event_handler` runs a main-thread event handler through the
// `runWorklet` / `runElementClosure` bindings - and that handler is free to
// call any Element PAPI, which lands back here. With a `&mut self` export that
// nested call fails the borrow guard and throws "recursive use of an object
// detected which would lead to unsafe aliasing in rust"; the throw unwinds out
// through the dispatcher's own frames, so it is reported as an uncaught error
// and the rest of the dispatch (later handlers, the bubble pass, the
// global-bind pass) never runs. `&self` everywhere keeps the nested call to a
// second shared borrow, which the guard allows.
//
// The same rule applies one level down: a `RefCell` borrow - a field here, or
// a `LynxElementData` - must not be held across a call into JS, because the
// handler on the other side may reach the same cell. Take what is needed, drop
// the borrow, then call out.
#[wasm_bindgen]
pub struct MainThreadWasmContext {
  pub(super) unique_id_to_element_map: RefCell<Vec<Option<ElementDataCell>>>,
  pub(super) unique_id_to_dom_map: RefCell<FnvHashMap<usize, js_sys::WeakRef>>,
  pub(super) timing_flags: RefCell<Vec<String>>,

  pub(super) enabled_events: RefCell<FnvHashSet<String>>,
  pub(super) page_element_unique_id: Cell<Option<usize>>,
  pub(super) mts_binding: RustMainthreadContextBinding,
  pub(super) config_enable_css_selector: bool,
  pub(super) style_manager: RefCell<StyleManager>,
  pub(super) global_bind_events: RefCell<FnvHashMap<String, FnvHashSet<usize>>>,
}

impl MainThreadWasmContext {
  pub(crate) fn get_element_data_by_unique_id(&self, unique_id: usize) -> Option<ElementDataCell> {
    self
      .unique_id_to_element_map
      .borrow()
      .get(unique_id)
      .and_then(|opt| opt.clone())
  }

  /// The `WeakRef` for an element, cloned out so the map borrow ends here.
  /// Callers hand this to `mts_binding`, which re-enters JS.
  pub(crate) fn get_dom_ref_by_unique_id(&self, unique_id: usize) -> Option<js_sys::WeakRef> {
    self.unique_id_to_dom_map.borrow().get(&unique_id).cloned()
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
      unique_id_to_element_map: RefCell::new(vec![None]),
      unique_id_to_dom_map: RefCell::new(FnvHashMap::default()),
      enabled_events: RefCell::new(FnvHashSet::default()),
      timing_flags: RefCell::new(vec![]),
      page_element_unique_id: Cell::new(None),
      config_enable_css_selector,
      style_manager: RefCell::new(style_manager),
      global_bind_events: RefCell::new(FnvHashMap::default()),
    }
  }

  pub fn push_style_sheet(
    &self,
    style_info: &StyleSheetResource,
    entry_name: Option<String>,
  ) -> Result<(), JsError> {
    self
      .style_manager
      .borrow_mut()
      .push_style_sheet(style_info, entry_name)
  }

  pub fn set_page_element_unique_id(&self, unique_id: usize) {
    self.page_element_unique_id.set(Some(unique_id));
  }

  pub fn create_element_common(
    &self,
    parent_component_unique_id: usize,
    dom: web_sys::HtmlElement,
    dom_ref: js_sys::WeakRef,
    component_css_id: Option<i32>,
    component_id: Option<String>,
  ) -> usize {
    // unique id
    /*
     if the css selector is disabled, we need to set the unique id attribute for element lookup by using attribute selector
    */
    // Reserved before the attribute writes below, which enter JS: without the
    // exclusive borrow `wasm-bindgen` used to hold, a nested `__CreateElement`
    // would otherwise read the same length and hand out the same id twice.
    let unique_id = {
      let mut element_map = self.unique_id_to_element_map.borrow_mut();
      element_map.push(None);
      element_map.len() - 1
    };

    let css_id = {
      if let Some(parent_component_data) =
        self.get_element_data_by_unique_id(parent_component_unique_id)
      {
        parent_component_data.borrow().component_css_id
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
    let element_data = LynxElementData::new(
      parent_component_unique_id,
      css_id,
      component_css_id.unwrap_or(0),
      component_id,
    );

    let element_data = Box::new(element_data);
    self.unique_id_to_element_map.borrow_mut()[unique_id] =
      Some(Rc::new(RefCell::new(element_data)));
    self
      .unique_id_to_dom_map
      .borrow_mut()
      .insert(unique_id, dom_ref);
    unique_id
  }

  pub fn get_dom_by_unique_id(&self, unique_id: usize) -> Option<js_sys::WeakRef> {
    self.get_dom_ref_by_unique_id(unique_id)
  }

  pub fn take_timing_flags(&self) -> Vec<String> {
    std::mem::take(&mut *self.timing_flags.borrow_mut())
  }

  pub fn get_unique_id_by_component_id(&self, component_id: &str) -> Option<usize> {
    for (unique_id, element_data_option) in
      self.unique_id_to_element_map.borrow().iter().enumerate()
    {
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

  pub fn gc(&self) {
    let mut ids_to_remove = Vec::new();
    {
      let dom_map = self.unique_id_to_dom_map.borrow();
      for (unique_id, weak_ref) in dom_map.iter() {
        if weak_ref.deref().is_none() {
          ids_to_remove.push(*unique_id);
        }
      }
    }
    let mut dom_map = self.unique_id_to_dom_map.borrow_mut();
    let mut element_map = self.unique_id_to_element_map.borrow_mut();
    for id in ids_to_remove {
      dom_map.remove(&id);
      if let Some(element_data) = element_map.get_mut(id) {
        *element_data = None;
      }
    }
  }
}
