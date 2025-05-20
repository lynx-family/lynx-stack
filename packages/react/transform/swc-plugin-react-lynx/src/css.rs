use convert_case::{Case, Casing};
use swc_core::{
  common::{
    errors::{DiagnosticId, HANDLER},
    Span,
  },
  ecma::{self, ast::Expr, utils::is_literal},
};

use crate::css_property::CSS_PROPERTY_MAP;
use crate::utils::jsonify;

static EXTRACT_CSS_DIAGNOSTIC_ID: &str = "react-lynx-extract-css";

/// `get_inline_style_from_object` extract CSSPropertyID and CSSValue from a [`ObjectLit`](ecma::ast::ObjectLit).
/// An empty Vec will be returned if the extraction failed.
///
/// # Examples
///
/// - `{ width: "200px" }` will be transformed into `[(27, "200px")]`
/// - `{ width: w }` will be transformed into `[(27, w)]`
///
/// ## Casing
///
/// Both [`Camel`](Case::Camel) and [`Kebab`](Case::Kebab) cases are supported.
/// E.g.: both `{ flexShrink: 1 }` and `{ 'flex-shrink': 1 }` will be transformed into `[(51, 1)]`
///
/// ## Extraction failures
///
/// In some cases, the extraction will be failed.
///
/// - Having [`Spread`](ecma::ast::PropOrSpread::Spread) in the object.
/// - Having [`Computed`](ecma::ast::PropName::Computed) in the object.
/// - Having unknown CSS property key that is not placed in [CSS_PROPERTY_MAP](CSS_PROPERTY_MAP).
pub fn get_inline_style_from_object(object: &ecma::ast::ObjectLit) -> Vec<(u32, ecma::ast::Expr)> {
  object
    .props
    .iter()
    .map(|v| match &v {
      ecma::ast::PropOrSpread::Prop(p) if p.is_key_value() => Ok(p.clone().key_value().unwrap()),
      ecma::ast::PropOrSpread::Prop(p) if p.is_shorthand() => Ok(ecma::ast::KeyValueProp {
        key: p.clone().shorthand().unwrap().into(),
        value: p.clone().shorthand().unwrap().into(),
      }),
      // TODO: handle spread
      _ => Err(()),
    })
    .map(|p| {
      match p {
        Ok(p) => {
          let (name, span) = match p.key {
            ecma::ast::PropName::Str(s) => (s.value.to_string(), s.span),
            ecma::ast::PropName::Ident(id) => (id.sym.to_string(), id.span),
            ecma::ast::PropName::Num(n) => return Ok((n.value as u32, *p.value)),
            // TODO: handle computed
            _ => return Err(()),
          };
          let name = name.from_case(Case::Camel).to_case(Case::Kebab);

          match CSS_PROPERTY_MAP.get(&name) {
            Some(v) => Ok((*v, *p.value)),
            None => HANDLER.with(|handler| {
              handler
                .struct_span_warn_with_code(
                  span,
                  "Unknown css property, fallbak to SetInlineStyle",
                  DiagnosticId::Lint(EXTRACT_CSS_DIAGNOSTIC_ID.into()),
                )
                .emit();
              Err(())
            }),
          }
        }
        Err(_) => Err(()),
      }
    })
    .collect::<Result<Vec<_>, _>>()
    .unwrap_or(vec![])
}

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

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::{
    common::errors::{ColorConfig, Handler, HANDLER},
    ecma::ast::{Expr, Lit},
    quote_expr,
  };

  #[test]
  fn test_get_inline_style_from_object() {
    let map = get_inline_style_from_object(
      quote_expr!("{ width: '200px', 'height': '100px' }")
        .as_object()
        .unwrap(),
    )
    .into_iter()
    .filter_map(|(key, value)| match value {
      Expr::Lit(Lit::Str(str)) => Some((key, str.value)),
      _ => None,
    })
    .collect::<Vec<_>>();

    let target = vec![(27, "200px".into()), (26, "100px".into())];
    assert_eq!(map, target);
  }

  #[test]
  fn test_get_inline_style_from_object_with_camel() {
    let map = get_inline_style_from_object(
      quote_expr!("{ flexDirection: 'column', 'flex-shrink': 1 }")
        .as_object()
        .unwrap(),
    )
    .into_iter()
    .filter_map(|(key, value)| -> Option<(u32, String)> {
      match value {
        Expr::Lit(Lit::Str(str)) => Some((key, str.value.to_string())),
        Expr::Lit(Lit::Num(num)) => Some((key, num.value.to_string())),
        _ => None,
      }
    })
    .collect::<Vec<_>>();

    let target = vec![(53, "column".into()), (51, "1".into())];
    assert_eq!(map, target);
  }

  #[test]
  fn test_get_inline_style_from_object_with_ident() {
    let map = get_inline_style_from_object(
      quote_expr!("{ width: w, 'height': h, flex }")
        .as_object()
        .unwrap(),
    )
    .into_iter()
    .filter_map(|(key, value)| match value {
      Expr::Ident(ident) => Some((key, ident.sym)),
      Expr::Lit(Lit::Str(str)) => Some((key, str.value)),
      _ => None,
    })
    .collect::<Vec<_>>();

    let target = vec![(27, "w".into()), (26, "h".into()), (49, "flex".into())];
    assert_eq!(map, target);
  }

  #[test]
  fn test_get_inline_style_from_object_with_unknown() {
    HANDLER.set(
      &Handler::with_tty_emitter(ColorConfig::Auto, true, false, None),
      || {
        let map = get_inline_style_from_object(
          quote_expr!("{ width: '200px', invalid: false, height: '100px' }")
            .as_object()
            .unwrap(),
        );
        let target = vec![];
        assert_eq!(map, target);
      },
    )
  }

  #[test]
  fn test_get_inline_style_from_object_with_computed() {
    let map = get_inline_style_from_object(
      quote_expr!("{ width: '200px', [key]: value, height: '100px' }")
        .as_object()
        .unwrap(),
    );
    // TODO: handle computed
    let target = vec![];
    assert_eq!(map, target);
  }

  #[test]
  fn test_get_inline_style_from_object_with_spread() {
    let map = get_inline_style_from_object(
      quote_expr!("{ width: '200px', ...obj, height: '100px' }")
        .as_object()
        .unwrap(),
    );
    // FIXME: support spread
    let target = vec![];
    assert_eq!(map, target);
  }
}
