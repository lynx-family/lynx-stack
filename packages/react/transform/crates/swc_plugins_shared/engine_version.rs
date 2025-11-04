use semver::{Version, VersionReq};

// Format engine version to "x.y.0"
pub fn format_version(version_str: &str) -> String {
  let parts: Vec<_> = version_str.split('.').collect();
  match parts.len() {
    0 => "0.0.0".to_string(),
    1 => format!("{}.0.0", parts[0]),
    2 => format!("{}.{}.0", parts[0], parts[1]),
    _ => format!("{}.{}.0", parts[0], parts[1]),
  }
}

// Compare engine version with required version.
pub fn is_engine_version_ge(
  target_engine_version: &Option<String>,
  required_version: &str,
) -> bool {
  if let Some(version_str) = target_engine_version {
    let normalized_version = format_version(version_str);
    let normalized_required = format!(">= {}", format_version(required_version));
    if let Ok(version) = Version::parse(&normalized_version) {
      if let Ok(req) = VersionReq::parse(&normalized_required) {
        return req.matches(&version);
      }
    }
  }
  false
}

#[test]
fn test_is_engine_version_ge() {
  // 2 < 3.1 < 4
  assert!(!is_engine_version_ge(&Some("2".to_string()), "3.1"));
  assert!(!is_engine_version_ge(&Some("3".to_string()), "3.1"));
  assert!(is_engine_version_ge(&Some("4".to_string()), "3.1"));

  // 2.11 < 3.0 < 3.1 < 3.2
  assert!(!is_engine_version_ge(&Some("2.11".to_string()), "3.1"));
  assert!(!is_engine_version_ge(&Some("3.0".to_string()), "3.1"));
  assert!(is_engine_version_ge(&Some("3.1".to_string()), "3.1"));
  assert!(is_engine_version_ge(&Some("3.2".to_string()), "3.1"));

  // 3.1.0 < 3.1.X
  assert!(is_engine_version_ge(&Some("3.1.0".to_string()), "3.1"));
  assert!(is_engine_version_ge(&Some("3.1.1.0".to_string()), "3.1"));

  // None case
  assert!(!is_engine_version_ge(&None, "3.1"));
}
