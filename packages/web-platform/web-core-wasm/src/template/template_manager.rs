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
}

impl TemplateManager {
  pub(crate) fn get_cached_template(&self, template_url: &String) -> Option<DecodedTemplateImpl> {
    self.cache.get(template_url).cloned()
  }

  pub(crate) async fn load_template(
    &mut self,
    template_url: &String,
    custom_template_loader: &js_sys::Function,
  ) -> Result<DecodedTemplateImpl, wasm_bindgen::JsValue> {
    if self.cache.contains_key(template_url) {
      return Ok(self.cache.get(template_url).unwrap().clone());
    }
    let buffer_value: js_sys::Uint8Array = {
      if custom_template_loader.is_null_or_undefined() {
        let request = web_sys::Request::new_with_str(template_url).unwrap();
        request
          .headers()
          .set("Accept", "application/octet-stream")
          .unwrap();
        let window = web_sys::window().unwrap();
        let resp_value =
          wasm_bindgen_futures::JsFuture::from(window.fetch_with_request(&request)).await?;
        // `resp_value` is a `Response` object.
        assert!(resp_value.is_instance_of::<web_sys::Response>());

        let resp: web_sys::Response = resp_value.dyn_into().unwrap();
        let array_buffer: wasm_bindgen::JsValue =
          wasm_bindgen_futures::JsFuture::from(resp.array_buffer()?).await?;
        js_sys::Uint8Array::new(&array_buffer)
      } else {
        custom_template_loader
          .call1(
            &wasm_bindgen::JsValue::undefined(),
            &wasm_bindgen::JsValue::from_str(template_url),
          )?
          .dyn_into::<js_sys::Uint8Array>()?
      }
    };
    if self.cache.contains_key(template_url) {
      Ok(self.cache.get(template_url).unwrap().clone())
    } else {
      let lynx_template: LynxRawTemplate = LynxRawTemplate::from(&buffer_value);
      let decoded_template: DecodedTemplate = lynx_template.into();
      self.cache.insert(
        template_url.clone(),
        DecodedTemplateImpl::new(decoded_template),
      );
      Ok(self.cache.get(template_url).unwrap().clone())
    }
  }
}
