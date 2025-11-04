use super::decode_legacy_json::JsonTemplateRaw;
use super::{flatten_style_info, ElementTemplate, FlattenedStyleInfo, StyleInfo, CURRENT_VERSION};
use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
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
#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub enum TemplateType {
  Card,
  Lazy,
}

#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub enum DslType {
  React,
  InternalDslNameTbd,
}
#[derive(Deserialize, Serialize)]
pub struct PageConfig {
  #[serde(rename = "enableCSSSelector")]
  enable_css_selector: bool,
  #[serde(rename = "enableRemoveCSSScope")]
  enable_remove_css_scope: bool,
  #[serde(rename = "defaultDisplayLinear")]
  default_display_linear: bool,
  #[serde(rename = "defaultOverflowVisible")]
  default_overflow_visible: bool,
  #[serde(rename = "enableJSDataProcessor")]
  enable_js_data_processor: bool,
}

#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub struct LynxTemplate {
  pub(super) lepus_code: HashMap<String, String>,
  pub(super) manifest_code: HashMap<String, String>,
  pub(super) app_type: TemplateType,
  pub(super) card_type: DslType,
  pub(super) page_config: PageConfig,
  pub(super) style_info: StyleInfo,
  pub(super) element_template: HashMap<String, ElementTemplate>,
}

pub struct DecodedTemplate {
  lepus_code: HashMap<String, String>,
  manifest_code: HashMap<String, String>,
  app_type: TemplateType,
  card_type: DslType,
  page_config: PageConfig,
  style_info: FlattenedStyleInfo,
  element_template: HashMap<String, ElementTemplate>,
}

impl From<LynxTemplate> for DecodedTemplate {
  fn from(template: LynxTemplate) -> Self {
    let decoded_style_info = flatten_style_info(template.style_info);
    DecodedTemplate {
      lepus_code: template.lepus_code,
      manifest_code: template.manifest_code,
      app_type: template.app_type,
      card_type: template.card_type,
      page_config: template.page_config,
      style_info: decoded_style_info,
      element_template: template.element_template,
    }
  }
}

impl From<&js_sys::Uint8Array> for LynxTemplate {
  fn from(array_buffer: &js_sys::Uint8Array) -> Self {
    let first_byte = array_buffer.get_index(0);
    if first_byte == b'{' {
      let json_template: JsonTemplateRaw = array_buffer.into();
      LynxTemplate::from(json_template)
    } else {
      let bytes = array_buffer.to_vec();
      let version_bytes = &bytes[0..4];
      let version = u32::from_le_bytes(version_bytes.try_into().unwrap());
      assert!(
        version < CURRENT_VERSION,
        "Unsupported template version: {version}"
      );
      let (lynx_template, _): (LynxTemplate, _) =
        bincode::serde::decode_from_slice(&bytes[4..], bincode::config::standard()).unwrap();
      lynx_template
    }
  }
}
