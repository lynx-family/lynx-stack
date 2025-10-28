use serde_json::{json, Value};
use sha1::{Digest, Sha1};
use sugar_path::SugarPath;
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

pub fn get_relative_path(cwd: &str, filename: &str) -> String {
  let cwd_path = cwd.replace('\\', "/").as_path().normalize();
  let file_path = filename.replace('\\', "/").as_path().normalize();

  if cwd.is_empty() {
    return file_path.to_string_lossy().to_string();
  }

  if file_path.starts_with(&cwd_path) {
    file_path.relative(&cwd_path).to_string_lossy().to_string()
  } else {
    file_path
      .file_name()
      .map(|name| name.to_string_lossy().to_string())
      .unwrap_or_else(|| filename.to_string())
  }
}

#[cfg(test)]
mod tests {
  use super::*;

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
      get_relative_path(
        "C:\\Users\\john\\project",
        "C:\\Users\\john\\project\\src\\Button.js"
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
}
