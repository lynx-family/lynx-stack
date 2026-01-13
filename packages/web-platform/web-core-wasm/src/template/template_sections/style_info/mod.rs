/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

mod decoded_style_data;
mod flattened_style_info;
mod raw_style_info;
mod style_info_decoder;
use fnv::FnvHashMap;
use raw_style_info::RawStyleInfo;
type CssOgClassSelectorNameToDeclarationsMap = FnvHashMap<String, String>;
type CssOgCssIdToClassSelectorNameToDeclarationsMap =
  FnvHashMap<i32, CssOgClassSelectorNameToDeclarationsMap>;

#[cfg(feature = "client")]
mod style_sheet_resource;
#[cfg(feature = "client")]
pub(crate) use style_sheet_resource::StyleSheetResource;

#[cfg(test)]
use raw_style_info::*;
