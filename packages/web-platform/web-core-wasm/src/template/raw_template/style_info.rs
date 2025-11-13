use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/**
 * key: cssId
 * value: StyleSheet
 */
pub(crate) type StyleInfo = HashMap<i32, StyleSheet>;

pub(crate) type OneSelectorAtom = (Vec<String>, Vec<String>, Vec<String>, Vec<String>);

/**
 * Selectors are stored as 4 separate lists:
 * - plain selectors (e.g., "div", "span")
 * - pseudo-classes (e.g., ":hover", ":active")
 * - pseudo-elements (e.g., "::before", "::after")
 * - combinator selectors (e.g., ">", "+", "~")
 */
pub(crate) type Selector = Vec<OneSelectorAtom>;

#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct StyleRule {
  pub selectors: Vec<Selector>,
  pub declarations: Vec<(String, String)>,
}

#[derive(Deserialize)]
#[cfg_attr(feature = "encode", derive(Serialize))]
pub(crate) struct StyleSheet {
  pub rules: Vec<StyleRule>,
  pub at_rules: String,
  pub imports: Vec<i32>,
}
