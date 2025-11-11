use super::{
  decoded::{DecodedTemplate, DecodedTemplateImpl},
  raw_template::LynxRawTemplate,
};
use std::collections::HashMap;
use wasm_bindgen::prelude::*;
#[wasm_bindgen]
#[derive(Default)]
pub struct TemplateManager {
  /**
   * key: template_url
   * value: DecodedTemplate
   */
  cache: HashMap<String, DecodedTemplateImpl>,
}

#[wasm_bindgen]
impl TemplateManager {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    TemplateManager::default()
  }

  #[wasm_bindgen]
  pub fn has_template_in_cache(&self, template_url: String) -> bool {
    self.cache.contains_key(&template_url)
  }

  #[wasm_bindgen]
  pub fn push_template_to_cache(&mut self, template_url: String, binary: js_sys::Uint8Array) {
    let lynx_template: LynxRawTemplate = LynxRawTemplate::from(&binary);
    let decoded_template: DecodedTemplate = lynx_template.into();
    self.cache.insert(
      template_url.clone(),
      DecodedTemplateImpl::new(decoded_template),
    );
  }
}

impl TemplateManager {
  pub(crate) fn get_cached_template(&self, template_url: &String) -> Option<DecodedTemplateImpl> {
    self.cache.get(template_url).cloned()
  }
}
