use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Deserialize, Serialize)]
pub(crate) struct LynxCrossThreadEventRegistration {
  pub event_type: String,
  pub event_name: String,
  pub event_value: String,
}
#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct ElementTemplate {
  /**
   * tag name
   */
  pub(crate) type_name: String,
  pub(crate) id_selector: Option<String>,
  pub(crate) class: Option<Vec<String>>,
  pub(crate) attributes: Option<HashMap<String, String>>,
  pub(crate) built_in_attributes: Option<HashMap<String, String>>,
  pub(crate) children: Option<Vec<ElementTemplate>>,
  pub(crate) events: Option<Vec<LynxCrossThreadEventRegistration>>,
  pub(crate) dataset: Option<HashMap<String, String>>,
}
