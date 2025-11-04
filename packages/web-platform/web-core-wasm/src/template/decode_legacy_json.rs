use crate::template::StyleSheet;
use serde::{Deserialize, Deserializer};
use serde_json::map::Keys;
use std::collections::HashMap;

use super::{
  decode::{DslType, LynxTemplate, PageConfig, TemplateType},
  ElementTemplate, OneSelectorAtom, Selector, StyleInfo, StyleRule,
};
/**
 * export interface CSSRule {
  sel: [
    plainSelectors: string[],
    pseudoClassSelectors: string[],
    pseudoElementSelectors: string[],
    combinator: string[],
    ...string[][],
  ][];
  decl: [string, string][];
}
 */
#[derive(Deserialize)]
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
pub struct JsonTemplateRaw {
  page_config: PageConfig,
  card_type: Option<String>,
  #[serde(deserialize_with = "deserialize_tolerant_string_map")]
  lepus_code: HashMap<String, String>,
  manifest: HashMap<String, String>,
  element_template: Option<HashMap<String, ElementTemplate>>,
  app_type: Option<String>,
  style_info: HashMap<String, OneInfo>,
}

fn deserialize_tolerant_string_map<'de, D>(
  deserializer: D,
) -> Result<HashMap<String, String>, D::Error>
where
  D: Deserializer<'de>,
{
  let value = serde_json::Value::deserialize(deserializer)?;

  match value {
    serde_json::Value::Object(map) => {
      let mut result_map = HashMap::new();

      for (key, val) in map {
        if let serde_json::Value::String(s) = val {
          result_map.insert(key, s);
        }
      }
      Ok(result_map)
    }

    serde_json::Value::Null => Ok(HashMap::new()),
    _ => Err(serde::de::Error::custom("Expected a JSON object or null")),
  }
}

impl From<JsonTemplateRaw> for LynxTemplate {
  fn from(value: JsonTemplateRaw) -> Self {
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
    LynxTemplate {
      lepus_code: value.lepus_code,
      manifest_code: value.manifest,
      app_type,
      card_type,
      page_config: value.page_config,
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
      element_template: value.element_template.unwrap_or_default(),
    }
  }
}

impl From<&js_sys::Uint8Array> for JsonTemplateRaw {
  fn from(value: &js_sys::Uint8Array) -> Self {
    let bytes = value.to_vec();
    let s = std::str::from_utf8(&bytes).unwrap();
    serde_json::from_str(s).unwrap()
  }
}
