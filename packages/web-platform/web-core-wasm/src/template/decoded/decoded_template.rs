use std::{collections::HashMap, fmt::format, rc::Rc};

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

fn to_blob_url_from_code(code: String, app_type: &TemplateType, source_file_name: &str) -> String {
  let buffer = js_sys::Uint8Array::from(
    format!(
      "(function(){{ \"use strict\"; const {}=void 0; {} {code} \n }})()\n//# sourceURL={}\n//# allFunctionsCalledOnLoad", 
      (["navigator", "postMessage", "window"]).join("=void 0,"),
      match app_type {
        TemplateType::Card => "module.exports=",
        TemplateType::Lazy => "",
      },
      source_file_name
    )
    .as_bytes()
  );
  let blob_option = web_sys::BlobPropertyBag::new();
  blob_option.set_type("text/javascript; charset=utf-8");
  let blob = web_sys::Blob::new_with_u8_array_sequence_and_options(
    &js_sys::Array::of1(&buffer),
    &blob_option,
  )
  .unwrap();
  web_sys::Url::create_object_url_with_blob(&blob).unwrap()
}

#[derive(Clone)]
pub(crate) struct DecodedTemplateImpl {
  template: Rc<DecodedTemplate>,
}

impl DecodedTemplateImpl {
  pub fn new(template: LynxRawTemplate, url: &str) -> Self {
    let decoded_style_info = flatten_style_info(template.style_info);
    let decoded_template = DecodedTemplate {
      lepus_code_urls: template
        .lepus_code
        .into_iter()
        .map(|(k, v)| {
          let url = to_blob_url_from_code(v, &template.app_type, format!("{url}/{k}").as_str());
          (k, url)
        })
        .collect(),
      manifest_code: template.manifest_code,
      app_type: template.app_type,
      card_type: template.card_type,
      page_config: template.page_config,
      style_info: decoded_style_info,
      element_templates: template.element_templates,
    };
    DecodedTemplateImpl {
      template: Rc::new(decoded_template),
    }
  }

  pub fn get_lepus_code_url(&self, chunk_name: &str) -> Option<&String> {
    self.template.lepus_code_urls.get(chunk_name)
  }

  pub fn get_manifest_code(&self) -> &HashMap<String, String> {
    &self.template.manifest_code
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
