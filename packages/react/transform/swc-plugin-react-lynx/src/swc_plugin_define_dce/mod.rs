use std::{collections::HashMap, fmt::Debug};

use serde::Deserialize;
use ts_rs::TS;

#[derive(TS, Deserialize, Clone, Debug, PartialEq)]
#[ts(export, export_to = "index.d.ts")]
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
