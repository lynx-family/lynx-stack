/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
*/

use crate::css_tokenizer::token_types::*;
use std::borrow::Cow;

/**
 * Transform one token according to specific rules.
 * Rule list:
 * 1. If the token is a DIMENSION_TOKEN with "rpx" unit, convert it to a calc(value * var(--rpx-unit));
 */
pub(crate) fn transform_one_token<'a>(token_type: u8, token_value: &'a str) -> (u8, Cow<'a, str>) {
  match token_type {
    DIMENSION_TOKEN => {
      if token_value.len() > 3 && token_value.to_ascii_lowercase().ends_with("rpx") {
        let value = &token_value[..token_value.len() - 3];
        return (
          token_type,
          Cow::Owned(format!("calc({value} * var(--rpx-unit))")),
        );
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
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100rpx");
    assert_eq!(tv, "calc(100 * var(--rpx-unit))");
  }

  #[test]
  fn test_transform_rpx_float() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100.5rpx");
    assert_eq!(tv, "calc(100.5 * var(--rpx-unit))");
  }

  #[test]
  fn test_transform_px() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100px");
    assert_eq!(tv, "100px");
  }

  #[test]
  fn test_transform_rpx_case_insensitive() {
    let (_, tv) = transform_one_token(DIMENSION_TOKEN, "100RPX");
    assert_eq!(tv, "calc(100 * var(--rpx-unit))");
  }

  #[test]
  fn test_transform_other_token() {
    let (_, tv) = transform_one_token(IDENT_TOKEN, "red");
    assert_eq!(tv, "red");
  }
}
