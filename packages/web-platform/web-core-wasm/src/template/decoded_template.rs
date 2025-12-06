/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use super::template_sections::*;
pub(crate) struct DecodedTemplate {
  pub(crate) template_url: String,

  /**
   * Hashed entry name of the template
   */
  pub(crate) entry_name: String,

  pub(crate) style_info: Option<DecodedStyleInfo>,

  pub(crate) lepus_code: Option<LepusCode>,

  pub(crate) background_code_urls: Option<js_sys::Object>,

  pub(crate) configuration: Option<Configurations>,

  pub(crate) element_templates: Option<ElementTemplateSection>,

  pub(crate) custom_sections: Option<js_sys::Object>,
}

impl DecodedTemplate {
  pub(crate) fn new(template_url: String) -> Self {
    DecodedTemplate {
      entry_name: template_url.clone(), // TODO: use hash function to generate entry name
      template_url,
      style_info: None,
      lepus_code: None,
      background_code_urls: None,
      configuration: None,
      element_templates: None,
      custom_sections: None,
    }
  }
}
