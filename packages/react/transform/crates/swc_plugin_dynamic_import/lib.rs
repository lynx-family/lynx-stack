use once_cell::sync::Lazy;
use serde::Deserialize;
use serde_json::Value;
use std::{
  borrow::Cow,
  collections::{HashMap, HashSet},
  fmt::Debug,
};
use swc_core::{
  common::{
    comments::{Comment, CommentKind, Comments},
    errors::HANDLER,
    util::take::Take,
    Spanned, DUMMY_SP,
  },
  ecma::{
    ast::*,
    atoms::once_cell,
    utils::{calc_literal_cost, prepend_stmt, private_ident},
    visit::{VisitMut, VisitMutWith},
  },
};

use swc_plugins_shared::utils::jsonify;

#[cfg(feature = "napi")]
pub mod napi;

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DynamicImportVisitorConfig {
  /// @internal
  pub runtime_pkg: String,
  /// @internal
  pub layer: String,
  /// @internal
  pub inject_lazy_bundle: Option<bool>,
}

impl Default for DynamicImportVisitorConfig {
  fn default() -> Self {
    DynamicImportVisitorConfig {
      layer: "".into(),
      runtime_pkg: "@lynx-js/react/internal".into(),
      inject_lazy_bundle: Some(true),
    }
  }
}

pub struct DynamicImportVisitor<C>
where
  C: Comments,
{
  opts: DynamicImportVisitorConfig,
  has_inner_lazy_bundle: bool,
  named_imports: HashSet<Ident>,
  comments: Option<C>,
  with_mode: Lazy<Expr>,
}

impl<C> Default for DynamicImportVisitor<C>
where
  C: Comments,
{
  fn default() -> Self {
    DynamicImportVisitor::new(Default::default(), None)
  }
}

impl<C> DynamicImportVisitor<C>
where
  C: Comments,
{
  pub fn new(opts: DynamicImportVisitorConfig, comments: Option<C>) -> Self {
    DynamicImportVisitor {
      opts,
      comments,
      has_inner_lazy_bundle: false,
      named_imports: HashSet::new(),
      with_mode: Lazy::new(|| Expr::Ident(private_ident!("withLazyBundleMode"))),
    }
  }
}

fn is_import_call_str_lit(call_expr: &CallExpr) -> (bool, bool, Cow<'_, str>) {
  match &call_expr.callee {
    Callee::Import(_) if !call_expr.args.is_empty() => match &*call_expr.args[0].expr {
      Expr::Lit(Lit::Str(Str { value, .. })) => (true, true, value.to_string_lossy()),
      Expr::Lit(_) => (true, false, Cow::Borrowed("")),
      _ => (false, false, Cow::Borrowed("")),
    },
    _ => (false, false, Cow::Borrowed("")),
  }
}

fn is_import_call_tpl(call_expr: &CallExpr) -> bool {
  match &call_expr.callee {
    Callee::Import(_) if !call_expr.args.is_empty() => {
      matches!(&*call_expr.args[0].expr, Expr::Tpl(_))
    }
    _ => false,
  }
}

fn is_import_call_with_attrs(
  call_expr: &CallExpr,
  attrs: &[&str],
) -> (bool, HashSet<String>, HashMap<String, Value>) {
  let mut with_keys = HashSet::new();
  let mut with_values = HashMap::new();

  match &call_expr.callee {
    Callee::Import(_) if call_expr.args.len() >= 2 => match &*call_expr.args[1].expr {
      Expr::Object(object) => {
        let (is_lit, _) = calc_literal_cost(object, false);
        if is_lit {
          let with = jsonify(Expr::Object(object.clone()));
          for (i, attr) in attrs.iter().enumerate() {
            if let Some(value) = with.pointer(&format!("/with/{attr}")) {
              with_keys.insert(attr.to_string());
              with_values.insert(attr.to_string(), value.clone());
            }
          }
        }
        (true, with_keys, with_values)
      }
      _ => (true, with_keys, with_values),
    },
    _ => (false, with_keys, with_values),
  }
}

fn create_import_decl(name: &str) -> ModuleItem {
  ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
    span: DUMMY_SP,
    phase: ImportPhase::Evaluation,
    specifiers: vec![],
    src: Box::new(Str {
      span: DUMMY_SP,
      raw: None,
      value: name.into(),
    }),
    type_only: Default::default(),
    with: Default::default(),
  }))
}

impl<C> VisitMut for DynamicImportVisitor<C>
where
  C: Comments,
{
  fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
    if !call_expr.callee.is_import() {
      call_expr.visit_mut_children_with(self);
      return;
    }

    if call_expr.args.is_empty() {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(
            call_expr.span,
            "`import()` with no argument is not allowed"
              .to_string()
              .as_str(),
          )
          .emit()
      });
      call_expr.visit_mut_children_with(self);
      return;
    }

    let is_import_template = is_import_call_tpl(call_expr);

    // Webpack/Rspack context import
    // E.g.: import(`./locales/${name}`)
    // We currently ignore these cases(will fallback to webpack chunk-loading)
    // but we would like to support this in the future(maybe after we support `/*#__REACT_LYNX_IGNORE__*/`)
    if is_import_template {
      call_expr.visit_mut_children_with(self);
      return;
    }

    let (is_import_call_lit, is_import_call_str_lit, str_lit) = is_import_call_str_lit(call_expr);
    let attrs = &["type", "mode"];
    let (has_option, with_keys, with_values) = is_import_call_with_attrs(call_expr, attrs);
    let is_import_call_with_allow_attrs = with_keys.iter().any(|k| attrs.contains(&k.as_str()));

    // TODO: reject dynamic import without `{ with: { type: "component" } }`

    if is_import_call_lit && !is_import_call_str_lit {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(
            call_expr.span,
            "`import(...)` call with non-string literal module id is not allowed"
              .to_string()
              .as_str(),
          )
          .emit()
      });
      call_expr.visit_mut_children_with(self);
      return;
    }

    // https://github.com/evanw/esbuild/blob/v0.21.3/internal/resolver/resolver.go#L432
    // esbuild internally handle url which "isExplicitlyExternal" without calling `resolve` hook
    // this is a work-around
    let is_explicitly_external = str_lit.starts_with("https://")
      || str_lit.starts_with("http://")
      || str_lit.starts_with("//");

    if is_import_call_str_lit && !is_explicitly_external {
      if has_option && !is_import_call_with_allow_attrs {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              call_expr.span,
              "`import(\"...\", ...)` with invalid options is not allowed"
                .to_string()
                .as_str(),
            )
            .emit()
        });
        call_expr.visit_mut_children_with(self);
        return;
      }

      self.comments.add_leading(
        call_expr.args[0].span_lo(),
        Comment {
          span: DUMMY_SP,
          kind: CommentKind::Block,
          text: format!("webpackChunkName: \"{}-{}\"", str_lit, self.opts.layer).into(),
        },
      );
      self.has_inner_lazy_bundle = true;

      if with_values.contains_key("mode") {
        let mode = with_values.get("mode").unwrap();
        if let Value::String(mode) = mode {
          let inner = call_expr.take();
          let arrow = ArrowExpr {
            span: DUMMY_SP,
            ctxt: Default::default(),
            params: vec![],
            body: Box::new(BlockStmtOrExpr::Expr(Box::new(Expr::Call(inner.clone())))),
            is_async: false,
            is_generator: false,
            type_params: None,
            return_type: None,
          };
          *call_expr = CallExpr {
            span: inner.span,
            ctxt: inner.ctxt,
            callee: Callee::Expr(Box::new(self.with_mode.clone())),
            args: vec![
              ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Lit(Lit::Str(Str {
                  span: DUMMY_SP,
                  value: mode.to_string().into(),
                  raw: None,
                }))),
              },
              ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Arrow(arrow)),
              },
            ],
            type_args: None,
          };
          return;
        } else {
          HANDLER.with(|handler| {
            handler
              .struct_span_err(
                call_expr.span,
                "`import(..., { mode: ... })` mode must be a string"
                  .to_string()
                  .as_str(),
              )
              .emit()
          });
          call_expr.visit_mut_children_with(self);
          return;
        }
      }
    } else {
      let ident: Ident = "__dynamicImport".into();
      *call_expr = CallExpr {
        ctxt: call_expr.ctxt,
        span: call_expr.span,
        callee: Callee::Expr(Box::new(Expr::Ident(ident.clone()))),
        args: call_expr.args.take(),
        type_args: None,
      };
      self.named_imports.insert(ident);
    }

    call_expr.visit_mut_children_with(self);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    n.visit_mut_children_with(self);

    if !self.named_imports.is_empty() {
      prepend_stmt(
        &mut n.body,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          phase: ImportPhase::Evaluation,
          span: DUMMY_SP,
          specifiers: self
            .named_imports
            .iter()
            .map(|imported| {
              ImportSpecifier::Named(ImportNamedSpecifier {
                span: DUMMY_SP,
                is_type_only: false,
                local: imported.clone(),
                imported: None,
              })
            })
            .collect::<Vec<_>>(),
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: self.opts.runtime_pkg.clone().into(),
          }),
          type_only: Default::default(),
          with: Default::default(),
        })),
      );

      prepend_stmt(
        &mut n.body,
        create_import_decl(
          &format!("{}/experimental/lazy/import", self.opts.runtime_pkg).replace("/internal", ""),
        ),
      );
    }
    if match self.opts.inject_lazy_bundle {
      Some(true) => true,
      Some(false) => false,
      None => true,
    } && self.has_inner_lazy_bundle
    {
      prepend_stmt(
        &mut n.body,
        create_import_decl("data:text/javascript;charset=utf-8,import { loadLazyBundle } from \"@lynx-js/react/internal\";lynx.loadLazyBundle = loadLazyBundle;"),
      );
    }

    if let Some(Expr::Ident(with_mode)) = Lazy::<Expr>::get(&self.with_mode) {
      prepend_stmt(
        &mut n.body,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          specifiers: vec![ImportSpecifier::Named(ImportNamedSpecifier {
            span: DUMMY_SP,
            local: with_mode.clone(),
            imported: None,
            is_type_only: false,
          })],
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: "@lynx-js/react/internal".into(),
          }),
          type_only: Default::default(),
          // asserts: Default::default(),
          with: Default::default(),
          phase: ImportPhase::Evaluation,
        })),
      )
    }
  }
}

#[cfg(test)]
mod tests {
  use swc_core::ecma::{
    parser::{EsSyntax, Syntax},
    transforms::testing::test,
    visit::visit_mut_pass,
  };

  use super::{DynamicImportVisitor, DynamicImportVisitorConfig};

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(DynamicImportVisitor::new(
      DynamicImportVisitorConfig {
        layer: "test".into(),
        inject_lazy_bundle: Some(false),
        ..Default::default()
      },
      Some(t.comments.clone())
    )),
    should_transform_import_call,
    r#"
    (async function () {
      await import("./index.js");
      await import("./index.js", { with: { mode: "sync" } });
      await import("./index.js", { with: { mode: "async" } });
      await import(`./locales/${name}`);
      await import("ftp://www/a.js");
      await import("https://www/a.js");
      await import(url);
      await import(url+"?v=1.0");

      await import("./index.js", { with: { type: "component" } });
      await import("./index.js", { with: { type: "component", mode: "sync" } });
      await import("./index.js", { with: { type: "component", mode: "async" } });
      await import("ftp://www/a.js", { with: { type: "component" } });
      await import("https://www/a.js", { with: { type: "component" } });
      await import("https://www/a.js", { with: { type: "component", mode: "sync" } });
      await import("https://www/a.js", { with: { type: "component", mode: "async" } });
      await import(url, { with: { type: "component" } });
      await import(url, { with: { type: "component", mode: "sync" } });
      await import(url, { with: { type: "component", mode: "async" } });
      await import(url+"?v=1.0", { with: { type: "component" } });
      await import(url+"?v=1.0", { with: { type: "component", mode: "sync" } });
      await import(url+"?v=1.0", { with: { type: "component", mode: "async" } });
    })();
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(DynamicImportVisitor::new(
      DynamicImportVisitorConfig {
        layer: "test".into(),
        ..Default::default()
      },
      Some(t.comments.clone())
    )),
    should_import_lazy_import,
    r#"
    (async function () {
      await import("https://www/a.js", { with: { type: "component" } });
    })();
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(DynamicImportVisitor::new(
      DynamicImportVisitorConfig {
        layer: "test".into(),
        ..Default::default()
      },
      Some(t.comments.clone())
    )),
    should_import_lazy_bundle,
    r#"
    (async function () {
      await import("./index.js");
    })();
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(DynamicImportVisitor::new(
      DynamicImportVisitorConfig {
        layer: "test".into(),
        ..Default::default()
      },
      Some(t.comments.clone())
    )),
    should_not_import_lazy,
    r#"
    (async function () {
      await import(`./locales/${name}`);
    })();
    "#
  );
}
