use serde::{Deserialize, Deserializer};

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformMode {
  /// Transform for production.
  Production,
  /// Transform for development.
  Development,
  /// Transform for testing.
  Test,
}

impl<'de> Deserialize<'de> for TransformMode {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let s = String::deserialize(deserializer)?;
    match s.as_str() {
      "production" => Ok(TransformMode::Production),
      "development" => Ok(TransformMode::Development),
      "test" => Ok(TransformMode::Test),
      _ => Err(serde::de::Error::custom(format!(
        "value `{s}` does not match any variant of TransformMode"
      ))),
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_transform_mode() {
    let production_json = r#""production""#;
    let production_mode: TransformMode = serde_json::from_str(production_json).unwrap();
    assert_eq!(production_mode, TransformMode::Production);
    let development_json = r#""development""#;
    let development_mode: TransformMode = serde_json::from_str(development_json).unwrap();
    assert_eq!(development_mode, TransformMode::Development);
    let test_json = r#""test""#;
    let test_mode: TransformMode = serde_json::from_str(test_json).unwrap();
    assert_eq!(test_mode, TransformMode::Test);
  }

  #[test]
  fn test_transform_mode_unknown() {
    let json = r#""unknown""#;
    let result: Result<TransformMode, _> = serde_json::from_str(json);

    assert!(result.is_err());

    if let Err(err) = result {
      assert_eq!(
        err.to_string(),
        "value `unknown` does not match any variant of TransformMode"
      );
    }
  }
}
