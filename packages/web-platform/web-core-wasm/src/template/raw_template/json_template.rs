use serde::{Deserialize, Deserializer};
use std::collections::HashMap;

use crate::template::{raw_template::LynxRawTemplate, PageConfig};

use super::{DslType, ElementTemplate, Selector, StyleInfo, StyleRule, StyleSheet, TemplateType};
#[derive(Deserialize)]
pub(crate) struct JSONPageConfig {
  #[serde(rename = "enableCSSSelector")]
  pub(crate) enable_css_selector: Option<bool>,
  #[serde(rename = "enableRemoveCSSScope")]
  pub(crate) enable_remove_css_scope: Option<bool>,
  #[serde(rename = "defaultDisplayLinear")]
  pub(crate) default_display_linear: Option<bool>,
  #[serde(rename = "defaultOverflowVisible")]
  pub(crate) default_overflow_visible: Option<bool>,
  #[serde(rename = "enableJSDataProcessor")]
  pub(crate) enable_js_data_processor: Option<bool>,
}
#[derive(Deserialize)]
/**
* ```ts
 export interface CSSRule {
  sel: [
   plainSelectors: string[],
   pseudoClassSelectors: string[],
   pseudoElementSelectors: string[],
   combinator: string[],
   ...string[][],
  ][];
  decl: [string, string][];
 }
  ```
*/
struct CSSRule {
  sel: Vec<Vec<Vec<String>>>,
  decl: Vec<[String; 2]>,
}

#[derive(Deserialize)]
struct OneInfo {
  content: Vec<String>,
  rules: Vec<CSSRule>,
  imports: Option<Vec<String>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JSONRawTemplate {
  page_config: JSONPageConfig,
  card_type: Option<String>,
  #[serde(deserialize_with = "deserialize_tolerant_string_map")]
  lepus_code: HashMap<String, String>,
  manifest: HashMap<String, String>,
  element_template: Option<HashMap<String, Vec<ElementTemplate>>>,
  app_type: Option<String>,
  style_info: HashMap<String, OneInfo>,
}

fn deserialize_tolerant_string_map<'de, D>(
  deserializer: D,
) -> Result<HashMap<String, String>, D::Error>
where
  D: Deserializer<'de>,
{
  // tolerant the value could be js_sys::Object or string
  // the deserializer is serde_wasm_bindgen
  let value: serde_json::Value = Deserialize::deserialize(deserializer)?;
  let mut result_map = HashMap::new();
  if let serde_json::Value::Object(map) = value {
    for (key, val) in map {
      if let serde_json::Value::String(val_str) = val {
        result_map.insert(key, val_str);
      }
    }
  }
  Ok(result_map)
}
impl From<JSONRawTemplate> for LynxRawTemplate {
  fn from(value: JSONRawTemplate) -> Self {
    let app_type = match value.card_type.as_deref() {
      Some("card") => TemplateType::Card,
      Some("lazy") => TemplateType::Lazy,
      // if lepus_code.root starts with '(function (globDynamicComponentEntry', it's lazy template
      _ => {
        if let Some(root_code) = value.lepus_code.get("root") {
          if root_code
            .trim_start()
            .starts_with("(function (globDynamicComponentEntry")
          {
            TemplateType::Lazy
          } else {
            TemplateType::Card
          }
        } else {
          TemplateType::Card
        }
      }
    };
    let card_type = match value.app_type.as_deref() {
      Some("react") => DslType::React,
      _ => DslType::InternalDslNameTbd,
    };
    LynxRawTemplate {
      lepus_code: value.lepus_code,
      manifest_code: value.manifest,
      app_type,
      card_type,
      page_config: PageConfig {
        enable_css_selector: value.page_config.enable_css_selector.unwrap_or(true),
        enable_remove_css_scope: value.page_config.enable_remove_css_scope.unwrap_or(true),
        default_display_linear: value.page_config.default_display_linear.unwrap_or(true),
        default_overflow_visible: value.page_config.default_overflow_visible.unwrap_or(false),
        enable_js_data_processor: value.page_config.enable_js_data_processor.unwrap_or(false),
      },
      style_info: {
        let mut style_info = StyleInfo::default();
        for (key, one_info) in value.style_info {
          let key = key.parse::<i32>().unwrap();
          style_info.insert(
            key,
            StyleSheet {
              at_rules: one_info.content.join(""),
              imports: one_info
                .imports
                .unwrap_or_default()
                .into_iter()
                .filter_map(|s| s.parse::<i32>().ok())
                .collect(),
              rules: one_info
                .rules
                .into_iter()
                .map(|rule| {
                  StyleRule {
                    selectors: rule
                      .sel
                      .into_iter()
                      .map(|one_sel| {
                        // group by every 4 Vec<string>
                        let mut selector_tuples: Selector = Vec::new();
                        // iterate it by step of 4
                        let mut iter = one_sel.into_iter();
                        while let (
                          Some(plain_selectors),
                          Some(pseudo_class_selectors),
                          Some(pseudo_element_selectors),
                          Some(combinator),
                        ) = (iter.next(), iter.next(), iter.next(), iter.next())
                        {
                          selector_tuples.push((
                            plain_selectors,
                            pseudo_class_selectors,
                            pseudo_element_selectors,
                            combinator,
                          ));
                        }
                        selector_tuples
                      })
                      .collect(),
                    declarations: rule
                      .decl
                      .into_iter()
                      .map(|[key, value]| (key, value))
                      .collect(),
                  }
                })
                .collect(),
            },
          );
        }
        style_info
      },
      element_templates: value.element_template.unwrap_or_default(),
    }
  }
}

impl From<wasm_bindgen::JsValue> for JSONRawTemplate {
  fn from(value: wasm_bindgen::JsValue) -> Self {
    serde_wasm_bindgen::from_value(value).unwrap()
  }
}
