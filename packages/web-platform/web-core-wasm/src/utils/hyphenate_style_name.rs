/*
 * Copyright 2025 The Lynx Authors. All rights reserved.
 * Licensed under the Apache License Version 2.0 that can be found in the
 * LICENSE file in the root directory of this source tree.
 */

/// Convert camelCase style names to kebab-case (e.g., `backgroundColor` -> `background-color`).
///
/// **Assumption**: This function assumes that the input style name does NOT contain the "ms" prefix
/// used for Internet Explorer (e.g., "msTransform"). It strictly follows standard hyphenation logic:
/// splitting on uppercase letters and lowercasing them.
pub fn hyphenate_style_name(name: &str) -> String {
  let mut result = String::with_capacity(name.len());

  for c in name.chars() {
    if c.is_uppercase() {
      result.push('-');
      result.push(c.to_ascii_lowercase());
    } else {
      result.push(c);
    }
  }

  result
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_hyphenate_style_name_basic() {
    assert_eq!(hyphenate_style_name("backgroundColor"), "background-color");
    assert_eq!(hyphenate_style_name("color"), "color");
    assert_eq!(hyphenate_style_name("fontSize"), "font-size");
    assert_eq!(
      hyphenate_style_name("borderTopLeftRadius"),
      "border-top-left-radius"
    );
  }

  #[test]
  fn test_hyphenate_style_name_edge_cases() {
    assert_eq!(hyphenate_style_name(""), "");
    assert_eq!(hyphenate_style_name("-"), "-");
    assert_eq!(hyphenate_style_name("--custom-prop"), "--custom-prop");
  }

  #[test]
  fn test_performance() {
    use std::time::Instant;

    let iterations = 100_000;
    let start = Instant::now();
    for _ in 0..iterations {
      let _ = hyphenate_style_name("backgroundColor");
      let _ = hyphenate_style_name("borderTopLeftRadius");
      let _ = hyphenate_style_name("WebkitTransform");
    }
    let duration = start.elapsed();

    println!(
      "Performance: {} iterations took {:?}. Avg per call: {:?}",
      iterations * 3,
      duration,
      duration / (iterations * 3)
    );

    // Basic sanity check to ensure it's not excessively slow (e.g. > 100ms for 300k ops)
    // This is a loose bound, mostly to ensure no catastrophic regression/loop.
    assert!(duration.as_millis() < 500);
  }
}
