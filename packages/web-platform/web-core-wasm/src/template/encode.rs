// use super::CURRENT_VERSION;
// use super::{decode_legacy_json::JSONRawTemplate, raw_template::LynxRawTemplate};
// #[cfg(feature = "encode")]
// use wasm_bindgen::prelude::*;

// #[cfg(feature = "encode")]
// #[wasm_bindgen]
// pub fn encode_template(json_template: &wasm_bindgen::JsValue) -> js_sys::Uint8Array {
//   let json_template =
//     serde_wasm_bindgen::from_value::<JSONRawTemplate>(json_template.clone()).unwrap();
//   let lynx_template: LynxRawTemplate = json_template.into();
//   let mut data = CURRENT_VERSION.to_le_bytes().to_vec();
//   data.extend(bincode::serde::encode_to_vec(&lynx_template, bincode::config::standard()).unwrap());
//   js_sys::Uint8Array::from(data.as_slice())
// }
