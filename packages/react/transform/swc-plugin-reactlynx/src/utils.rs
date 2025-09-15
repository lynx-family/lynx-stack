use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use std::{
  collections::{HashMap, HashSet},
  path::{Component, Path},
};
use swc_core::ecma::ast::*;

// https://github.com/swc-project/swc/blob/v1.5.8/crates/swc_ecma_transforms_optimization/src/json_parse.rs#L95
pub fn jsonify(e: Expr) -> Value {
  match e {
    Expr::Object(obj) => Value::Object(
      obj
        .props
        .into_iter()
        .map(|v| match v {
          PropOrSpread::Prop(p) if p.is_key_value() => p.key_value().unwrap(),
          _ => unreachable!(
            "Unexpected property name type in JSON conversion - expected Ident, Str, or Num"
          ),
        })
        .map(|p: KeyValueProp| {
          let value = jsonify(*p.value);
          let key = match p.key {
            PropName::Str(s) => s.value.to_string(),
            PropName::Ident(id) => id.sym.to_string(),
            PropName::Num(n) => format!("{}", n.value),
            _ => unreachable!(
              "Unexpected property name type in JSON conversion - expected Ident, Str, or Num"
            ),
          };
          (key, value)
        })
        .collect(),
    ),
    Expr::Array(arr) => Value::Array(
      arr
        .elems
        .into_iter()
        .map(|v| jsonify(*v.unwrap().expr))
        .collect(),
    ),
    Expr::Lit(Lit::Str(Str { value, .. })) => Value::String(value.to_string()),
    Expr::Lit(Lit::Num(Number { value, raw, .. })) => match raw {
      Some(raw_str) => match serde_json::from_str::<serde_json::Number>(&raw_str) {
        Ok(num) => Value::Number(num),
        Err(_) => json!(value),
      },
      None => json!(value),
    },
    Expr::Lit(Lit::Null(..)) => Value::Null,
    Expr::Lit(Lit::Bool(v)) => Value::Bool(v.value),
    Expr::Tpl(Tpl { quasis, .. }) => Value::String(match quasis.first() {
      Some(TplElement {
        cooked: Some(value),
        ..
      }) => value.to_string(),
      _ => String::new(),
    }),
    _ => unreachable!(
      "Unexpected expression type in JSON conversion - cannot convert {:?} to JSON",
      e
    ),
  }
}

pub fn calc_hash(s: &str) -> String {
  let mut hasher = Sha1::new();
  hasher.update(s.as_bytes());
  let sum = hasher.finalize();

  hex::encode(sum)[0..5].to_string()
}

fn normalize_path_components(path: &str) -> Vec<String> {
  let normalized_path = path.replace('\\', "/");

  Path::new(&normalized_path)
    .components()
    .fold(Vec::new(), |mut components, comp| {
      match comp {
        Component::Normal(name) => {
          components.push(name.to_string_lossy().into_owned());
        }
        Component::ParentDir => {
          if !components.is_empty() {
            components.pop();
          }
        }
        _ => {}
      }
      components
    })
}

pub fn get_relative_path(cwd: &str, filename: &str) -> String {
  let cwd_components = normalize_path_components(cwd);
  let file_components = normalize_path_components(filename);

  if cwd_components.is_empty() {
    return file_components.join("/");
  }

  let common_len = cwd_components
    .iter()
    .zip(file_components.iter())
    .take_while(|(a, b)| a == b)
    .count();

  if common_len == cwd_components.len() && file_components.len() > cwd_components.len() {
    return file_components[cwd_components.len()..].join("/");
  }

  file_components
    .last()
    .cloned()
    .unwrap_or_else(|| filename.to_string())
}

pub fn resolve_value(
  key: &str,
  config_define: &HashMap<String, String>,
  visited: &mut HashSet<String>,
) -> Option<String> {
  // circular reference
  if visited.contains(key) {
    return None;
  }
  visited.insert(key.to_string());

  if let Some(value) = config_define.get(key) {
    if config_define.contains_key(value) {
      resolve_value(value, config_define, visited)
    } else {
      Some(value.clone())
    }
  } else {
    None
  }
}
#[cfg(test)]
mod tests {
  use super::*;
  use std::collections::{HashMap, HashSet};

  #[test]
  fn test_normalize_path_components() {
    assert_eq!(
      normalize_path_components(r"C:\Users\john\project\src\Button.js"),
      vec!["C:", "Users", "john", "project", "src", "Button.js"]
    );

    assert_eq!(
      normalize_path_components("/Users/john/project/src/Button.js"),
      vec!["Users", "john", "project", "src", "Button.js"]
    );

    assert_eq!(normalize_path_components("/"), Vec::<String>::new());

    assert_eq!(
      normalize_path_components("src/Button.js"),
      vec!["src", "Button.js"]
    );

    assert_eq!(normalize_path_components("a/b/../c"), vec!["a", "c"]);
    assert_eq!(normalize_path_components("a/b/c/../../d"), vec!["a", "d"]);
    assert_eq!(normalize_path_components("a/b/../../../c"), vec!["c"]);
    assert_eq!(normalize_path_components("../a/b"), vec!["a", "b"]);
    assert_eq!(normalize_path_components("a/./b"), vec!["a", "b"]);
    assert_eq!(normalize_path_components("a/./b/./c"), vec!["a", "b", "c"]);
    assert_eq!(normalize_path_components("./a/b"), vec!["a", "b"]);
    assert_eq!(normalize_path_components("a/b/."), vec!["a", "b"]);
  }

  #[test]
  fn test_get_relative_path() {
    assert_eq!(
      get_relative_path("/Users/john/project", "/Users/john/project/src/Button.js"),
      "src/Button.js"
    );

    assert_eq!(
      get_relative_path(
        r"C:\Users\john\project",
        r"C:\Users\john\project\src\Button.js"
      ),
      "src/Button.js"
    );

    assert_eq!(
      get_relative_path("/", "/src/components/Button.js"),
      "src/components/Button.js"
    );

    assert_eq!(
      get_relative_path(r"C:\", r"C:\src\components\Button.js"),
      "src/components/Button.js"
    );

    assert_eq!(get_relative_path("/", "test.js"), "test.js");
    assert_eq!(get_relative_path("/any/path", "test.js"), "test.js");

    assert_eq!(
      get_relative_path("/Users/john/project", "/Users/other/file.js"),
      "file.js"
    );
  }

  #[test]
  fn test_resolve_value_direct() {
    let config = HashMap::from([("KEY1".into(), "value1".into())]);
    let mut visited = HashSet::new();
    let result = resolve_value("KEY1", &config, &mut visited);

    assert_eq!(result, Some("value1".into()));
  }

  #[test]
  fn test_resolve_value_single_reference() {
    let config = HashMap::from([
      ("__LEPUS__".into(), "true".into()),
      ("__NON_EXISTS__".into(), "__LEPUS__".into()),
    ]);

    let mut visited = HashSet::new();
    let result = resolve_value("__NON_EXISTS__", &config, &mut visited);

    assert_eq!(result, Some("true".into()));
  }

  #[test]
  fn test_resolve_value_chain_reference() {
    let config = HashMap::from([
      ("__LEPUS__".into(), "true".into()),
      ("__NON_EXISTS__".into(), "__LEPUS__".into()),
      ("__NON_EXISTS_2__".into(), "__NON_EXISTS__".into()),
    ]);

    let mut visited = HashSet::new();
    let result = resolve_value("__NON_EXISTS_2__", &config, &mut visited);

    assert_eq!(result, Some("true".into()));
  }

  #[test]
  fn test_resolve_value_circular_reference() {
    let config = HashMap::from([("A".into(), "B".into()), ("B".into(), "A".into())]);

    let mut visited = HashSet::new();
    let result = resolve_value("A", &config, &mut visited);

    assert_eq!(result, None);
  }

  #[test]
  fn test_resolve_value_self_reference() {
    let config = HashMap::from([("SELF".into(), "SELF".into())]);

    let mut visited = HashSet::new();
    let result = resolve_value("SELF", &config, &mut visited);

    assert_eq!(result, None);
  }
}
