mod decode;
mod decode_legacy_json;
mod element_template;
mod encode;
mod style_loader;
mod template_loader;
use decode::{DecodedTemplate, LynxTemplate};
pub(crate) use element_template::ElementTemplate;
use style_loader::flatten_style_info;
pub(crate) use style_loader::{
  FlattenedStyleInfo, FlattenedStyleSheet, OneSelectorAtom, Selector, StyleInfo, StyleRule,
  StyleSheet,
};
const CURRENT_VERSION: u32 = '{' as u32 + 1; // '{' for json detection
const VERSION_SIZE: usize = CURRENT_VERSION.to_le_bytes().len();
