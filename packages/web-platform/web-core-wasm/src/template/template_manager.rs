use wasm_bindgen::JsCast;

use super::{DecodedTemplate, LynxTemplate};
use std::collections::HashMap;
#[derive(Default)]
pub struct TemplateManager {
  /**
   * key: template_url
   * value: DecodedTemplate
   */
  cache: HashMap<String, DecodedTemplate>,
}

impl TemplateManager {
  pub(crate) fn new() -> Self {
    TemplateManager {
      cache: HashMap::new(),
    }
  }

  pub(crate) fn get_decoded_template_by_url(
    &self,
    template_url: &String,
  ) -> Option<&DecodedTemplate> {
    self.cache.get(template_url)
  }

  pub(crate) async fn load_template(
    &mut self,
    template_url: &String,
    custom_template_loader: &js_sys::Function,
  ) -> Result<&DecodedTemplate, wasm_bindgen::JsValue> {
    if self.cache.contains_key(template_url) {
      return Ok(self.cache.get(template_url).unwrap());
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
    let lynx_template: LynxTemplate = LynxTemplate::from(&buffer_value);
    let decoded_template: DecodedTemplate = lynx_template.into();
    self.cache.insert(template_url.clone(), decoded_template);
    Ok(self.cache.get(template_url).unwrap())
  }

  pub(crate) fn get_cached_template(&self, template_url: &String) -> Option<&DecodedTemplate> {
    self.cache.get(template_url)
  }
}
