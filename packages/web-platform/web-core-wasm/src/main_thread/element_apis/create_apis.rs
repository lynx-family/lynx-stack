use crate::constants;
use wasm_bindgen::prelude::*;

use super::{LynxElement, MainThreadGlobalThis};

#[wasm_bindgen]
impl MainThreadGlobalThis {
  #[wasm_bindgen(js_name = "__CreateElement")]
  pub fn create_element(&mut self, tag: &str, parent_component_unique_id: i32) -> LynxElement {
    LynxElement::new(self, tag, parent_component_unique_id, None, None)
  }

  #[wasm_bindgen(js_name = "__CreateView")]
  pub fn create_view(&mut self, parent_component_unique_id: i32) -> LynxElement {
    LynxElement::new(self, "view", parent_component_unique_id, None, None)
  }

  #[wasm_bindgen(js_name = "__CreateText")]
  pub fn create_text(&mut self, parent_component_unique_id: i32) -> LynxElement {
    LynxElement::new(self, "text", parent_component_unique_id, None, None)
  }

  #[wasm_bindgen(js_name = "__CreateRawText")]
  pub fn create_raw_text(&mut self, text: &str) -> LynxElement {
    let element = LynxElement::new(self, "raw-text", -1, None, None);
    let _ = element.set_attribute("text", text);
    element
  }

  #[wasm_bindgen(js_name = "__CreateImage")]
  pub fn create_image(&mut self, parent_component_unique_id: i32) -> LynxElement {
    LynxElement::new(self, "image", parent_component_unique_id, None, None)
  }

  #[wasm_bindgen(js_name = "__CreateScrollView")]
  pub fn create_scroll_view(&mut self, parent_component_unique_id: i32) -> LynxElement {
    LynxElement::new(self, "scroll-view", parent_component_unique_id, None, None)
  }

  #[wasm_bindgen(js_name = "__CreateWrapperElement")]
  pub fn create_wrapper_element(&mut self, parent_component_unique_id: i32) -> LynxElement {
    LynxElement::new(self, "lynx-wrapper", parent_component_unique_id, None, None)
  }

  #[wasm_bindgen(js_name = "__CreatePage")]
  pub fn create_page(&mut self, component_id: &str, css_id: i32) -> LynxElement {
    let page: LynxElement = LynxElement::new(
      self,
      "page",
      0,
      Some(css_id),
      Some(component_id.to_string()),
    );
    {
      let unique_id = page.get_unique_id();
      self
        .component_id_to_unique_id_map
        .insert(component_id.to_string(), unique_id);
      if !self.page_config.default_display_linear {
        let _ = page.set_attribute(constants::LYNX_DEFAULT_DISPLAY_LINEAR_ATTRIBUTE, "false");
      }
      if self.page_config.default_overflow_visible {
        let _ = page.set_attribute(constants::LYNX_DEFAULT_OVERFLOW_VISIBLE_ATTRIBUTE, "true");
      }
      self.page = Some(page.clone());
    }
    page
  }

  #[wasm_bindgen(js_name = "__CreateComponent")]
  pub fn create_component(
    &mut self,
    component_parent_unique_id: i32,
    component_id: &str,
    css_id: i32,
  ) -> LynxElement {
    let component = LynxElement::new(
      self,
      "view",
      component_parent_unique_id,
      Some(css_id),
      Some(component_id.to_string()),
    );
    self
      .component_id_to_unique_id_map
      .insert(component_id.to_string(), component.get_unique_id());
    component
  }
}

/**
 * methods for internal use
 */
impl MainThreadGlobalThis {
  pub(crate) fn get_lynx_element_by_dom(&self, dom: &web_sys::HtmlElement) -> Option<&LynxElement> {
    let unique_id: i32 = js_sys::Reflect::get(
      dom,
      &wasm_bindgen::JsValue::from_str(constants::LYNX_UNIQUE_ID_ATTRIBUTE),
    )
    .unwrap()
    .as_f64()
    .unwrap() as i32;
    if let Some(element) = self.unique_id_to_element_map.get(&unique_id) {
      Some(element)
    } else {
      None
    }
  }
}
