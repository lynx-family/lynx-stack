use std::{collections::HashSet, fmt::Debug};

use napi_derive::napi;
use serde_json::Value;
use swc_core::{
  common::{
    comments::{Comment, CommentKind, Comments},
    errors::HANDLER,
    util::take::Take,
    Spanned, DUMMY_SP,
  },
  ecma::{
    ast::*,
    utils::{calc_literal_cost, prepend_stmt},
    visit::{VisitMut, VisitMutWith},
  },
};

use crate::utils::jsonify;

#[napi(object)]
#[derive(Clone, Debug)]
pub struct DynamicImportVisitorConfig {
  /// @internal
  pub runtime_pkg: String,
  /// @internal
  pub layer: String,
}

impl Default for DynamicImportVisitorConfig {
  fn default() -> Self {
    DynamicImportVisitorConfig {
      layer: "".into(),
      runtime_pkg: "@lynx-js/react/internal".into(),
    }
  }
}

pub struct DynamicImportVisitor<C>
where
  C: Comments,
{
  opts: DynamicImportVisitorConfig,
  named_imports: HashSet<Ident>,
  comments: Option<C>,
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
      named_imports: HashSet::new(),
    }
  }
}

fn is_import_call_str_lit(call_expr: &CallExpr) -> (bool, bool, &str) {
  match &call_expr.callee {
    Callee::Import(_) if call_expr.args.len() >= 1 => match &*call_expr.args[0].expr {
      Expr::Lit(Lit::Str(Str { value, .. })) => (true, true, value),
      Expr::Lit(_) => (true, false, ""),
      _ => (false, false, ""),
    },
    _ => (false, false, ""),
  }
}

fn is_import_call_tpl(call_expr: &CallExpr) -> bool {
  match &call_expr.callee {
    Callee::Import(_) if call_expr.args.len() >= 1 => match &*call_expr.args[0].expr {
      Expr::Tpl(_) => true,
      _ => false,
    },
    _ => false,
  }
}

fn is_import_call_with_type(call_expr: &CallExpr) -> (bool, bool, Value) {
  match &call_expr.callee {
    Callee::Import(_) if call_expr.args.len() >= 2 => match &*call_expr.args[1].expr {
      Expr::Object(object) => {
        let (is_lit, _) = calc_literal_cost(object, false);
        if is_lit {
          let with = jsonify(Expr::Object(object.clone()));
          match with.pointer("/with/type") {
            Some(value) => (true, true, value.clone()),
            _ => (true, false, Value::Null),
          }
        } else {
          (true, false, Value::Null)
        }
      }
      _ => (true, false, Value::Null),
    },
    _ => (false, false, Value::Null),
  }
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

    if call_expr.args.len() == 0 {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(
            call_expr.span,
            format!("`import()` with no argument is not allowed").as_str(),
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
    let (has_option, is_import_call_with_type, _with_type) = is_import_call_with_type(call_expr);

    // TODO: reject dynamic import without `{ with: { type: "component" } }`

    if is_import_call_lit && !is_import_call_str_lit {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(
            call_expr.span,
            format!("`import(...)` call with non-string literal module id is not allowed").as_str(),
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
      if has_option && !is_import_call_with_type {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              call_expr.span,
              format!("`import(\"...\", ...)` with invalid options is not allowed").as_str(),
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

    if self.named_imports.len() > 0 {
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
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          phase: ImportPhase::Evaluation,
          specifiers: vec![],
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: format!("{}/experimental/lazy/import", self.opts.runtime_pkg)
              .replace("/internal", "")
              .into(),
          }),
          type_only: Default::default(),
          with: Default::default(),
        })),
      );
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
        ..Default::default()
      },
      Some(t.comments.clone())
    )),
    should_transform_import_call,
    r#"
    (async function () {
      await import("./index.js");
      await import(`./locales/${name}`);
      await import("ftp://www/a.js");
      await import("https://www/a.js");
      await import(url);
      await import(url+"?v=1.0");

      await import("./index.js", { with: { type: "component" } });
      await import("ftp://www/a.js", { with: { type: "component" } });
      await import("https://www/a.js", { with: { type: "component" } });
      await import(url, { with: { type: "component" } });
      await import(url+"?v=1.0", { with: { type: "component" } });
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
      await import("./index.js");
      await import(`./locales/${name}`);
      await import("ftp://www/a.js");

      await import("./index.js", { with: { type: "component" } });
      await import("ftp://www/a.js", { with: { type: "component" } });
    })();
    "#
  );
}
