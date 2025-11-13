use crate::template::CURRENT_VERSION;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use super::{ElementTemplate, JSONRawTemplate, StyleInfo};

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
#[derive(Deserialize, Clone)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct PageConfig {
  #[serde(rename = "enableCSSSelector")]
  pub(crate) enable_css_selector: bool,
  #[serde(rename = "enableRemoveCSSScope")]
  pub(crate) enable_remove_css_scope: bool,
  #[serde(rename = "defaultDisplayLinear")]
  pub(crate) default_display_linear: bool,
  #[serde(rename = "defaultOverflowVisible")]
  pub(crate) default_overflow_visible: bool,
  #[serde(rename = "enableJSDataProcessor")]
  pub(crate) enable_js_data_processor: bool,
}

#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct LynxRawTemplate {
  pub(crate) lepus_code: HashMap<String, String>,
  pub(crate) manifest_code: HashMap<String, String>,
  pub(crate) app_type: TemplateType,
  pub(crate) card_type: DslType,
  pub(crate) page_config: PageConfig,
  pub(crate) style_info: StyleInfo,
  pub(crate) element_templates: HashMap<String, Vec<ElementTemplate>>,
}

impl From<&js_sys::Uint8Array> for LynxRawTemplate {
  fn from(array_buffer: &js_sys::Uint8Array) -> Self {
    let first_byte = array_buffer.get_index(0);
    if first_byte == b'{' {
      todo!("Support legacy JSON template decoding");
      // let json_template: JSONRawTemplate = array_buffer.into();
      // LynxRawTemplate::from(json_template)
    } else {
      let bytes = array_buffer.to_vec();
      let version_bytes = &bytes[0..4];
      let version = u32::from_le_bytes(version_bytes.try_into().unwrap());
      assert!(
        version < CURRENT_VERSION,
        "Unsupported template version: {version}"
      );
      let (lynx_template, _): (LynxRawTemplate, _) =
        bincode::serde::decode_from_slice(&bytes[4..], bincode::config::standard()).unwrap();
      lynx_template
    }
  }
}
