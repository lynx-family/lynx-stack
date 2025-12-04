use crate::template::template_sections::style_info::DecodedStyleInfo;
use fnv::FnvHashMap;
use wasm_bindgen::JsCast;

pub(super) type CssOgCssIdToClassNameToDeclarationsMap =
  FnvHashMap<i32, FnvHashMap<String, FnvHashMap<String, String>>>;
/**
 * There are two modes to manage styles:
 * 1. CSS Selector mode: styles are injected into a <style>, the style manager won't keep track of which styles are applied to which elements.
 *    The browser's native CSS selector engine will handle the style application.
 * 2. Non-CSS Selector mode: styles are managed by the style manager, which keeps track of which styles are applied to which elements.
 *    The style manager will inject styles into the style sheet of a <style> element. All classes is calculated
 *    based on entry_name, css_id, class_name, and applied by using [unique-id="x"] selectors.
 */
pub(crate) struct StyleManager {
  root_node: web_sys::Node,
  css_query_map_by_entry_name: Option<FnvHashMap<String, CssOgCssIdToClassNameToDeclarationsMap>>,
  style_sheet: Option<web_sys::CssStyleSheet>,
  unique_id_to_style_declarations_map: Option<FnvHashMap<usize, web_sys::CssStyleDeclaration>>,
  config_enable_css_selector: bool,
}

impl StyleManager {
  pub(crate) fn new(root_node: web_sys::Node, config_enable_css_selector: bool) -> Self {
    StyleManager {
      root_node,
      css_query_map_by_entry_name: None,
      style_sheet: None,
      unique_id_to_style_declarations_map: None,
      config_enable_css_selector,
    }
  }

  pub(crate) fn update_css_og_style(
    &mut self,
    unique_id: usize,
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
    if self.style_sheet.is_some() && self.css_query_map_by_entry_name.is_some() {
      let style_sheet = self.style_sheet.as_ref().unwrap();
      let unique_id_to_style_declarations_map = self
        .unique_id_to_style_declarations_map
        .get_or_insert_with(Default::default);
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

  pub(crate) fn push_style_sheet(&mut self, flattened_style_info: &DecodedStyleInfo) {
    let new_style_element = web_sys::window()
      .unwrap()
      .document()
      .unwrap()
      .create_element("style")
      .unwrap()
      .unchecked_into::<web_sys::HtmlStyleElement>();
    new_style_element.set_inner_text(&flattened_style_info.style_content);
    self.root_node.append_child(&new_style_element).unwrap();
  }
}
