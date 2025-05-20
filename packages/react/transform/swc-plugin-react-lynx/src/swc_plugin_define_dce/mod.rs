use std::{collections::HashMap, fmt::Debug};
use serde::Deserialize;

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct DefineDCEVisitorConfig {
  /// @public
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
