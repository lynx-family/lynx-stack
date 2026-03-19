#![allow(clippy::type_complexity)]
use std::collections::HashMap;

lazy_static::lazy_static! {
  pub static ref RENAME_RULE: HashMap<&'static str, &'static str> = {
    HashMap::from([
      ("linear-weight", "--lynx-linear-weight"),
      ("flex-direction", "--flex-direction"),
      ("flex-wrap", "--flex-wrap"),
      ("flex-grow", "--flex-grow"),
      ("flex-shrink", "--flex-shrink"),
      ("flex-basis", "--flex-basis"),
      ("list-main-axis-gap", "--list-main-axis-gap"),
      ("list-cross-axis-gap", "--list-cross-axis-gap"),
      ("flex", "--flex"),
    ])
  };

  pub static ref REPLACE_RULE: HashMap<&'static str, HashMap<&'static str, &'static [(&'static str, &'static str)]>> = {
    HashMap::from([
      (
        "display",
          HashMap::from([
            ("linear", &[
              ("--lynx-display-toggle", "var(--lynx-display-linear)"),
              ("--lynx-display", "linear"),
              ("display", "flex"),
            ] as &'static [(&'static str, &'static str)]),
            ("flex", &[
              ("--lynx-display-toggle", "var(--lynx-display-flex)"),
              ("--lynx-display", "flex"),
              ("display", "flex"),
            ]),
          ]),
      ),
      (
        "direction",
          HashMap::from([
            ("lynx-rtl", &[("direction", "rtl")] as &'static [(&'static str, &'static str)]),
          ]),
      ),
      (
        "linear-orientation",
          HashMap::from([
            ("horizontal", &[("--lynx-linear-orientation", "horizontal"),("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal)")] as &'static [(&'static str, &'static str)]),
            ("horizontal-reverse", &[("--lynx-linear-orientation", "horizontal-reverse"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal-reverse)")]),
            ("vertical", &[("--lynx-linear-orientation", "vertical"),("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical)")]),
            ("vertical-reverse", &[("--lynx-linear-orientation", "vertical-reverse"),("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical-reverse)")]),
          ]),
      ),
      (
        "linear-direction",
          HashMap::from([
            ("row", &[("--lynx-linear-orientation", "horizontal"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal)")] as &'static [(&'static str, &'static str)]),
            ("row-reverse", &[("--lynx-linear-orientation", "horizontal-reverse"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-horizontal-reverse)")]),
            ("column", &[("--lynx-linear-orientation", "vertical"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical)")]),
            ("column-reverse", &[("--lynx-linear-orientation", "vertical-reverse"), ("--lynx-linear-orientation-toggle", "var(--lynx-linear-orientation-vertical-reverse)")]),
          ]),
      ),
      (
        "linear-gravity",
          HashMap::from([
            ("top", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-end"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ] as &'static [(&'static str, &'static str)]),
            ("bottom", &[
              ("--justify-content-column", "flex-end"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("left", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-end"),
            ]),
            ("right", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-end"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("center-vertical", &[
              ("--justify-content-column", "center"),
              ("--justify-content-column-reverse", "center"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("center-horizontal", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "center"),
              ("--justify-content-row-reverse", "center"),
            ]),
            ("start", &[
              ("--justify-content-column", "flex-start"),
              ("--justify-content-column-reverse", "flex-start"),
              ("--justify-content-row", "flex-start"),
              ("--justify-content-row-reverse", "flex-start"),
            ]),
            ("end", &[
              ("--justify-content-column", "flex-end"),
              ("--justify-content-column-reverse", "flex-end"),
              ("--justify-content-row", "flex-end"),
              ("--justify-content-row-reverse", "flex-end"),
            ]),
            ("center", &[
              ("--justify-content-column", "center"),
              ("--justify-content-column-reverse", "center"),
              ("--justify-content-row", "center"),
              ("--justify-content-row-reverse", "center"),
            ]),
            ("space-between", &[
              ("--justify-content-column", "space-between"),
              ("--justify-content-column-reverse", "space-between"),
              ("--justify-content-row", "space-between"),
              ("--justify-content-row-reverse", "space-between"),
            ]),
          ]),
      ),
      (
        "linear-cross-gravity",
          HashMap::from([
            ("start", &[
              ("align-items", "start"),
            ] as &'static [(&'static str, &'static str)]),
            ("end", &[
              ("align-items", "end"),
            ]),
            ("center", &[
              ("align-items", "center"),
            ]),
            ("stretch", &[
              ("align-items", "stretch"),
            ]),
          ]),
      ),
      (
        "linear-layout-gravity",
          HashMap::from([
            ("none", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "auto"),
            ] as &'static [(&'static str, &'static str)]),
            ("stretch", &[
              ("--align-self-row", "stretch"),
              ("--align-self-column", "stretch"),
            ]),
            ("top", &[
              ("--align-self-row", "start"),
              ("--align-self-column", "auto"),
            ]),
            ("bottom", &[
              ("--align-self-row", "end"),
              ("--align-self-column", "auto"),
            ]),
            ("left", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "start"),
            ]),
            ("right", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "end"),
            ]),
            ("start", &[
              ("--align-self-row", "start"),
              ("--align-self-column", "start"),
            ]),
            ("end", &[
              ("--align-self-row", "end"),
              ("--align-self-column", "end"),
            ]),
            ("center", &[
              ("--align-self-row", "center"),
              ("--align-self-column", "center"),
            ]),
            ("center-vertical", &[
              ("--align-self-row", "center"),
              ("--align-self-column", "start"),
            ]),
            ("center-horizontal", &[
              ("--align-self-row", "start"),
              ("--align-self-column", "center"),
            ]),
            ("fill-vertical", &[
              ("--align-self-row", "stretch"),
              ("--align-self-column", "auto"),
            ]),
            ("fill-horizontal", &[
              ("--align-self-row", "auto"),
              ("--align-self-column", "stretch"),
            ]),
          ])
        ),
        (
          "justify-content",
            HashMap::from([
            ("start", &[
              ("justify-content", "flex-start"),
            ] as &'static [(&'static str, &'static str)]),
            ("end", &[
              ("justify-content", "flex-end"),
            ]),
            ("left", &[
              ("justify-content", "--lynx-invalid-invalid-invalid"),
            ]),
            ("right", &[
              ("justify-content", "--lynx-invalid-invalid-invalid"),
            ])
          ])
        )
      ]
    )
  };
}

#[inline(always)]
pub fn get_rename_rule_value(name: &str) -> Option<&'static str> {
  RENAME_RULE.get(name).copied()
}

#[inline(always)]
pub fn get_replace_rule_value(
  name: &str,
  value: &str,
) -> Option<&'static [(&'static str, &'static str)]> {
  if let Some(sub_rule) = REPLACE_RULE.get(name) {
    sub_rule.get(value).copied()
  } else {
    None
  }
}

#[cfg(test)]
mod tests {
  use super::{get_rename_rule_value, get_replace_rule_value};

  #[test]
  fn test_rename_rule_flex_direction() {
    let source = "flex-direction:row";
    let name = &source[0..source.len() - 4];
    let result = get_rename_rule_value(name).unwrap();
    assert_eq!(result, "--flex-direction");
  }
  #[test]
  fn test_rename_rule_flex_direction_at_mid() {
    let source = "height:1px;flex-direction:row";
    let offset = "height:1px;".len();
    let name = &source[offset..source.len() - 4];
    let result = get_rename_rule_value(name).unwrap();
    assert_eq!(result, "--flex-direction");
  }
  #[test]
  fn test_replace_rule_display_linear() {
    let source = "display:linear";
    let name = &source[0..7];
    let value = &source[8..];
    let result = get_replace_rule_value(name, value)
      .unwrap()
      .iter()
      .map(|pair| format!("{}:{}", pair.0, pair.1))
      .collect::<Vec<_>>()
      .join(";");
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex"
    );
  }
  #[test]
  fn test_replace_rule_display_linear_at_mid() {
    let source = "height:1px;display:linear";
    let offset = "height:1px;".len();
    let name = &source[offset..offset + 7];
    let value = &source[offset + 8..];
    let result = get_replace_rule_value(name, value)
      .unwrap()
      .iter()
      .map(|pair| format!("{}:{}", pair.0, pair.1))
      .collect::<Vec<_>>()
      .join(";");
    assert_eq!(
      result,
      "--lynx-display-toggle:var(--lynx-display-linear);--lynx-display:linear;display:flex"
    );
  }

  #[test]
  fn test_rename_rule_not_exist() {
    let source = "background-image:url(\"https://example.com\")";
    let name = &source[0.."background-image".len()];
    let result = get_rename_rule_value(name);
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_value_not_match() {
    let source = "display:grid";
    let name = &source[0..7];
    let value = &source[8..];
    let result = get_replace_rule_value(name, value);
    assert_eq!(result, None);
  }

  #[test]
  fn test_replace_rule_name_not_match() {
    let source = "height:1px";
    let name = &source[0..6];
    let value = &source[7..];
    let result = get_replace_rule_value(name, value);
    assert_eq!(result, None);
  }
}
