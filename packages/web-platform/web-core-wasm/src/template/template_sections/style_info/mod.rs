mod decoded_style_info;
mod flattened_style_info;
mod raw_style_info;
use bincode::{Decode, Encode};
use decoded_style_info::StyleInfoDecoder;
use fnv::FnvHashMap;
use raw_style_info::RawStyleInfo;
use wasm_bindgen::prelude::*;

type CssOgClassSelectorNameToDeclarationsMap = FnvHashMap<String, String>;
type CssOgCssIdToClassSelectorNameToDeclarationsMap =
  FnvHashMap<i32, CssOgClassSelectorNameToDeclarationsMap>;

#[cfg(test)]
use raw_style_info::*;

#[derive(Encode, Decode)]
#[wasm_bindgen]
pub struct DecodedStyleData {
  pub(crate) style_content: Option<String>,
  // the font face should be placed at the head of the css content, therefore we use a separate buffer
  pub(crate) font_face_content: Option<String>,
  // if we are processing font_face, the declaration should be pushed to font_face_content for generating
  css_og_css_id_to_class_selector_name_to_declarations_map:
    Option<CssOgCssIdToClassSelectorNameToDeclarationsMap>,
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

#[wasm_bindgen]
impl DecodedStyleData {
  #[wasm_bindgen(constructor)]
  pub fn new(buffer: js_sys::Uint8Array) -> Result<DecodedStyleData, wasm_bindgen::JsError> {
    let (data, _) = bincode::decode_from_slice::<DecodedStyleData, _>(
      &buffer.to_vec(),
      bincode::config::standard(),
    )
    .map_err(|e| wasm_bindgen::JsError::new(&format!("Failed to decode from Uint8Array: {e}",)))?;
    Ok(data)
  }

  #[wasm_bindgen(getter)]
  pub fn style_content(&mut self) -> String {
    self.style_content.take().unwrap()
  }

  #[wasm_bindgen(getter)]
  pub fn font_face_content(&mut self) -> String {
    self.font_face_content.take().unwrap()
  }

  #[wasm_bindgen]
  pub fn query_css_og_declarations_by_css_id(
    &self,
    css_id: i32,
    class_name: Vec<String>,
  ) -> String {
    let mut result = String::new();
    if let Some(map) = &self.css_og_css_id_to_class_selector_name_to_declarations_map {
      if let Some(class_selector_map) = map.get(&css_id) {
        for class_name in class_name.iter() {
          if let Some(declarations) = class_selector_map.get(class_name) {
            result.push_str(declarations);
          }
        }
      }
    }
    result
  }

  #[wasm_bindgen]
  pub fn decode_into(
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
    let data = &bincode::encode_to_vec(&decode_data, bincode::config::standard())
      .map_err(|e| wasm_bindgen::JsError::new(&format!("Failed to encode to Uint8Array: {e}",)))?;
    Ok(js_sys::Uint8Array::from(data.as_slice()))
  }
}
