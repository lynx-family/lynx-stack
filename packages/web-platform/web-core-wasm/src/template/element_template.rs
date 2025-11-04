use crate::main_thread::LynxCrossThreadEventRegistration;
use std::collections::HashMap;

pub struct ElementTemplate {
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

impl ElementTemplate {
  // pub(crate) fn hydrate_to_element(
  //   document: &web_sys::Document,

  // )
}
