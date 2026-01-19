/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

mod constants;
pub mod css_tokenizer;
#[cfg(feature = "client")]
mod js_binding;
mod leo_asm;
#[cfg(feature = "client")]
mod main_thread;
mod style_transformer;
mod template;
pub mod utils;

pub use leo_asm::Operation;
#[cfg(feature = "client")]
pub use main_thread::{
  element_apis::{
    element_data::{EventHandler, LynxElementData},
    element_template_apis::DecodedElementTemplate,
    event_apis::EventInfo,
  },
  main_thread_context::MainThreadWasmContext,
  style_manager::StyleManager,
};
pub use style_transformer::{Generator, StyleTransformer};
pub use template::template_sections::{
  element_template::{ElementTemplateSection, RawElementTemplate},
  style_info::{
    css_property::{ParsedDeclaration, ValueToken},
    decoded_style_data::DecodedStyleData,
    flattened_style_info::{FlattenedStyleInfo, FlattenedStyleSheet},
    raw_style_info::{RawStyleInfo, Rule, RulePrelude, Selector, StyleSheet},
    style_info_decoder::StyleInfoDecoder,
  },
};

#[cfg(feature = "client")]
pub use template::{
  template_sections::style_info::style_sheet_resource::StyleSheetResource, TemplateManager,
};
