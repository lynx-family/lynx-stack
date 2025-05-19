use std::{collections::HashMap, fmt::Debug};

use napi_derive::napi;

/// @internal
#[napi(object)]
#[derive(Clone, Debug)]
pub struct DefineDCEVisitorConfig {
  /// @internal
  pub define: HashMap<String, String>,
}

impl Default for DefineDCEVisitorConfig {
  fn default() -> Self {
    DefineDCEVisitorConfig {
      define: HashMap::from([
        ("__LEPUS__".into(), "true".into()),
        ("__JS__".into(), "false".into()),
      ]),
    }
  }
}
