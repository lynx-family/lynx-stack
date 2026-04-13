/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
*/

use crate::css_tokenizer::token_types::*;
use std::borrow::Cow;

#[derive(Default)]
pub struct TransformerConfig {
  pub transform_vw: bool,
  pub transform_vh: bool,
  pub transform_rem: bool,
}

/**
 * Transform one token according to specific rules.
 * Rule list:
 * 1. If the token is a DIMENSION_TOKEN with "rpx" unit, convert it to a calc(value * var(--rpx-unit));
 */
pub(crate) fn transform_one_token<'a>(
  token_type: u8,
  token_value: &'a str,
  config: &TransformerConfig,
) -> (u8, Cow<'a, str>) {
  match token_type {
    DIMENSION_TOKEN => {
      let len = token_value.len();
      if len > 3 {
        let suffix = &token_value[len - 3..];
        if suffix.eq_ignore_ascii_case("rpx") {
          let value = &token_value[..len - 3];
          return (
            token_type,
            Cow::Owned(format!("calc({value} * var(--rpx-unit))")),
          );
        } else if suffix.eq_ignore_ascii_case("ppx") {
          let value = &token_value[..len - 3];
          return (
            token_type,
            Cow::Owned(format!("calc({value} * var(--ppx-unit))")),
          );
        } else if config.transform_rem && suffix.eq_ignore_ascii_case("rem") {
          let value = &token_value[..len - 3];
          return (
            token_type,
            Cow::Owned(format!("calc({value} * var(--rem-unit))")),
          );
        }
      }
      if len > 2 {
        let suffix = &token_value[len - 2..];
        if config.transform_vw && suffix.eq_ignore_ascii_case("vw") {
          let value = &token_value[..len - 2];
          return (
            token_type,
            Cow::Owned(format!("calc({value} * var(--vw-unit))")),
          );
        } else if config.transform_vh && suffix.eq_ignore_ascii_case("vh") {
          let value = &token_value[..len - 2];
          return (
            token_type,
            Cow::Owned(format!("calc({value} * var(--vh-unit))")),
          );
        }
      }
      (token_type, Cow::Borrowed(token_value))
    }
    _ => (token_type, Cow::Borrowed(token_value)),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_transform_rpx() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100rpx", &TransformerConfig::default());
    assert_eq!(tv, "calc(100 * var(--rpx-unit))");
  }

  #[test]
  fn test_transform_rpx_float() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100.5rpx", &TransformerConfig::default());
    assert_eq!(tv, "calc(100.5 * var(--rpx-unit))");
  }

  #[test]
  fn test_transform_px() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100px", &TransformerConfig::default());
    assert_eq!(tv, "100px");
  }

  #[test]
  fn test_transform_rpx_case_insensitive() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100RPX", &TransformerConfig::default());
    assert_eq!(tv, "calc(100 * var(--rpx-unit))");
  }

  #[test]
  fn test_transform_ppx() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100ppx", &TransformerConfig::default());
    assert_eq!(tv, "calc(100 * var(--ppx-unit))");
  }

  #[test]
  fn test_transform_ppx_case_insensitive() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100PPX", &TransformerConfig::default());
    assert_eq!(tv, "calc(100 * var(--ppx-unit))");
  }

  #[test]
  fn test_transform_vw() {
    let (_, tv) = transform_one_token(
      DIMENSION_TOKEN,
      "100.5vw",
      &TransformerConfig {
        transform_vw: true,
        ..Default::default()
      },
    );
    assert_eq!(tv, "calc(100.5 * var(--vw-unit))");
  }

  #[test]
  fn test_transform_vw_disabled() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100.5vw", &TransformerConfig::default());
    assert_eq!(tv, "100.5vw");
  }

  #[test]
  fn test_transform_vh() {
    let (_, tv) = transform_one_token(
      DIMENSION_TOKEN,
      "100vh",
      &TransformerConfig {
        transform_vh: true,
        ..Default::default()
      },
    );
    assert_eq!(tv, "calc(100 * var(--vh-unit))");
  }

  #[test]
  fn test_transform_vh_disabled() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100vh", &TransformerConfig::default());
    assert_eq!(tv, "100vh");
  }

  #[test]
  fn test_transform_rem() {
    let (_, tv) = transform_one_token(
      DIMENSION_TOKEN,
      "2rem",
      &TransformerConfig {
        transform_rem: true,
        ..Default::default()
      },
    );
    assert_eq!(tv, "calc(2 * var(--rem-unit))");
  }

  #[test]
  fn test_transform_rem_disabled() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "2rem", &TransformerConfig::default());
    assert_eq!(tv, "2rem");
  }

  #[test]
  fn test_transform_vw_case_insensitive() {
    let (_, tv) = transform_one_token(
      DIMENSION_TOKEN,
      "50VW",
      &TransformerConfig {
        transform_vw: true,
        ..Default::default()
      },
    );
    assert_eq!(tv, "calc(50 * var(--vw-unit))");
  }

  #[test]
  fn test_transform_other_token() {
    let (_, tv) = transform_one_token(IDENT_TOKEN, "red", &TransformerConfig::default());
    assert_eq!(tv, "red");
  }
}
