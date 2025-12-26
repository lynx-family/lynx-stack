/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

#[cfg(feature = "encode")]
use crate::leo_asm::LEOAsmOpcode;
use crate::leo_asm::Operation;
use bincode::Decode;
#[cfg(feature = "encode")]
use bincode::Encode;
use fnv::FnvHashSet;
#[cfg(feature = "encode")]
use wasm_bindgen::prelude::*;

#[cfg_attr(feature = "encode", wasm_bindgen)]
#[cfg_attr(feature = "encode", derive(Encode, Default))]
#[derive(Decode)]
pub struct RawElementTemplate {
  pub(crate) operations: Vec<Operation>,
  pub(crate) tag_names: FnvHashSet<String>,
}

#[cfg_attr(feature = "encode", wasm_bindgen)]
impl RawElementTemplate {
  #[cfg(feature = "encode")]
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    RawElementTemplate::default()
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn append_to_root(&mut self, element_id: i32) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::AppendToRoot, // APPEND_TO_ROOT
      operands_num: vec![element_id],
      operands_str: vec![],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn create_element(&mut self, tag_names: String, element_id: i32) {
    self.tag_names.insert(tag_names.clone());
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::CreateElement, // CREATE_ELEMENT
      operands_num: vec![element_id],
      operands_str: vec![tag_names],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn set_attribute(&mut self, element_id: i32, attr_name: String, attr_value: String) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::SetAttribute, // SET_ATTRIBUTE
      operands_num: vec![element_id],
      operands_str: vec![attr_name, attr_value],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn set_dataset(&mut self, element_id: i32, data_name: String, data_value: String) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::SetDataset, // SET_DATASET
      operands_num: vec![element_id],
      operands_str: vec![data_name, data_value],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn append_child(&mut self, parent_element_id: i32, child_element_id: i32) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::AppendChild, // APPEND_CHILD
      operands_num: vec![parent_element_id, child_element_id],
      operands_str: vec![],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn set_cross_thread_event(
    &mut self,
    element_id: i32,
    event_type: String,
    event_name: String,
    event_value: String,
  ) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::AddEvent, // SET_CROSS_THREAD_EVENT
      operands_num: vec![element_id],
      operands_str: vec![event_type, event_name, event_value],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn set_attribute_slot(&mut self, element_id: i32, attribute_slot_id: i32, attr_name: String) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::SetAttributeSlot,
      operands_num: vec![element_id, attribute_slot_id],
      operands_str: vec![attr_name],
    });
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn append_element_slot(&mut self, parent_element_id: i32, child_element_slot_id: i32) {
    self.operations.push(Operation {
      opcode: LEOAsmOpcode::AppendElementSlot,
      operands_num: vec![parent_element_id, child_element_slot_id],
      operands_str: vec![],
    });
  }
}
