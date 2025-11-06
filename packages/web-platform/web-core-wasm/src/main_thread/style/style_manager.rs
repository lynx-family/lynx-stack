use super::style_sheet_processor::{
  transform_to_web_style_css_ng, transform_to_web_style_css_og,
  CssOgCssIdToClassNameToDeclarationsMap,
};
use crate::template::FlattenedStyleInfo;
use std::collections::HashMap;
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
  unique_id_to_style_declarations_map: Option<HashMap<i32, web_sys::CssStyleDeclaration>>,
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
        unique_id_to_style_declarations_map: None,
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
        unique_id_to_style_declarations_map: Some(HashMap::new()),
      }
    }
  }

  pub(crate) fn update_css_og_style(
    &mut self,
    unique_id: i32,
    css_id: i32,
    entry_name: &str,
    class_names: &[String],
  ) {
    let new_declarations = class_names
      .iter()
      .filter_map(|class_name| {
        if let Some(css_query_map_by_entry_name) = &self.css_query_map_by_entry_name {
          if let Some(css_id_to_class_name_map) = css_query_map_by_entry_name.get(entry_name) {
            if let Some(class_name_to_declarations_map) = css_id_to_class_name_map.get(&css_id) {
              if let Some(declaration) = class_name_to_declarations_map.get(class_name) {
                return Some(declaration.iter().map(|(k, v)| format!("{k}: {v};")));
              }
            }
          }
        }
        None
      })
      .flatten()
      .collect::<Vec<String>>()
      .join("");

    // update style declaration

    let style_sheet = self.style_sheet.as_ref().unwrap();
    let unique_id_to_style_declarations_map =
      self.unique_id_to_style_declarations_map.as_mut().unwrap();
    if let Some(style_declaration) = unique_id_to_style_declarations_map.get(&unique_id) {
      style_declaration.set_css_text(&new_declarations);
    } else {
      let rule_index = style_sheet
        .insert_rule(&format!(
          "[unique-id=\"{unique_id}\"] {{{new_declarations}}}"
        ))
        .unwrap();
      let style_declaration = style_sheet
        .css_rules()
        .unwrap()
        .get(rule_index)
        .unwrap()
        .unchecked_into::<web_sys::CssStyleDeclaration>();
      unique_id_to_style_declarations_map.insert(unique_id, style_declaration);
    }
  }
}
