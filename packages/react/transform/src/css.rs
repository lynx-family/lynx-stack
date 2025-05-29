use convert_case::{Case, Casing};
use swc_core::{
  common::{
    errors::{DiagnosticId, HANDLER},
    Span,
  },
  ecma::{ast::Expr, utils::is_literal},
};

use crate::utils::jsonify;

static EXTRACT_CSS_DIAGNOSTIC_ID: &str = "react-lynx-extract-css";

pub fn get_string_inline_style_from_literal(expr: &Expr, span: &Span) -> Option<String> {
  let expr = expr.clone();

  if is_literal(&expr) {
    let jsonified = jsonify(expr);
    return match &jsonified {
      serde_json::Value::Object(map) => Some(
        map
          .into_iter()
          .map(|(k, v)| match &v {
            serde_json::Value::Number(v) => Ok(format!(
              "{}:{}",
              k.from_case(Case::Camel).to_case(Case::Kebab),
              v
            )),
            serde_json::Value::String(v) => Ok(format!(
              "{}:{}",
              k.from_case(Case::Camel).to_case(Case::Kebab),
              v
            )),

            serde_json::Value::Null
            | serde_json::Value::Bool(_)
            | serde_json::Value::Array(_)
            | serde_json::Value::Object(_) => return Err(()),
          })
          .flat_map(|x| x)
          .collect::<Vec<_>>()
          .join(";"),
      ),
      serde_json::Value::String(s) => Some(s.to_string()),
      serde_json::Value::Null
      | serde_json::Value::Bool(_)
      | serde_json::Value::Number(_)
      | serde_json::Value::Array(_) => {
        HANDLER.with(|handler| {
          handler
            .struct_span_warn_with_code(
              *span,
              "Unexpected literal for style",
              DiagnosticId::Lint(EXTRACT_CSS_DIAGNOSTIC_ID.into()),
            )
            .emit();
        });

        None
      }
    };
  }

  None
}
