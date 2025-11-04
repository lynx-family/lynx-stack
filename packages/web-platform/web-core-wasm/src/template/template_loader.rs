use super::{flatten_style_info, DecodedTemplate, LynxTemplate};
use std::collections::HashMap;

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

    todo!();
    // self.cache.insert(template_url.clone(), decoded_template);
    // self.cache.get(template_url).unwrap()
  }

  pub fn get_cached_template(&self, template_url: &String) -> Option<&DecodedTemplate> {
    self.cache.get(template_url)
  }
}
