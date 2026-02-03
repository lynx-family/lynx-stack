/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

use fnv::{FnvHashMap, FnvHashSet};

pub const CSS_ID_ATTRIBUTE: &str = "l-css-id";
pub const LYNX_ENTRY_NAME_ATTRIBUTE: &str = "l-e-name";

#[cfg(any(feature = "client", feature = "server"))]
pub const LYNX_UNIQUE_ID_ATTRIBUTE: &str = "l-uid";
// #[cfg(feature = "client")]
// pub const LYNX_TEMPLATE_MEMBER_ID_ATTRIBUTE: &str = "l-t-e-id";
// #[cfg(feature = "client")]
// pub const APPEAR_EVENT_NAME: &str = "appear";
// #[cfg(feature = "client")]
// pub const DISAPPEAR_EVENT_NAME: &str = "disappear";
// #[cfg(feature = "client")]
// pub const LYNX_EXPOSURE_ID_ATTRIBUTE: &str = "exposure-id"; // if this attribute is present, the exposure event is enabled
// #[cfg(feature = "client")]
// pub const LYNX_TIMING_FLAG_ATTRIBUTE: &str = "__lynx_timing_flag"; // if this attribute is present, we should collect timing flags on creating and send it on calling __flushElementTree
lazy_static::lazy_static! {
  pub static ref LYNX_TAG_TO_HTML_TAG_MAP: FnvHashMap<&'static str, &'static str> = FnvHashMap::from_iter(vec![
    ("view", "x-view"),
    ("text", "x-text"),
    ("image", "x-image"),
    ("raw-text", "raw-text"),
    ("scroll-view", "x-scroll-view"),
    ("wrapper", "lynx-wrapper"),
    ("list", "x-list"),
    ("page", "div"),
    ("svg", "x-svg"),
  ]);

  pub static ref HTML_TAG_TO_LYNX_TAG_MAP: FnvHashMap<&'static str, &'static str> = FnvHashMap::from_iter(LYNX_TAG_TO_HTML_TAG_MAP
    .iter()
    .map(|(k, v)| (*v, *k))
  );

  /**
   * See packages/web-platform/web-core-wasm/ts/client/webElementsDynamicLoader.ts
   * This is a replica of the map in  packages/web-platform/web-core-wasm/ts/constants.ts
   */
  pub static ref LYNX_TAG_TO_DYNAMIC_LOAD_TAG_ID: FnvHashMap<&'static str, usize> = FnvHashMap::from_iter(vec![
    ("list", 0),
    ("x-swiper", 1),
    ("x-input", 2),
    ("x-input-ng", 2),
    ("input", 2),
    ("x-textarea", 3),
    ("x-audio-tt", 4),
    ("x-foldview-ng", 5),
    ("x-foldview-header-ng", 5),
    ("x-foldview-slot-drag-ng", 5),
    ("x-foldview-slot-ng", 5),
    ("x-foldview-toolbar-ng", 5),
    ("x-refresh-view", 6),
    ("x-refresh-header", 6),
    ("x-refresh-footer", 6),
    ("x-overlay-ng", 7),
    ("x-viewpager-ng", 8),
    ("x-viewpager-item-ng", 8),
  ]);

  pub static ref ALREADY_LOADED_TAGS: FnvHashSet<&'static str> = FnvHashSet::from_iter(vec![
    "view",
    "text",
    "image",
    "raw-text",
    "scroll-view",
    "wrapper",
    "div",
    "svg"
  ]);

  pub static ref ELEMENT_REACTIVE_EVENTS: FnvHashSet<&'static str> = FnvHashSet::from_iter(vec![
    "headeroffset",
    "headershow",
    "footeroffset",
    "startrefresh",
    "headerreleased",
    "startloadmore",
    "footerreleased",
    "scrolltoupper",
    "scrolltolower",
    "scroll",
    "scrollend",
    "load",
    "change",
    "offsetchange",
    "transition",
    "scrollstart",
    "change-event-for-indicator",
    "layoutchange",
    "input",
    "selection",
    "error",
    "layout",
    "offset",
    "snap",
    "scrolltoupperedge",
    "scrolltoloweredge"
  ]);
}
