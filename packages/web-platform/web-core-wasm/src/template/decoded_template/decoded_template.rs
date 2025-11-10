use std::{collections::HashMap, rc::Rc};

use super::{
  flatten_style_info, DslType, ElementTemplate, FlattenedStyleInfo, LynxRawTemplate, PageConfig,
  TemplateType,
};

pub(crate) struct DecodedTemplate {
  pub(crate) lepus_code_urls: HashMap<String, String>,
  pub(crate) manifest_code: HashMap<String, String>,
  pub(crate) app_type: TemplateType,
  pub(crate) card_type: DslType,
  pub(crate) page_config: PageConfig,
  pub(crate) style_info: FlattenedStyleInfo,
  pub(crate) element_templates: HashMap<String, Vec<ElementTemplate>>,
}

impl From<LynxRawTemplate> for DecodedTemplate {
  fn from(template: LynxRawTemplate) -> Self {
    let decoded_style_info = flatten_style_info(template.style_info);
    DecodedTemplate {
      lepus_code_urls: template
        .lepus_code
        .into_iter()
        .map(|(k, v)| {
          let buffer = js_sys::Uint8Array::from(v.as_bytes());
          let blob = web_sys::Blob::new_with_buffer_source_sequence(&buffer).unwrap();
          let url = web_sys::Url::create_object_url_with_blob(&blob).unwrap();
          (k, url)
        })
        .collect(),
      manifest_code: template.manifest_code,
      app_type: template.app_type,
      card_type: template.card_type,
      page_config: template.page_config,
      style_info: decoded_style_info,
      element_templates: template.element_templates,
    }
  }
}

#[derive(Clone)]
pub(crate) struct DecodedTemplateImpl {
  template: Rc<DecodedTemplate>,
}

impl DecodedTemplateImpl {
  pub fn get_lepus_code_url(&self, chunk_name: &str) -> Option<&String> {
    self.template.lepus_code_urls.get(chunk_name)
  }

  pub fn new(template: DecodedTemplate) -> Self {
    DecodedTemplateImpl {
      template: Rc::new(template),
    }
  }

  pub fn get_style_info(&self) -> &FlattenedStyleInfo {
    &self.template.style_info
  }

  pub fn get_element_templates_by_id(&self, template_id: &str) -> Option<&Vec<ElementTemplate>> {
    self.template.element_templates.get(template_id)
  }
}
