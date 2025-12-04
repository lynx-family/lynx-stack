/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use fnv::FnvHashMap;
use serde::Deserialize;
#[cfg(feature = "encode")]
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[cfg_attr(feature = "encode", wasm_bindgen)]
pub(crate) struct CodeSection {
  code_map: FnvHashMap<String, String>,
}

#[cfg(feature = "encode")]
#[wasm_bindgen]
impl CodeSection {
  #[cfg(feature = "encode")]
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    CodeSection {
      code_map: FnvHashMap::default(),
    }
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn add_code(&mut self, id: String, code: String) {
    self.code_map.insert(id, code);
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn encode(&self) -> js_sys::Uint8Array {
    js_sys::Uint8Array::from(
      bincode::serde::encode_to_vec(self, bincode::config::standard())
        .unwrap()
        .as_slice(),
    )
  }
}

#[cfg(feature = "client")]
pub(crate) struct LepusCode {
  pub(crate) code_url_map: FnvHashMap<String, String>,
}

#[cfg(feature = "client")]
impl LepusCode {
  pub(crate) fn new(
    code_section: CodeSection,
    is_lazy_component_template: bool,
    template_url: &str,
  ) -> Self {
    let code_map = code_section.code_map;
    LepusCode {
      code_url_map: code_map.into_iter().map(|(key, code)| {
        let lepus_content =
          format!(
          "(function(){{ \"use strict\"; const {}=void 0; {} {code} \n }})()\n//# sourceURL={}\n//# allFunctionsCalledOnLoad",
          (["navigator", "postMessage", "window"]).join("=void 0,"),
          match is_lazy_component_template {
            true => "module.exports=",
            false => "",
          },
          template_url
        );
        let lepus_code_array_buffer: js_sys::Uint8Array = js_sys::Uint8Array::new_from_slice(lepus_content.as_bytes());
        let blob_option = web_sys::BlobPropertyBag::new();
        blob_option.set_type("text/javascript; charset=utf-8");
        let blob = web_sys::Blob::new_with_u8_array_sequence_and_options(
          &js_sys::Array::of1(&lepus_code_array_buffer),
          &blob_option,
        ).unwrap();
        let url = web_sys::Url::create_object_url_with_blob(&blob).unwrap();
        (key, url)
      }).collect::<FnvHashMap<String, String>>()
    }
  }
}

#[cfg(feature = "client")]
pub fn decode_code_section_for_background(code_section_data: js_sys::Uint8Array) -> js_sys::Object {
  let (code_section, _) = bincode::serde::decode_from_slice::<CodeSection, _>(
    &code_section_data.to_vec(),
    bincode::config::standard(),
  )
  .unwrap();
  js_sys::Object::from_entries(
    &code_section
      .code_map
      .into_iter()
      .map(|(k, v)| {
        let key = js_sys::JsString::from(k);
        let value = js_sys::Uint8Array::from(v.as_bytes());
        let blob_option = web_sys::BlobPropertyBag::new();
        blob_option.set_type("text/javascript; charset=utf-8");
        let blob = web_sys::Blob::new_with_u8_array_sequence_and_options(
          &js_sys::Array::of1(&value),
          &blob_option,
        )
        .unwrap();
        let url = web_sys::Url::create_object_url_with_blob(&blob).unwrap();
        js_sys::Array::of2(&key, &url.into())
      })
      .collect::<js_sys::Array>(),
  )
  .unwrap()
}
