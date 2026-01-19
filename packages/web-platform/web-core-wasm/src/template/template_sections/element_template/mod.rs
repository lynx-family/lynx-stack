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
pub use raw_element_template::RawElementTemplate;
#[cfg(feature = "encode")]
use wasm_bindgen::prelude::*;
#[derive(Decode, Default)]
#[cfg_attr(feature = "encode", derive(Encode))]
#[cfg_attr(feature = "encode", wasm_bindgen)]
pub struct ElementTemplateSection {
  #[cfg_attr(feature = "encode", wasm_bindgen(skip))]
  pub element_templates_map: FnvHashMap<String, RawElementTemplate>,
}

#[cfg(feature = "encode")]
#[wasm_bindgen]
impl ElementTemplateSection {
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    ElementTemplateSection::default()
  }

  #[wasm_bindgen]
  pub fn add_element_template(&mut self, id: String, raw_element_template: RawElementTemplate) {
    self.element_templates_map.insert(id, raw_element_template);
  }

  #[wasm_bindgen]
  pub fn encode(&self) -> js_sys::Uint8Array {
    js_sys::Uint8Array::from(
      bincode::encode_to_vec(self, bincode::config::standard())
        .unwrap()
        .as_slice(),
    )
  }
}

impl TryFrom<js_sys::Uint8Array> for ElementTemplateSection {
  fn try_from(buffer: js_sys::Uint8Array) -> Result<ElementTemplateSection, Self::Error> {
    let (data, _) = bincode::decode_from_slice::<ElementTemplateSection, _>(
      &buffer.to_vec(),
      bincode::config::standard(),
    )?;
    Ok(data)
  }
  type Error = bincode::error::DecodeError;
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::template::template_sections::element_template::RawElementTemplate;
  use wasm_bindgen_test::*;

  wasm_bindgen_test_configure!(run_in_node_experimental);

  #[wasm_bindgen_test]
  fn test_element_template_roundtrip() {
    let mut section = ElementTemplateSection::new();
    for index in 0..6 {
      let mut template = RawElementTemplate::new();
      let root_id = 1;
      template.create_element("view".to_string(), root_id);
      template.set_attribute(root_id, "class".to_string(), format!("root-{index}"));
      template.set_dataset(root_id, "idx".to_string(), index.to_string());
      template.set_cross_thread_event(
        root_id,
        "tap".to_string(),
        format!("rootTap{index}"),
        "true".to_string(),
      );

      let mut child_id = 2;
      for child_index in 0..8 {
        template.create_element("text".to_string(), child_id);
        template.set_attribute(
          child_id,
          "data-child".to_string(),
          format!("{index}-{child_index}"),
        );
        template.append_child(root_id, child_id);
        child_id += 1;
      }
      template.append_to_root(root_id);
      section.add_element_template(format!("template-{index}"), template);
    }
    let bytes = section.encode();

    // decode
    let decoded_section =
      ElementTemplateSection::try_from(bytes).expect("Should decode successfully");

    // verify
    assert_eq!(decoded_section.element_templates_map.len(), 6);
    assert!(decoded_section
      .element_templates_map
      .contains_key("template-0"));
    assert!(decoded_section
      .element_templates_map
      .contains_key("template-5"));
  }
}
