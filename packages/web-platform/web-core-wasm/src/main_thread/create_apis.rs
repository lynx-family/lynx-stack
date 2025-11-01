use std::collections::HashMap;

use crate::constants;
use wasm_bindgen::prelude::*;

use super::mts_global_this::MainThreadGlobalThis;

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__CreateElement")]
  pub fn create_element(
    &mut self,
    tag: &str,
    parent_component_unique_id: i32,
  ) -> wasm_bindgen::JsValue {
    self
      .create_element_impl(tag, parent_component_unique_id, None, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateView")]
  pub fn create_view(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("view", parent_component_unique_id, None, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateText")]
  pub fn create_text(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("text", parent_component_unique_id, None, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateRawText")]
  pub fn create_raw_text(&mut self, text: &str) -> wasm_bindgen::JsValue {
    let element = self.create_element_impl("raw-text", -1, None, None);
    let _ = element
      .dom_ref
      .as_ref()
      .unwrap()
      .set_attribute("text", text);
    element.self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateImage")]
  pub fn create_image(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("image", parent_component_unique_id, None, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateScrollView")]
  pub fn create_scroll_view(&mut self, parent_component_unique_id: i32) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("scroll-view", parent_component_unique_id, None, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreateWrapperElement")]
  pub fn create_wrapper_element(
    &mut self,
    parent_component_unique_id: i32,
  ) -> wasm_bindgen::JsValue {
    self
      .create_element_impl("lynx-wrapper", parent_component_unique_id, None, None)
      .self_js_value
  }

  #[wasm_bindgen(js_name = "__CreatePage")]
  pub fn create_page(&mut self, component_id: &str, css_id: i32) -> wasm_bindgen::JsValue {
    let page = self.create_element_impl("page", 0, None, Some(component_id.to_string()));
    self
      .component_id_to_unique_id_map
      .insert(component_id.to_string(), page.data.borrow().unique_id);
    let dom = page.dom_ref.as_ref().unwrap();
    let _ = dom.set_attribute("part", "page");
    let _ = dom.set_attribute(constants::CSS_ID_ATTRIBUTE, &css_id.to_string());
    self.mark_template_element(&page);
    if !self.config_default_display_linear {
      let _ = page
        .dom_ref
        .as_ref()
        .unwrap()
        .set_attribute(constants::LYNX_DEFAULT_DISPLAY_LINEAR_ATTRIBUTE, "false");
    }
    if self.config_default_overflow_visible {
      let _ = page
        .dom_ref
        .as_ref()
        .unwrap()
        .set_attribute(constants::LYNX_DEFAULT_OVERFLOW_VISIBLE_ATTRIBUTE, "true");
    }
    // the page element is supposed to leak because it's the root of the app
    self.page = Some(page.clone());
    page.self_js_value
  }
}
