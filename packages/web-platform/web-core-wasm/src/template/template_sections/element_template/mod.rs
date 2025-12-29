/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

// mod decoded_element_template;
mod raw_element_template;
use bincode::Decode;
#[cfg(feature = "encode")]
use bincode::Encode;
use fnv::FnvHashMap;
pub(crate) use raw_element_template::RawElementTemplate;
use wasm_bindgen::prelude::*;
#[derive(Decode, Default)]
#[cfg_attr(feature = "encode", derive(Encode))]
#[wasm_bindgen]
pub struct ElementTemplateSection {
  pub(crate) element_templates_map: FnvHashMap<String, RawElementTemplate>,
}

#[wasm_bindgen]
impl ElementTemplateSection {
  #[cfg(feature = "encode")]
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    ElementTemplateSection::default()
  }

  #[wasm_bindgen]
  pub fn from_encoded(
    buffer: js_sys::Uint8Array,
  ) -> Result<ElementTemplateSection, wasm_bindgen::JsError> {
    let (data, _) = bincode::decode_from_slice::<ElementTemplateSection, _>(
      &buffer.to_vec(),
      bincode::config::standard(),
    )
    .map_err(|e| {
      wasm_bindgen::JsError::new(&format!(
        "Failed to decode ElementTemplateSection from Uint8Array: {e}",
      ))
    })?;
    Ok(data)
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn add_element_template(&mut self, id: String, raw_element_template: RawElementTemplate) {
    self.element_templates_map.insert(id, raw_element_template);
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn encode(&self) -> js_sys::Uint8Array {
    js_sys::Uint8Array::from(
      bincode::encode_to_vec(self, bincode::config::standard())
        .unwrap()
        .as_slice(),
    )
  }
}
