use crate::style::style_sheet_processor::{flatten_style_info, FlattenedStyleInfo};
use std::{collections::HashMap, future::Future};

/**
 * Selectors are stored as 4 separate lists:
 * - plain selectors (e.g., "div", "span")
 * - pseudo-classes (e.g., ":hover", ":active")
 * - pseudo-elements (e.g., "::before", "::after")
 * - combinator selectors (e.g., ">", "+", "~")
 */
pub type Selector = Vec<(Vec<String>, Vec<String>, Vec<String>, Vec<String>)>;
#[derive(Clone, Debug, PartialEq)]
pub struct StyleRule {
  pub selectors: Vec<Selector>,
  pub declarations: Vec<(String, String)>,
}

pub struct StyleSheet {
  pub rules: Vec<StyleRule>,
  pub at_rules: String,
  pub imports: Vec<i32>,
}

/**
 * key: cssId
 * value: StyleSheet
 */
pub type StyleInfo = HashMap<i32, StyleSheet>;

pub enum LynxEventType {
  Bind,
  Catch,
  CaptureBind,
  CaptureCatch,
}

pub struct EventSetting {
  event_type: LynxEventType,
  event_name: String,
  value: String,
}

pub enum TemplateType {
  Card,
  Lazy,
}
pub enum DslType {
  React,
  InternalDslNameTbd,
}
pub struct PageConfig {
  enable_css_selector: bool,
  enable_remove_css_scope: bool,
  default_display_linear: bool,
  default_overflow_visible: bool,
  enable_js_data_processor: bool,
}

pub struct ElementTemplate {
  id: String,
  type_str: String,
  id_selector: Option<String>,
  class_selectors: Option<Vec<String>>,
  attributes: Option<HashMap<String, String>>,
  children: Option<Vec<ElementTemplate>>,
  events: Option<Vec<EventSetting>>,
  dataset: Option<HashMap<String, String>>,
}

pub struct LynxTemplate {
  lepus_code: HashMap<String, String>,
  manifest_code: HashMap<String, String>,
  app_type: TemplateType,
  card_type: DslType,
  page_config: PageConfig,
  style_info: StyleInfo,
  element_template: ElementTemplate,
}

pub struct DecodedTemplate {
  lepus_code: HashMap<String, String>,
  manifest_code: HashMap<String, String>,
  app_type: TemplateType,
  card_type: DslType,
  page_config: PageConfig,
  style_info: FlattenedStyleInfo,
  element_template: ElementTemplate,
}

pub struct TemplateLoader {
  /**
   * key: template_url
   * value: DecodedTemplate
   */
  cache: HashMap<String, DecodedTemplate>,
}

impl TemplateLoader {
  fn new() -> Self {
    TemplateLoader {
      cache: HashMap::new(),
    }
  }

  pub fn decode_and_cache_template(
    &mut self,
    template_url: &String,
    raw_template: LynxTemplate,
  ) -> &DecodedTemplate {
    if self.cache.contains_key(template_url) {
      return self.cache.get(template_url).unwrap();
    }

    let decoded_style_info = flatten_style_info(raw_template.style_info);
    let decoded_template = DecodedTemplate {
      lepus_code: raw_template.lepus_code,
      manifest_code: raw_template.manifest_code,
      app_type: raw_template.app_type,
      card_type: raw_template.card_type,
      page_config: raw_template.page_config,
      style_info: decoded_style_info,
      element_template: raw_template.element_template,
    };

    self.cache.insert(template_url.clone(), decoded_template);
    self.cache.get(template_url).unwrap()
  }

  pub fn get_cached_template(&self, template_url: &String) -> Option<&DecodedTemplate> {
    self.cache.get(template_url)
  }
}
