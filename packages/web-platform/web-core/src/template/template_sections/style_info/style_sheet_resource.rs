/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::decoded_style_data::DecodedStyleData;
use super::raw_style_info::RawStyleInfo;
use super::style_info_decoder::StyleInfoDecoder;
use std::rc::Rc;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[derive(Clone)]
pub struct StyleSheetResource {
  #[cfg(feature = "client")]
  pub(crate) style_content_element: Option<web_sys::Element>,
  #[cfg(feature = "client")]
  pub(crate) font_face_element: Option<web_sys::Element>,

  #[cfg(feature = "server")]
  pub(crate) style_content_str: Option<String>,
  #[cfg(feature = "server")]
  pub(crate) font_face_content_str: Option<String>,

  pub(crate) css_og_css_id_to_class_selector_name_to_declarations_map:
    Option<Rc<super::CssOgCssIdToClassSelectorNameToDeclarationsMap>>,
}

#[wasm_bindgen]
impl StyleSheetResource {
  /// Builds a resource from an rkyv-encoded [`DecodedStyleData`].
  ///
  /// This is the bundle path's entry point: the decode worker produces those
  /// bytes and they cross `postMessage` to get here, because a wasm object
  /// cannot be structured-cloned.
  #[wasm_bindgen(constructor)]
  pub fn new(
    buffer: js_sys::Uint8Array,
    _document: JsValue,
  ) -> Result<StyleSheetResource, wasm_bindgen::JsError> {
    let decoded_style_data: DecodedStyleData = buffer.try_into()?;
    Self::from_decoded_style_data(decoded_style_data, _document)
  }

  /// Builds a resource straight from a [`RawStyleInfo`], with no rkyv step.
  ///
  /// The bundle path pays for two rkyv passes over the style data: the decode
  /// worker serialises the [`DecodedStyleData`] it just produced
  /// (`encode_legacy_json_generated_raw_style_info`) only so that the bytes can
  /// cross into the main thread, which immediately deserialises them again in
  /// [`StyleSheetResource::new`]. Neither pass carries information - they exist
  /// solely because the two halves live in different wasm instances.
  ///
  /// A caller already running on the main thread, in the same instance that will
  /// own the resource, has no such boundary to cross. It can hand the
  /// `RawStyleInfo` over directly and skip both passes. That is what this entry
  /// is for: the buildless markup path builds its `RawStyleInfo` on the main
  /// thread and never produces bundle bytes at all.
  ///
  /// Equivalence with the bundle path is structural rather than asserted: both
  /// run the same [`StyleInfoDecoder`] over the same input and then the same
  /// [`Self::from_decoded_style_data`]. The only difference is whether the
  /// `DecodedStyleData` in between is round-tripped through rkyv or handed over
  /// in memory.
  ///
  /// Deliberately a new entry point rather than a change to
  /// `encode_legacy_json_generated_raw_style_info`, which every ReactLynx card's
  /// JSON artifact goes through and whose behaviour must not move.
  #[wasm_bindgen(js_name = fromRawStyleInfo)]
  pub fn from_raw_style_info(
    raw_style_info: RawStyleInfo,
    _document: JsValue,
    config_enable_css_selector: bool,
    entry_name: Option<String>,
    transform_vw: bool,
    transform_vh: bool,
    transform_rem: bool,
  ) -> Result<StyleSheetResource, wasm_bindgen::JsError> {
    let decoded_style_data: DecodedStyleData = StyleInfoDecoder::new(
      raw_style_info,
      entry_name,
      config_enable_css_selector,
      transform_vw,
      transform_vh,
      transform_rem,
    )?
    .into();
    Self::from_decoded_style_data(decoded_style_data, _document)
  }
}

impl StyleSheetResource {
  /// The half both entry points share, so that neither can drift from the other.
  fn from_decoded_style_data(
    decoded_style_data: DecodedStyleData,
    _document: JsValue,
  ) -> Result<StyleSheetResource, wasm_bindgen::JsError> {
    #[cfg(feature = "client")]
    let (style_content_element, font_face_element) = {
      let document = _document.unchecked_into::<web_sys::Document>();
      let style_content_element = if let Some(style_content) = &decoded_style_data.style_content {
        let style_content_element = document.create_element("style").map_err(|e| {
          wasm_bindgen::JsError::new(&format!("Failed to create style element: {e:?}"))
        })?;
        style_content_element.set_text_content(Some(style_content));
        Some(style_content_element)
      } else {
        None
      };
      let font_face_element = if let Some(font_face_content) = &decoded_style_data.font_face_content
      {
        let style_content_element = document.create_element("style").map_err(|e| {
          wasm_bindgen::JsError::new(&format!("Failed to create style element: {e:?}"))
        })?;
        style_content_element.set_text_content(Some(font_face_content));
        Some(style_content_element)
      } else {
        None
      };
      (style_content_element, font_face_element)
    };

    #[cfg(feature = "server")]
    let (style_content_str, font_face_content_str) = (
      decoded_style_data.style_content.clone(),
      decoded_style_data.font_face_content.clone(),
    );

    Ok(Self {
      #[cfg(feature = "client")]
      style_content_element,
      #[cfg(feature = "client")]
      font_face_element,
      #[cfg(feature = "server")]
      style_content_str,
      #[cfg(feature = "server")]
      font_face_content_str,
      css_og_css_id_to_class_selector_name_to_declarations_map: decoded_style_data
        .css_og_css_id_to_class_selector_name_to_declarations_map
        .map(Rc::new),
    })
  }
}

impl StyleSheetResource {
  pub(crate) fn query_css_og_declarations_by_css_id(
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
}
