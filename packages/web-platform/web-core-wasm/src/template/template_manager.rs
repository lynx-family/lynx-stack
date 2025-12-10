/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use fnv::FnvHashMap;
use wasm_bindgen::prelude::*;

use crate::template::template_sections::*;

use super::decoded_template::DecodedTemplate;
#[wasm_bindgen]
#[derive(Default)]
pub struct TemplateManager {
  /**
   * key: template_url
   * value: DecodedTemplate
   */
  cache: FnvHashMap<String, DecodedTemplate>,
}
impl TemplateManager {
  pub(crate) fn get_raw_template_element(
    &self,
    template_url: &str,
    element_template_name: &str,
  ) -> Result<&RawElementTemplate, &'static str> {
    let decoded_template = self.cache.get(template_url).ok_or("Template not found")?;
    let element_template_section = decoded_template
      .element_templates
      .as_ref()
      .ok_or("ElementTemplateSection not set")?;
    element_template_section
      .element_templates_map
      .get(element_template_name)
      .ok_or("RawElementTemplate not found")
  }

  pub(crate) fn get_template_by_url(&self, template_url: &str) -> Option<&DecodedTemplate> {
    self.cache.get(template_url)
  }

  fn decode_and_set<T, F>(
    &mut self,
    template_url: String,
    buf: js_sys::Uint8Array,
    setter: F,
  ) -> Result<(), JsError>
  where
    T: serde::de::DeserializeOwned,
    F: FnOnce(&mut DecodedTemplate, T) -> Result<(), JsError>,
  {
    let template = self
      .cache
      .get_mut(&template_url)
      .ok_or_else(|| JsError::new("Template not found"))?;
    let (data, _) =
      bincode::serde::decode_from_slice::<T, _>(&buf.to_vec(), bincode::config::standard())
        .map_err(|e| {
          JsError::new(&format!(
            "Failed to decode {} from Uint8Array: {e}",
            std::any::type_name::<T>()
          ))
        })?;
    setter(template, data)
  }
}

#[wasm_bindgen]
impl TemplateManager {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    TemplateManager::default()
  }

  #[wasm_bindgen(js_name = createTemplate)]
  pub fn create_template(&mut self, template_url: String) -> Result<(), JsError> {
    if self.cache.contains_key(&template_url) {
      return Err(JsError::new("Template already exists"));
    }
    let decoded_template = DecodedTemplate::new(template_url.clone());
    self.cache.insert(template_url, decoded_template);
    Ok(())
  }

  #[wasm_bindgen(js_name = setConfig)]
  pub fn set_config(
    &mut self,
    template_url: String,
    config_buf: js_sys::Uint8Array,
  ) -> Result<(), JsError> {
    self.decode_and_set(
      template_url,
      config_buf,
      |template, config: Configurations| {
        template.configuration = Some(config);
        Ok(())
      },
    )
  }

  #[wasm_bindgen(js_name = getConfig)]
  pub fn get_config(&self, template_url: String, key: String) -> Result<Option<String>, JsError> {
    let template = self
      .cache
      .get(&template_url)
      .ok_or_else(|| JsError::new("Template not found"))?;
    let config = template
      .configuration
      .as_ref()
      .ok_or_else(|| JsError::new("Configuration not loaded"))?;
    Ok(config.config_data.get(&key).cloned())
  }

  #[wasm_bindgen(js_name = setStyleInfo)]
  pub fn set_style_info(
    &mut self,
    template_url: String,
    style_info_buf: js_sys::Uint8Array,
  ) -> Result<(), JsError> {
    self.decode_and_set(
      template_url,
      style_info_buf,
      |template, raw_style_info: RawStyleInfo| {
        let config = template
          .configuration
          .as_ref()
          .ok_or_else(|| JsError::new("Configuration not loaded"))?;
        let config_enable_css_selector = config
          .get_config_value_bool("enableCSSSelector")
          .map_err(|e| JsError::new(&e))?;
        let is_lazy_component_template = config
          .get_config_value_bool("isLazy")
          .map_err(|e| JsError::new(&e))?;
        let entry_name = match is_lazy_component_template {
          true => Some(template.entry_name.clone()),
          false => None,
        };
        let decoded_style_info =
          DecodedStyleInfo::new(raw_style_info, entry_name, config_enable_css_selector);
        template.style_info = Some(decoded_style_info);
        Ok(())
      },
    )
  }

  #[wasm_bindgen(js_name = setLepusCode)]
  pub fn set_lepus_code(
    &mut self,
    template_url: String,
    code_section_buf: js_sys::Uint8Array,
  ) -> Result<(), JsError> {
    self.decode_and_set(
      template_url,
      code_section_buf,
      |template, code_section: CodeSection| {
        let config = template
          .configuration
          .as_ref()
          .ok_or_else(|| JsError::new("Configuration not loaded"))?;
        let is_lazy_component_template = config
          .get_config_value_bool("isLazy")
          .map_err(|e| JsError::new(&e))?;
        let template_url = template.template_url.clone();
        let lepus_code = decode_lepus_code(code_section, is_lazy_component_template, &template_url);
        template.lepus_code = Some(lepus_code);
        Ok(())
      },
    )
  }

  #[wasm_bindgen(js_name = getMainThreadCodeUrls)]
  pub fn get_main_thread_code_urls(&self, template_url: String) -> Result<js_sys::Object, JsError> {
    let template = self
      .cache
      .get(&template_url)
      .ok_or_else(|| JsError::new("Template not found"))?;
    Ok(
      template
        .lepus_code
        .as_ref()
        .ok_or_else(|| JsError::new("Lepus code not set"))?
        .clone(),
    )
  }

  #[wasm_bindgen(js_name = setBackgroundCode)]
  pub fn set_background_code(
    &mut self,
    template_url: String,
    code_section_buf: js_sys::Uint8Array,
  ) -> Result<(), JsError> {
    self.decode_and_set(
      template_url,
      code_section_buf,
      |template, code_section: CodeSection| {
        template.background_code_urls = Some(decode_code_section_for_background(code_section));
        Ok(())
      },
    )
  }

  #[wasm_bindgen(js_name = getBackgroundCodeUrls)]
  pub fn get_background_code_urls(&self, template_url: String) -> Result<js_sys::Object, JsError> {
    let template = self
      .cache
      .get(&template_url)
      .ok_or_else(|| JsError::new("Template not found"))?;
    Ok(
      template
        .background_code_urls
        .as_ref()
        .ok_or_else(|| JsError::new("Background code URLs not set"))?
        .clone(),
    )
  }

  #[wasm_bindgen(js_name = setElementTemplateSection)]
  pub fn set_element_template_section(
    &mut self,
    template_url: String,
    element_template_section_buf: js_sys::Uint8Array,
  ) -> Result<(), JsError> {
    self.decode_and_set(
      template_url,
      element_template_section_buf,
      |template, element_template_section: ElementTemplateSection| {
        template.element_templates = Some(element_template_section);
        Ok(())
      },
    )
  }

  #[wasm_bindgen(js_name = setCustomSection)]
  pub fn set_custom_sections(
    &mut self,
    template_url: String,
    custom_sections: js_sys::Object,
  ) -> Result<(), JsError> {
    let template = self
      .cache
      .get_mut(&template_url)
      .ok_or_else(|| JsError::new("Template not found"))?;
    template.custom_sections = Some(custom_sections);
    Ok(())
  }

  #[wasm_bindgen(js_name = getCustomSection)]
  pub fn get_custom_section(&self, template_url: String) -> Result<js_sys::Object, JsError> {
    let template = self
      .cache
      .get(&template_url)
      .ok_or_else(|| JsError::new("Template not found"))?;
    Ok(
      template
        .custom_sections
        .as_ref()
        .ok_or_else(|| JsError::new("Custom sections not set"))?
        .clone(),
    )
  }

  #[wasm_bindgen(js_name = removeTemplate)]
  pub fn remove_template(&mut self, template_url: String) {
    self.cache.remove(&template_url);
  }
}
