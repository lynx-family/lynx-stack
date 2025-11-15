use crate::template::raw_template::JSONRawTemplate;

use super::{
  decoded::{DecodedTemplate, DecodedTemplateImpl},
  raw_template::LynxRawTemplate,
};
use std::{cell::RefCell, collections::HashMap};
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
#[derive(Default)]
pub struct TemplateManager {
  /**
   * key: template_url
   * value: DecodedTemplate
   */
  cache: RefCell<HashMap<String, DecodedTemplateImpl>>,
}

#[wasm_bindgen]
impl TemplateManager {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    TemplateManager::default()
  }

  #[wasm_bindgen]
  pub fn has_template_in_cache(&self, template_url: String) -> bool {
    self.cache.borrow().contains_key(&template_url)
  }

  #[wasm_bindgen]
  pub fn push_template_to_cache(&self, template_url: String, binary: js_sys::Uint8Array) {
    let lynx_template: LynxRawTemplate = LynxRawTemplate::from(&binary);
    assert!(
      !self.cache.borrow().contains_key(&template_url),
      "Template for URL {template_url} already exists in cache"
    );
    self.cache.borrow_mut().insert(
      template_url.clone(),
      DecodedTemplateImpl::new(lynx_template, &template_url),
    );
  }
  #[wasm_bindgen]
  pub fn push_json_template_to_cache(&self, template_url: String, json: wasm_bindgen::JsValue) {
    let json_template: JSONRawTemplate = JSONRawTemplate::from(json);
    let lynx_template: LynxRawTemplate = LynxRawTemplate::from(json_template);
    self.cache.borrow_mut().insert(
      template_url.clone(),
      DecodedTemplateImpl::new(lynx_template, &template_url),
    );
  }
}

impl TemplateManager {
  pub(crate) fn get_cached_template(&self, template_url: &String) -> Option<DecodedTemplateImpl> {
    self.cache.borrow().get(template_url).cloned()
  }
}
