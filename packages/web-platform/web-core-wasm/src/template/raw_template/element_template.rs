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
  type_name: String,
  id_selector: Option<String>,
  class: Option<Vec<String>>,
  attributes: Option<HashMap<String, String>>,
  built_in_attributes: Option<HashMap<String, String>>,
  children: Option<Vec<ElementTemplate>>,
  events: Option<Vec<LynxCrossThreadEventRegistration>>,
  dataset: Option<HashMap<String, String>>,
}
