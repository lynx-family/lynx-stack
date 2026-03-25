/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */
/// Style Transformer module.
///
/// This module is responsible for parsing and transforming CSS styles.
/// It uses the `css_tokenizer` to parse CSS tokens and applies transformation rules.
///
/// Key components:
/// - `transformer`: Defines `StyleTransformer` and `Generator` trait for processing styles.
/// - `rules`: Defines transformation rules for CSS properties.
/// - `inline_style`: Handles transformation of inline styles.
#[cfg(any(feature = "client", feature = "server"))]
mod inline_style;
mod rules;
mod token_transformer;
mod transformer;
#[cfg(any(feature = "client", feature = "server"))]
pub(crate) use inline_style::transform_inline_style_key_value_vec;
#[cfg(any(feature = "client", feature = "server"))]
pub(crate) use inline_style::transform_inline_style_string;
#[cfg(any(feature = "client", feature = "server"))]
pub(crate) use rules::query_transform_rules;
pub use transformer::Generator;
pub use transformer::StyleTransformer;
