use serde::{Deserialize, Deserializer};

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformTarget {
  LEPUS,
  JS,
  MIXED,
}

impl<'de> Deserialize<'de> for TransformTarget {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let s = String::deserialize(deserializer)?;
    match s.as_str() {
      "LEPUS" => Ok(TransformTarget::LEPUS),
      "JS" => Ok(TransformTarget::JS),
      "MIXED" => Ok(TransformTarget::MIXED),
      _ => Err(serde::de::Error::custom(format!(
        "value `{s}` does not match any variant of TransformTarget"
      ))),
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_transform_target_lepus() {
    let json = r#""LEPUS""#;
    let mode: TransformTarget = serde_json::from_str(json).unwrap();
    assert_eq!(mode, TransformTarget::LEPUS);
  }

  #[test]
  fn test_transform_target_js() {
    let json = r#""JS""#;
    let mode: TransformTarget = serde_json::from_str(json).unwrap();
    assert_eq!(mode, TransformTarget::JS);
  }

  #[test]
  fn test_transform_target_mixed() {
    let json = r#""MIXED""#;
    let mode: TransformTarget = serde_json::from_str(json).unwrap();
    assert_eq!(mode, TransformTarget::MIXED);
  }

  #[test]
  fn test_transform_target_unknown() {
    let json = r#""unknown""#;
    let result: Result<TransformTarget, _> = serde_json::from_str(json);

    assert!(result.is_err());

    if let Err(err) = result {
      assert_eq!(
        err.to_string(),
        "value `unknown` does not match any variant of TransformTarget"
      );
    }
  }
}
