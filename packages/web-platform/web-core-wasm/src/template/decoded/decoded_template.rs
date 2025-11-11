use std::{collections::HashMap, rc::Rc};

use super::{
  flatten_style_info, DslType, ElementTemplate, FlattenedStyleInfo, LynxRawTemplate, PageConfig,
  TemplateType,
};

pub(crate) struct DecodedTemplate {
  pub(crate) lepus_code_urls: HashMap<String, String>,
  pub(crate) manifest_code_urls: HashMap<String, String>,
  pub(crate) app_type: TemplateType,
  pub(crate) card_type: DslType,
  pub(crate) page_config: PageConfig,
  pub(crate) style_info: FlattenedStyleInfo,
  pub(crate) element_templates: HashMap<String, Vec<ElementTemplate>>,
}

fn to_blob_url_from_code(code: &str) -> String {
  let buffer = js_sys::Uint8Array::from(code.as_bytes());
  let blob_option = web_sys::BlobPropertyBag::new();
  blob_option.set_type("text/javascript; charset=utf-8");
  let blob =
    web_sys::Blob::new_with_buffer_source_sequence_and_options(&buffer, &blob_option).unwrap();
  web_sys::Url::create_object_url_with_blob(&blob).unwrap()
}

impl From<LynxRawTemplate> for DecodedTemplate {
  fn from(template: LynxRawTemplate) -> Self {
    let decoded_style_info = flatten_style_info(template.style_info);
    DecodedTemplate {
      lepus_code_urls: template
        .lepus_code
        .into_iter()
        .map(|(k, v)| {
          let url = to_blob_url_from_code(&v);
          (k, url)
        })
        .collect(),
      manifest_code_urls: template
        .manifest_code
        .into_iter()
        .map(|(k, v)| {
          let url = to_blob_url_from_code(&v);
          (k, url)
        })
        .collect(),
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

  pub fn get_manifest_urls(&self) -> &HashMap<String, String> {
    &self.template.manifest_code_urls
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

  pub fn get_page_config(&self) -> &PageConfig {
    &self.template.page_config
  }
}
