mod decoded_style_info;
mod flattened_style_info;
mod raw_style_info;
pub(crate) use decoded_style_info::DecodedStyleInfo;
pub(crate) use raw_style_info::RawStyleInfo;
#[cfg(test)]
use raw_style_info::*;
use wasm_bindgen::prelude::wasm_bindgen;

#[cfg(feature = "encode")]
#[wasm_bindgen] // for testing purpose
pub fn get_decoded_style_string(
  raw_style_info: js_sys::Uint8Array,
  entry_name: Option<String>,
  config_enable_css_selector: bool,
) -> String {
  let (raw_style_info, _) = bincode::serde::decode_from_slice::<RawStyleInfo, _>(
    &raw_style_info.to_vec(),
    bincode::config::standard(),
  )
  .expect("Failed to decode RawStyleInfo from Uint8Array");
  DecodedStyleInfo::new(raw_style_info, entry_name, config_enable_css_selector).style_content
}

#[cfg(feature = "encode")]
#[wasm_bindgen] // for testing purpose
pub fn get_decoded_font_family_string(
  raw_style_info: js_sys::Uint8Array,
  entry_name: Option<String>,
  config_enable_css_selector: bool,
  config_remove_css_scope: bool,
) -> String {
  let (raw_style_info, _) = bincode::serde::decode_from_slice::<RawStyleInfo, _>(
    &raw_style_info.to_vec(),
    bincode::config::standard(),
  )
  .expect("Failed to decode RawStyleInfo from Uint8Array");
  DecodedStyleInfo::new(raw_style_info, entry_name, config_enable_css_selector).font_face_content
}
