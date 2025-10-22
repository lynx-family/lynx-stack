use semver::{Version, VersionReq};

/// Checks whether an optional SDK version satisfies or exceeds a required version.
///
/// The function normalizes both versions by appending `.0` and evaluates whether the
/// provided `target_sdk_version` meets the minimum `required_version`. Returns `false`
/// if `target_sdk_version` is `None` or if version parsing fails.
///
/// # Examples
///
/// ```
/// assert!(is_sdk_version_ge(&Some("3.1".to_string()), "3.1"));
/// assert!(is_sdk_version_ge(&Some("3.2".to_string()), "3.1"));
/// assert!(!is_sdk_version_ge(&Some("3.0".to_string()), "3.1"));
/// assert!(!is_sdk_version_ge(&None, "3.1"));
/// ```
pub fn is_sdk_version_ge(target_sdk_version: &Option<String>, required_version: &str) -> bool {
  if let Some(version_str) = target_sdk_version {
    let normalized_version = format!("{version_str}.0");
    let normalized_required = format!(">= {required_version}.0");
    if let Ok(version) = Version::parse(&normalized_version) {
      if let Ok(req) = VersionReq::parse(&normalized_required) {
        return req.matches(&version);
      }
    }
  }
  false
}

#[test]
fn test_is_sdk_version_ge() {
  assert!(is_sdk_version_ge(&Some("3.1".to_string()), "3.1"));
  assert!(is_sdk_version_ge(&Some("3.2".to_string()), "3.1"));
  assert!(!is_sdk_version_ge(&Some("3.0".to_string()), "3.1"));
  assert!(!is_sdk_version_ge(&Some("2.11".to_string()), "3.1"));
  assert!(!is_sdk_version_ge(&None, "3.1"));
}