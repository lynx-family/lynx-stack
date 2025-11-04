use super::style_sheet_processor::{
  transform_to_web_style_css_ng, transform_to_web_style_css_og,
  CssOgCssIdToClassNameToDeclarationsMap,
};
use crate::template::FlattenedStyleInfo;
use std::{collections::HashMap, rc::Rc};
use wasm_bindgen::JsCast;

/**
 * There are two modes to manage styles:
 * 1. CSS Selector mode: styles are injected into a <style>, the style manager won't keep track of which styles are applied to which elements.
 *    The browser's native CSS selector engine will handle the style application.
 * 2. Non-CSS Selector mode: styles are managed by the style manager, which keeps track of which styles are applied to which elements.
 *    The style manager will inject styles into the style sheet of a <style> element. All classes is calculated
 *    based on entry_name, css_id, class_name, and applied by using [unique-id="x"] selectors.
 */
pub(crate) struct StyleManager {
  css_query_map_by_entry_name: Option<HashMap<String, CssOgCssIdToClassNameToDeclarationsMap>>,
  style_element: web_sys::HtmlStyleElement,
  style_sheet: Option<web_sys::CssStyleSheet>,
}

impl StyleManager {
  pub(crate) fn new(
    document: &web_sys::Document,
    root_node: &web_sys::Node,
    entry_style_info: &FlattenedStyleInfo,
    config_enable_css_selector: bool,
    config_enable_remove_css_scope: bool,
  ) -> Self {
    let style_element = document
      .create_element("style")
      .unwrap()
      .unchecked_into::<web_sys::HtmlStyleElement>();
    root_node.append_child(&style_element).unwrap();
    if config_enable_css_selector {
      let style_content =
        transform_to_web_style_css_ng(entry_style_info, config_enable_remove_css_scope, None);
      style_element.set_inner_text(&style_content);
      StyleManager {
        css_query_map_by_entry_name: None,
        style_element,
        style_sheet: None,
      }
    } else {
      let (style_content, map): (String, CssOgCssIdToClassNameToDeclarationsMap) =
        transform_to_web_style_css_og(entry_style_info, config_enable_remove_css_scope, None);
      style_element.set_inner_text(&style_content);
      let style_sheet = style_element
        .sheet()
        .unwrap()
        .unchecked_into::<web_sys::CssStyleSheet>();
      let mut css_query_map_by_entry_name: HashMap<String, CssOgCssIdToClassNameToDeclarationsMap> =
        HashMap::new();
      css_query_map_by_entry_name.insert("".to_string(), map);
      StyleManager {
        css_query_map_by_entry_name: Some(css_query_map_by_entry_name),
        style_element,
        style_sheet: Some(style_sheet),
      }
    }
  }
}
