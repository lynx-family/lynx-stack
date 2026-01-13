/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::raw_style_info::RawStyleInfo;
use super::style_info_decoder::StyleInfoDecoder;
use bincode::{Decode, Encode};
use wasm_bindgen::prelude::*;

#[derive(Encode, Decode)]
pub struct DecodedStyleData {
  pub(super) style_content: Option<String>,
  // the font face should be placed at the head of the css content, therefore we use a separate buffer
  pub(super) font_face_content: Option<String>,
  // if we are processing font_face, the declaration should be pushed to font_face_content for generating
  pub(super) css_og_css_id_to_class_selector_name_to_declarations_map:
    Option<super::CssOgCssIdToClassSelectorNameToDeclarationsMap>,
}

impl From<StyleInfoDecoder> for DecodedStyleData {
  fn from(decoder: StyleInfoDecoder) -> Self {
    DecodedStyleData {
      style_content: Some(decoder.style_content),
      font_face_content: Some(decoder.font_face_content),
      css_og_css_id_to_class_selector_name_to_declarations_map: decoder
        .css_og_css_id_to_class_selector_name_to_declarations_map,
    }
  }
}

impl TryFrom<js_sys::Uint8Array> for DecodedStyleData {
  type Error = bincode::error::DecodeError;
  fn try_from(buffer: js_sys::Uint8Array) -> Result<DecodedStyleData, Self::Error> {
    let (data, _) = bincode::decode_from_slice::<DecodedStyleData, _>(
      &buffer.to_vec(),
      bincode::config::standard(),
    )?;
    Ok(data)
  }
}

#[wasm_bindgen]
pub fn decode_style_info(
  buffer: js_sys::Uint8Array,
  entry_name: Option<String>,
  config_enable_css_selector: bool,
) -> Result<js_sys::Uint8Array, wasm_bindgen::JsError> {
  let (data, _) =
    bincode::decode_from_slice::<RawStyleInfo, _>(&buffer.to_vec(), bincode::config::standard())
      .map_err(|e| {
        wasm_bindgen::JsError::new(&format!("Failed to decode from Uint8Array: {e}",))
      })?;
  let decode_data: DecodedStyleData =
    StyleInfoDecoder::new(data, entry_name, config_enable_css_selector)?.into();
  Ok(js_sys::Uint8Array::from(
    bincode::encode_to_vec(&decode_data, bincode::config::standard())
      .map_err(|e| wasm_bindgen::JsError::new(&format!("Failed to encode to Uint8Array: {e}",)))?
      .as_slice(),
  ))
}

#[wasm_bindgen]
pub fn encode_legacy_json_generated_raw_style_info(
  raw_style_info: RawStyleInfo,
  config_enable_css_selector: bool,
  entry_name: Option<String>,
) -> Result<js_sys::Uint8Array, wasm_bindgen::JsError> {
  let decode_data: DecodedStyleData =
    StyleInfoDecoder::new(raw_style_info, entry_name, config_enable_css_selector)?.into();
  let data = &bincode::encode_to_vec(&decode_data, bincode::config::standard())
    .map_err(|e| wasm_bindgen::JsError::new(&format!("Failed to encode to Uint8Array: {e}",)))?;
  Ok(js_sys::Uint8Array::from(data.as_slice()))
}

#[wasm_bindgen]
pub fn get_style_content(buffer: js_sys::Uint8Array) -> Result<String, wasm_bindgen::JsError> {
  let decode_data = DecodedStyleData::try_from(buffer)
    .map_err(|e| wasm_bindgen::JsError::new(&format!("Failed to decode from Uint8Array: {e}",)))?;
  Ok(decode_data.style_content.unwrap_or_default())
}

#[wasm_bindgen]
pub fn get_font_face_content(buffer: js_sys::Uint8Array) -> Result<String, wasm_bindgen::JsError> {
  let decode_data = DecodedStyleData::try_from(buffer)
    .map_err(|e| wasm_bindgen::JsError::new(&format!("Failed to decode from Uint8Array: {e}",)))?;
  Ok(decode_data.font_face_content.unwrap_or_default())
}
