/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
use bincode::Decode;
#[cfg(feature = "encode")]
use bincode::Encode;
#[cfg(feature = "encode")]
use wasm_bindgen::prelude::*;

#[cfg_attr(feature = "encode", wasm_bindgen, derive(Encode))]
#[derive(Decode)]
pub struct Operation {
  pub(crate) opcode: LEOAsmOpcode,
  pub(crate) operands_num: Vec<i32>,
  pub(crate) operands_str: Vec<String>,
}

#[cfg_attr(feature = "encode", wasm_bindgen, derive(Encode))]
#[derive(Decode)]
pub enum LEOAsmOpcode {
  SetAttribute = 1,
  RemoveChild = 3,
  AppendChild = 5,
  CreateElement = 6,
  SetAttributeSlot = 7,
  AppendElementSlot = 8,
  SetDataset = 10,
  AddEvent = 11,
  AppendToRoot = 12,
}
