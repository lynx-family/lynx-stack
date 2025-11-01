// Copyright 2023 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use lazy_static::lazy_static;
use std::{
  collections::{HashMap, HashSet},
  hash::Hash,
};

pub const LYNX_UNIQUE_ID_ATTRIBUTE: &str = "l-uid";
pub const CSS_ID_ATTRIBUTE: &str = "l-css-id";
// pub const COMPONENT_ID_ATTRIBUTE: &str = "l-comp-id";
pub const LYNX_ENTRY_NAME_ATTRIBUTE: &str = "l-e-name";
pub const LYNX_TAG_ATTRIBUTE: &str = "lynx-tag";
// pub const LYNX_DATASET_ATTRIBUTE: &str = "l-dset";
// pub const LYNX_COMPONENT_CONFIG_ATTRIBUTE: &str = "l-comp-cfg";
pub const LYNX_ELEMENT_TEMPLATE_MARKER_ATTRIBUTE: &str = "l-template";
pub const LYNX_PART_ID_ATTRIBUTE: &str = "l-part";
pub const LYNX_DEFAULT_DISPLAY_LINEAR_ATTRIBUTE: &str = "lynx-default-display-linear";
pub const LYNX_DEFAULT_OVERFLOW_VISIBLE_ATTRIBUTE: &str = "lynx-default-overflow-visible";
pub const LYNX_TIMING_FLAG: &str = "__lynx_timing_flag";
pub const LYNX_DISPOSED_PROPERTY_NAME: &str = "__lynx_disposed";

lazy_static! {
  pub static ref EXPOSURE_RELATED_ATTRIBUTES: HashSet<&'static str> = {
    vec![
      "exposure-id",
      "exposure-area",
      "exposure-screen-margin-top",
      "exposure-screen-margin-right",
      "exposure-screen-margin-bottom",
      "exposure-screen-margin-left",
      "exposure-ui-margin-top",
      "exposure-ui-margin-right",
      "exposure-ui-margin-bottom",
      "exposure-ui-margin-left",
    ]
    .into_iter()
    .collect()
  };
  pub static ref WEB_EVENT_NAME_TO_LYNX_MAPPING: HashMap<&'static str, &'static str> = {
    HashMap::from({
      [
        ("click", "tap"),
        ("lynxscroll", "scroll"),
        ("lynxscrollend", "scrollend"),
        ("overlaytouch", "touch"),
        ("lynxfocus", "focus"),
        ("lynxblur", "blur"),
        ("lynxinput", "input"),
      ]
    })
  };
  pub static ref LYNX_EVENT_NAME_TO_WEB_MAPPING: HashMap<&'static str, &'static str> = {
    let mut map = HashMap::new();
    for (web_event, lynx_event) in WEB_EVENT_NAME_TO_LYNX_MAPPING.iter() {
      map.insert(*lynx_event, *web_event);
    }
    map
  };
}
