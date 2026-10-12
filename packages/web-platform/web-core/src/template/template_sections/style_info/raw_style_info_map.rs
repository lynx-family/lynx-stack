/*
 * Copyright 2026 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use super::raw_style_info::RawStyleInfo;
use fnv::FnvHashMap;
#[cfg(feature = "encode")]
use rkyv::Serialize;
use rkyv::{Archive, Deserialize};
use wasm_bindgen::prelude::*;

/**
 * The style sheets carried by the custom sections of a template.
 * Each custom section whose encoding is `CSS` is keyed by its section name.
 */
#[derive(Clone, Default, Archive, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[wasm_bindgen]
pub struct RawStyleInfoMap {
  pub(super) name_to_style_info: FnvHashMap<String, RawStyleInfo>,
}

#[wasm_bindgen]
impl RawStyleInfoMap {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    Self::default()
  }

  /**
   * Sets the style info of the custom section identified by `name`.
   * An existing style info with the same name is replaced.
   * @param name - The name of the custom section.
   * @param style_info - The style info of the custom section.
   */
  pub fn insert(&mut self, name: String, style_info: RawStyleInfo) {
    self.name_to_style_info.insert(name, style_info);
  }

  /**
   * Encodes the RawStyleInfoMap into a Uint8Array using rkyv serialization.
   * @returns A Uint8Array containing the serialized RawStyleInfoMap.
   */
  #[cfg(feature = "encode")]
  pub fn encode(&mut self) -> Result<js_sys::Uint8Array, JsError> {
    for style_info in self.name_to_style_info.values_mut() {
      style_info.update_style_content_str_size_hint()?;
    }
    let serialized = rkyv::to_bytes::<_, 1024>(self)
      .map_err(|e| JsError::new(&format!("Failed to encode RawStyleInfoMap: {e:?}")))?;
    Ok(js_sys::Uint8Array::from(serialized.as_slice()))
  }
}

#[cfg(all(test, feature = "encode"))]
mod tests {
  use super::super::raw_style_info::{Rule, RulePrelude, Selector};
  use super::super::style_info_decoder::StyleInfoDecoder;
  use super::*;
  use wasm_bindgen_test::*;

  fn build_style_info(class_name: &str, value: &str) -> RawStyleInfo {
    let mut raw = RawStyleInfo::new();
    let mut rule = Rule::new("StyleRule".to_string()).expect("rule should build");
    let mut selector = Selector::new();
    selector
      .push_one_selector_section("ClassSelector".to_string(), class_name.to_string())
      .expect("selector section should build");
    let mut prelude = RulePrelude::new();
    prelude.push_selector(selector);
    rule.set_prelude(prelude);
    rule.push_declaration("background-color".to_string(), value.to_string());
    raw.push_rule(0, rule);
    raw
  }

  #[wasm_bindgen_test]
  fn test_raw_style_info_map_roundtrip() {
    let mut map = RawStyleInfoMap::new();
    map.insert("foo".to_string(), build_style_info("foo", "red"));
    map.insert("bar".to_string(), build_style_info("bar", "green"));
    // the later one wins
    map.insert("foo".to_string(), build_style_info("foo", "blue"));

    let bytes = map.encode().expect("Should encode");
    let mut buf = vec![0u8; bytes.length() as usize];
    bytes.copy_to(&mut buf);
    let mut decoded = unsafe { rkyv::from_bytes_unchecked::<RawStyleInfoMap>(&buf) }
      .expect("RawStyleInfoMap decode should succeed");

    assert_eq!(decoded.name_to_style_info.len(), 2);
    for (name, value) in [("foo", "blue"), ("bar", "green")] {
      let style_info = decoded
        .name_to_style_info
        .remove(name)
        .expect("section should exist");
      assert!(style_info.style_content_str_size_hint > 0);
      let style_content = StyleInfoDecoder::new(style_info, None, true, false, false, false)
        .expect("StyleInfoDecoder should succeed")
        .style_content;
      assert!(style_content.contains(&format!(".{name}")));
      assert!(style_content.contains(&format!("background-color:{value};")));
    }
  }
}
