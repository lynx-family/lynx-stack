use crate::char_code_definitions::is_digit;
use std::borrow::Cow;

/// Represents a CSS dimension value (number + unit)
#[derive(Debug, Clone, PartialEq)]
pub struct Dimension<'a> {
  /// The numeric part
  pub value: f64,
  /// The unit part
  pub unit: Cow<'a, str>,
}

/// Enum type for parsing results
#[derive(Debug, Clone, PartialEq)]
pub enum ParseDimensionResult<'a> {
  /// Successfully parsed dimension value
  Dimension(Dimension<'a>),
  /// Parsing failed
  InvalidFormat,
}

/// Parse a dimension token into number and unit
///
/// # Parameters
/// - `dimension_token`: String representation of dimension token (e.g., "10px", "2.5em", "-1.5rem")
///
/// # Returns
/// - `ParseDimensionResult::Dimension(Dimension)`: Successfully parsed dimension value
/// - `ParseDimensionResult::InvalidFormat`: Parsing failed
///
/// # Examples
/// ```
/// use inline_style_parser::dimension_parser::{parse_dimension_token, ParseDimensionResult};
///
/// match parse_dimension_token("10px") {
///     ParseDimensionResult::Dimension(dim) => {
///         assert_eq!(dim.value, 10.0);
///         assert_eq!(dim.unit, "px");
///     }
///     ParseDimensionResult::InvalidFormat => panic!("Parsing failed"),
/// }
///
/// // Percentages are not dimension tokens, parsing will fail
/// assert_eq!(
///     parse_dimension_token("100%"),
///     ParseDimensionResult::InvalidFormat
/// );
/// ```
pub fn parse_dimension_token(dimension_token: &str) -> ParseDimensionResult<'_> {
  if dimension_token.is_empty() {
    return ParseDimensionResult::InvalidFormat;
  }

  let bytes = dimension_token.as_bytes();
  let len = bytes.len();

  let number_start = if !bytes.is_empty() && (bytes[0] == b'+' || bytes[0] == b'-') {
    1
  } else {
    0
  };
  let mut number_end = number_start;

  // Parse integer part
  while number_end < len && is_digit(bytes[number_end]) {
    number_end += 1;
  }

  // Parse decimal point and fractional part
  if number_end < len && bytes[number_end] == b'.' {
    number_end += 1;
    while number_end < len && is_digit(bytes[number_end]) {
      number_end += 1;
    }
  }

  // Check if there's a valid number part
  if number_end == number_start || (number_end == number_start + 1 && bytes[number_start] == b'.') {
    return ParseDimensionResult::InvalidFormat;
  }

  // Parse the numeric value
  let number_str = &dimension_token[0..number_end];
  let value = match number_str.parse::<f64>() {
    Ok(v) => v,
    Err(_) => return ParseDimensionResult::InvalidFormat,
  };

  // Parse the unit part
  if number_end >= len {
    return ParseDimensionResult::InvalidFormat;
  }

  let unit_str = &dimension_token[number_end..];

  // Validate that unit part is not empty and contains only valid characters
  // Allow ASCII letters and hyphens, but must start with a letter
  if unit_str.is_empty() || !is_valid_unit(unit_str) {
    return ParseDimensionResult::InvalidFormat;
  }

  // Use Cow::Borrowed to avoid allocation for common units
  let unit = if needs_lowercase(unit_str) {
    Cow::Owned(unit_str.to_ascii_lowercase())
  } else {
    Cow::Borrowed(unit_str)
  };

  ParseDimensionResult::Dimension(Dimension { value, unit })
}

/// Check if a unit string is valid according to CSS specifications
/// Allows ASCII letters and hyphens, but must start with a letter
fn is_valid_unit(unit: &str) -> bool {
  if unit.is_empty() {
    return false;
  }

  let mut chars = unit.chars();
  // First character must be a letter
  if !chars.next().is_some_and(|c| c.is_ascii_alphabetic()) {
    return false;
  }

  // Remaining characters must be letters or hyphens
  chars.all(|c| c.is_ascii_alphabetic() || c == '-')
}

/// Check if a unit string needs to be converted to lowercase
/// Common units that are already lowercase don't need conversion
fn needs_lowercase(unit: &str) -> bool {
  unit.chars().any(|c| c.is_ascii_uppercase())
}

/// Parse dimension token from source code
///
/// # Parameters
/// - `source`: Source code byte array
/// - `start`: Start position of dimension token
/// - `end`: End position of dimension token
///
/// # Returns
/// Parsing result
pub fn parse_dimension_from_source(
  source: &[u8],
  start: usize,
  end: usize,
) -> ParseDimensionResult<'_> {
  if start >= end || end > source.len() {
    return ParseDimensionResult::InvalidFormat;
  }

  let token_bytes = &source[start..end];
  match std::str::from_utf8(token_bytes) {
    Ok(token_str) => parse_dimension_token(token_str),
    Err(_) => ParseDimensionResult::InvalidFormat,
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_parse_dimension_token() {
    // Test valid dimensions - only core representative units
    let valid_cases = vec![
      // Basic values
      ("10px", 10.0, "px"),
      ("2.5em", 2.5, "em"),
      ("-1.5rem", -1.5, "rem"),
      // Edge cases
      ("0px", 0.0, "px"),
      ("+5px", 5.0, "px"),
      (".5em", 0.5, "em"),
      // Representative units (one from each category)
      ("10vh", 10.0, "vh"),   // viewport unit
      ("2ch", 2.0, "ch"),     // character unit
      ("10rpx", 10.0, "rpx"), // custom rpx unit
      ("5cap", 5.0, "cap"),   // hyphenated unit
      // Large numbers
      ("999999999999999px", 999999999999999.0, "px"),
    ];

    for (input, expected_value, expected_unit) in valid_cases {
      match parse_dimension_token(input) {
        ParseDimensionResult::Dimension(dim) => {
          assert_eq!(dim.value, expected_value, "Failed for input: {}", input);
          assert_eq!(dim.unit, expected_unit, "Failed for input: {}", input);
        }
        ParseDimensionResult::InvalidFormat => {
          panic!("Failed to parse valid dimension: {}", input);
        }
      }
    }

    // Test invalid dimensions
    let invalid_cases = vec![
      // Empty and malformed
      "", "px", "10", "abc", "10.", ".", "10px10",
      // Percentages (should be percentage tokens, not dimension tokens)
      "50%", "100%", // Scientific notation (not valid CSS dimension syntax)
      "1e3px", "2E5em", // Invalid hyphenated units
      "10--foo", "5-", "2-abc-",
    ];

    for input in invalid_cases {
      assert_eq!(
        parse_dimension_token(input),
        ParseDimensionResult::InvalidFormat,
        "{} should be InvalidFormat",
        input
      );
    }
  }

  #[test]
  fn test_parse_dimension_from_source() {
    let source = "width: 100px; height: 50%;".as_bytes();

    // Test parsing "100px"
    match parse_dimension_from_source(source, 7, 12) {
      ParseDimensionResult::Dimension(dim) => {
        assert_eq!(dim.value, 100.0);
        assert_eq!(dim.unit, "px");
      }
      ParseDimensionResult::InvalidFormat => panic!("Failed to parse dimension from source"),
    }

    // "50%" should be recognized as invalid dimension (it's a percentage token)
    assert_eq!(
      parse_dimension_from_source(source, 22, 25),
      ParseDimensionResult::InvalidFormat
    );

    // Test invalid ranges
    let test_source = "test".as_bytes();
    assert_eq!(
      parse_dimension_from_source(test_source, 0, 10),
      ParseDimensionResult::InvalidFormat
    );
    assert_eq!(
      parse_dimension_from_source(test_source, 5, 3),
      ParseDimensionResult::InvalidFormat
    );
  }

  #[test]
  fn test_cow_optimization() {
    // Test that common lowercase units use Cow::Borrowed (no allocation)
    let common_units = ["px", "em", "rem", "vh", "vw", "rpx"];

    for unit in &common_units {
      let input = format!("10{}", unit);
      match parse_dimension_token(&input) {
        ParseDimensionResult::Dimension(dim) => {
          // For common lowercase units, we should get Cow::Borrowed
          match &dim.unit {
            Cow::Borrowed(s) => assert_eq!(s, unit),
            Cow::Owned(s) => assert_eq!(s, unit),
          }
        }
        ParseDimensionResult::InvalidFormat => {
          panic!("Failed to parse common unit: {}", unit);
        }
      }
    }

    // Test that uppercase units use Cow::Owned (allocation needed)
    let uppercase_units = ["PX", "EM", "REM", "VH", "VW", "RPX"];

    for unit in &uppercase_units {
      let input = format!("10{}", unit);
      match parse_dimension_token(&input) {
        ParseDimensionResult::Dimension(dim) => {
          // For uppercase units, we should get Cow::Owned
          match &dim.unit {
            Cow::Borrowed(_) => panic!("Uppercase unit {} should use Cow::Owned", unit),
            Cow::Owned(s) => assert_eq!(s, &unit.to_lowercase()),
          }
        }
        ParseDimensionResult::InvalidFormat => {
          panic!("Failed to parse uppercase unit: {}", unit);
        }
      }
    }
  }
}
