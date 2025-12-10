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

#[derive(Default, Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
#[cfg_attr(feature = "encode", wasm_bindgen)]
pub(crate) struct Configurations {
  config_data: FnvHashMap<String, String>,
}

impl Configurations {
  pub(crate) fn get_config_value_bool(&self, key: &str) -> Result<bool, String> {
    match self
      .config_data
      .get(key)
      .ok_or_else(|| format!("Key '{key}' not found in Configuration"))?
      .as_str()
    {
      "true" => Ok(true),
      "false" => Ok(false),
      _ => Err(format!("Invalid value for boolean config key '{key}'")),
    }
  }
}

#[cfg(feature = "encode")]
#[wasm_bindgen]
impl Configurations {
  #[cfg(feature = "encode")]
  #[wasm_bindgen(constructor)]
  pub fn new() -> Self {
    Configurations::default()
  }

  #[cfg(feature = "encode")]
  #[wasm_bindgen]
  pub fn add_config(&mut self, key: String, value: String) {
    self.config_data.insert(key, value);
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
