use once_cell::sync::Lazy;
use regex::Regex;

static LYNX_EVENT_ATTRIBUTE_NAME_RE: Lazy<Regex> = Lazy::new(|| {
  Regex::new(r"^(global-bind|bind|catch|capture-bind|capture-catch)([A-Za-z]+)$").unwrap()
});

pub fn is_lynx_event_attribute_name(name: &str) -> bool {
  LYNX_EVENT_ATTRIBUTE_NAME_RE.is_match(name)
}

pub fn parse_lynx_event_attribute_name(name: &str) -> Option<(&str, &str)> {
  let captures = LYNX_EVENT_ATTRIBUTE_NAME_RE.captures(name)?;
  Some((captures.get(1)?.as_str(), captures.get(2)?.as_str()))
}

/// Transform the React-style event attribute names supported by the builtin
/// attribute-name transform into Lynx event attribute names.
pub fn transform_react_event_attribute_name(name: &str) -> Option<String> {
  let event_name = name.strip_prefix("on")?;
  if !event_name
    .as_bytes()
    .first()
    .is_some_and(u8::is_ascii_uppercase)
    || !event_name.bytes().all(|byte| byte.is_ascii_alphabetic())
  {
    return None;
  }

  match name {
    "onClick" => Some("bindtap".into()),
    "onCatchTap" => Some("catchtap".into()),
    _ => Some(format!("bind{}", event_name.to_ascii_lowercase())),
  }
}

/// Transform the legacy ReactLynx 2 event attribute convention used by the
/// compat transform into Lynx event attribute names.
///
/// Keep this separate from [`transform_react_event_attribute_name`]: legacy
/// catch events use a trailing `Catch`, such as `onClickCatch`, while the
/// builtin attribute-name transform accepts `onCatchTap`.
pub fn transform_legacy_react_event_attribute_name(name: &str) -> Option<String> {
  let (name, prefix) = if let Some(name) = name.strip_suffix("Catch") {
    (name, "catch")
  } else {
    (name, "bind")
  };
  let event_name = name.strip_prefix("on")?;
  if !event_name
    .as_bytes()
    .first()
    .is_some_and(u8::is_ascii_uppercase)
    || !event_name.bytes().all(|byte| byte.is_ascii_alphabetic())
  {
    return None;
  }

  let suffix = if event_name == "Click" {
    "tap".into()
  } else {
    event_name.to_ascii_lowercase()
  };
  Some(format!("{prefix}{suffix}"))
}

#[cfg(test)]
mod tests {
  use super::{
    is_lynx_event_attribute_name, parse_lynx_event_attribute_name,
    transform_legacy_react_event_attribute_name, transform_react_event_attribute_name,
  };

  #[test]
  fn recognizes_lynx_event_attribute_names() {
    for name in [
      "bindtap",
      "bindTap",
      "catchTap",
      "capture-bindTap",
      "capture-catchTap",
      "global-bindTap",
    ] {
      assert!(is_lynx_event_attribute_name(name));
    }

    for name in [
      "bind",
      "catch",
      "capture-bind",
      "capture-catch",
      "global-bind",
      "bindtap1",
      "bindtap-event",
    ] {
      assert!(!is_lynx_event_attribute_name(name));
    }
  }

  #[test]
  fn parses_lynx_event_attribute_names() {
    assert_eq!(
      parse_lynx_event_attribute_name("bindTap"),
      Some(("bind", "Tap"))
    );
    assert_eq!(
      parse_lynx_event_attribute_name("capture-catchTouchStart"),
      Some(("capture-catch", "TouchStart"))
    );
    assert_eq!(parse_lynx_event_attribute_name("onClick"), None);
  }

  #[test]
  fn transforms_react_event_attribute_names() {
    assert_eq!(
      transform_react_event_attribute_name("onClick"),
      Some("bindtap".into())
    );
    assert_eq!(
      transform_react_event_attribute_name("onCatchTap"),
      Some("catchtap".into())
    );
    assert_eq!(
      transform_react_event_attribute_name("onReady"),
      Some("bindready".into())
    );
    assert_eq!(
      transform_react_event_attribute_name("onTouchStart"),
      Some("bindtouchstart".into())
    );

    for name in ["onclick", "on", "onTap1", "bindtap"] {
      assert_eq!(transform_react_event_attribute_name(name), None);
    }
  }

  #[test]
  fn transforms_legacy_react_event_attribute_names() {
    assert_eq!(
      transform_legacy_react_event_attribute_name("onClick"),
      Some("bindtap".into())
    );
    assert_eq!(
      transform_legacy_react_event_attribute_name("onClickCatch"),
      Some("catchtap".into())
    );
    assert_eq!(
      transform_legacy_react_event_attribute_name("onTouchStartCatch"),
      Some("catchtouchstart".into())
    );
    assert_eq!(
      transform_legacy_react_event_attribute_name("onClickFoo"),
      Some("bindclickfoo".into())
    );
    for name in ["on", "only", "onclick", "bindtap"] {
      assert_eq!(transform_legacy_react_event_attribute_name(name), None);
    }
  }
}
