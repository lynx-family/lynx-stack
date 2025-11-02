use super::{
  element::{ConfigValue, LynxElement},
  // event::event_delegation::EventSystem,
};
use crate::constants;
use std::{collections::HashMap, rc::Rc, vec};
use wasm_bindgen::{convert::TryFromJsValue, prelude::*};

#[wasm_bindgen]
pub struct MainThreadGlobalThis {
  unique_id_counter: i32,
  pub(crate) unique_id_to_element_data_map: HashMap<i32, Box<LynxElement>>,
  pub(crate) unique_id_to_config_map: HashMap<i32, HashMap<String, String>>,
  pub(crate) component_id_to_unique_id_map: HashMap<String, i32>,
  tag_name_to_html_tag_map: HashMap<String, String>,
  pub(crate) timing_flags: Vec<String>,
  pub(crate) document: web_sys::Document,
  root_node: web_sys::Node,
  pub(crate) exposure_changed_elements: Vec<i32>,
  pub(crate) page: Option<LynxElement>,
  pub(crate) config_enable_css_selector: bool,
  pub(crate) config_enable_remove_css_scope: bool,
  pub(crate) config_default_display_linear: bool,
  pub(crate) config_default_overflow_visible: bool,
  pub(crate) config_enable_js_dataprocessor: bool,
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
      unique_id_to_element_data_map: HashMap::new(),
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

  // #[wasm_bindgen(js_name = __GetTemplateParts)]
  // pub fn get_template_parts(&self, _template_element: &LynxElement) -> Object {
  //   // TODO
  //   Object::new()
  #[wasm_bindgen(js_name = "__MarkPartElement")]
  pub fn mark_part_element(&self, element: &LynxElement, part_id: Option<String>) {
    let data = element.data.borrow();
    let dom = data.dom_ref.as_ref().unwrap();
    let element_data = &mut element.data.borrow_mut();
    if let Some(part_id) = &part_id {
      let _ = dom.set_attribute("part", part_id);
    } else {
      let _ = dom.remove_attribute("part");
    }
    element_data.part_id = part_id;
  }

  // #[wasm_bindgen(js_name = "__FlushElementTree")]
  //   let timing_flags = js_sys::Array::from_iter(self.timing_flags.iter().map(JsValue::from));

  //   self.timing_flags.clear();
  //   self.exposure_changed_elements.clear();
  #[wasm_bindgen(js_name = "__wasm_GC")]
  pub fn gc(&mut self) {
    self.unique_id_to_element_data_map.retain(|_, value| {
      let value = value.data.borrow();
      value.dom_ref.as_ref().unwrap().is_connected()
    });
  }
}

/**
 * methods for internal use
 */
impl MainThreadGlobalThis {
  pub(crate) fn create_element_impl(
    &mut self,
    tag: &str,
    parent_component_unique_id: i32,
    css_id: Option<i32>,
    component_id: Option<String>,
  ) -> LynxElement {
    self.unique_id_counter += 1;
    let unique_id = self.unique_id_counter;
    let tag = tag.to_string();
    let html_tag = self.tag_name_to_html_tag_map.get(&tag);
    let html_tag_string = if let Some(html_tag) = html_tag {
      html_tag.clone()
    } else {
      tag
    };
    let parent_component = self
      .unique_id_to_element_data_map
      .get(&parent_component_unique_id);
    let element = self.document.create_element(&html_tag_string).unwrap();
    let css_id = {
      if let Some(css_id) = css_id {
        css_id
      } else if let Some(parent_component) = parent_component {
        parent_component.data.borrow().css_id
      } else {
        0
      }
    };
    let element = Box::new(LynxElement::new(
      unique_id,
      css_id,
      html_tag_string,
      parent_component_unique_id,
      component_id,
      element,
    ));
    self
      .unique_id_to_element_data_map
      .insert(unique_id, element.clone());
    *element
  }

  pub(crate) fn get_lynx_element_by_dom(&self, dom: &web_sys::Element) -> Option<&LynxElement> {
    let unique_id_str = dom
      .get_attribute(constants::LYNX_UNIQUE_ID_ATTRIBUTE)
      .unwrap_or("0".to_string());
    let unique_id = unique_id_str.parse::<i32>().unwrap_or(0);
    if let Some(element) = self.unique_id_to_element_data_map.get(&unique_id) {
      Some(element)
    } else {
      None
    }
  }
}
