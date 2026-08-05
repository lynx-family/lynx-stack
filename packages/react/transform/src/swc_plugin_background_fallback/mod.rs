// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

//! Compile-time folding of `<Background>` on the main-thread (LEPUS) target.
//!
//! `<Background fallback={F}>{C}</Background>` renders `F` on the main thread
//! and `C` on the background thread — that is the component's runtime
//! semantics. When the main thread compiles no business code of its own
//! (`experimental_enableMTSRendering: false`), the *reference* to `C` is what keeps the
//! whole app in the main-thread module graph, so the same decision is made
//! here at compile time instead:
//!
//! ```text
//! <Background fallback={<Skeleton/>}><App/></Background>   =>   <Skeleton/>
//! ```
//!
//! The `<App/>` reference is gone, so the bundler drops its module closure
//! from the main-thread bundle, while `<Skeleton/>` — and everything it
//! references — stays and is compiled for the main thread exactly like any
//! other component. That is what lets a fallback contain user components:
//! the fallback is *real main-thread code*, not a static template.
//!
//! The fold is purely syntactic. It rewrites every `<Background>` bound to an
//! import from `@lynx-js/react`, wherever it appears, and never infers
//! anything from the shape of the surrounding tree — a nested `<Background>`
//! folds to its own fallback for the same reason, and a `<page>` (or any
//! other) host wrapper around it is left untouched.
//!
//! Anything this pass cannot resolve statically is a build error rather than
//! a silent fold: the main thread rendering nothing is a far worse failure to
//! debug than a message at compile time.

use swc_core::common::errors::HANDLER;
use swc_core::common::{Spanned, DUMMY_SP};
use swc_core::ecma::ast::{
  Expr, ImportDecl, ImportSpecifier, JSXAttrName, JSXAttrOrSpread, JSXAttrValue, JSXElement,
  JSXElementChild, JSXElementName, JSXExpr, JSXExprContainer, Lit, Module, ModuleDecl, ModuleItem,
  Null, Script,
};
use swc_core::ecma::atoms::Atom;
use swc_core::ecma::visit::{VisitMut, VisitMutWith};

const BACKGROUND: &str = "Background";
const RUNTIME_PKG: &str = "@lynx-js/react";

/// Folds `<Background>` to its `fallback` on the main-thread target.
#[derive(Default)]
pub struct BackgroundFallbackVisitor {
  /// Local names a named `Background` import is bound to
  /// (`import { Background as B }` binds `B`).
  named_bindings: Vec<Atom>,
  /// Local names of default/namespace imports of the runtime package, for
  /// `<ReactLynx.Background>` member-expression usage.
  namespace_bindings: Vec<Atom>,
}

impl BackgroundFallbackVisitor {
  pub fn new() -> Self {
    Self::default()
  }

  fn collect_import(&mut self, import: &ImportDecl) {
    if !is_runtime_package(import.src.value.as_str().unwrap_or_default()) {
      return;
    }
    for specifier in &import.specifiers {
      match specifier {
        ImportSpecifier::Named(named) => {
          // The *imported* name decides, the local name is what we match on.
          let imported = match &named.imported {
            Some(name) => match name {
              swc_core::ecma::ast::ModuleExportName::Ident(ident) => ident.sym.clone(),
              swc_core::ecma::ast::ModuleExportName::Str(s) => {
                Atom::from(s.value.as_str().unwrap_or_default())
              }
            },
            None => named.local.sym.clone(),
          };
          if imported == BACKGROUND {
            self.named_bindings.push(named.local.sym.clone());
          }
        }
        ImportSpecifier::Default(default) => {
          self.namespace_bindings.push(default.local.sym.clone());
        }
        ImportSpecifier::Namespace(ns) => {
          self.namespace_bindings.push(ns.local.sym.clone());
        }
      }
    }
  }

  fn is_background(&self, name: &JSXElementName) -> bool {
    match name {
      JSXElementName::Ident(ident) => self.named_bindings.contains(&ident.sym),
      JSXElementName::JSXMemberExpr(member) => {
        if member.prop.sym != BACKGROUND {
          return false;
        }
        match &member.obj {
          swc_core::ecma::ast::JSXObject::Ident(ident) => {
            self.namespace_bindings.contains(&ident.sym)
          }
          swc_core::ecma::ast::JSXObject::JSXMemberExpr(_) => false,
        }
      }
      JSXElementName::JSXNamespacedName(_) => false,
    }
  }

  /// The expression a `<Background>` folds to: its `fallback`, or `null`.
  ///
  /// Returns `None` when the element is not a `<Background>` at all.
  fn fold_to_fallback(&self, element: &JSXElement) -> Option<Box<Expr>> {
    if !self.is_background(&element.opening.name) {
      return None;
    }

    let mut fallback: Option<Box<Expr>> = None;
    for attr in &element.opening.attrs {
      match attr {
        JSXAttrOrSpread::JSXAttr(attr) => {
          let is_fallback = match &attr.name {
            JSXAttrName::Ident(ident) => ident.sym == "fallback",
            JSXAttrName::JSXNamespacedName(_) => false,
          };
          if !is_fallback {
            continue;
          }
          fallback = Some(match &attr.value {
            Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
              expr: JSXExpr::Expr(expr),
              ..
            })) => expr.clone(),
            // `fallback={}` — an empty container renders nothing.
            Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
              expr: JSXExpr::JSXEmptyExpr(_),
              ..
            }))
            | None => null_expr(),
            Some(JSXAttrValue::Str(s)) => Box::new(Expr::Lit(Lit::Str(s.clone()))),
            Some(JSXAttrValue::JSXElement(element)) => Box::new(Expr::JSXElement(element.clone())),
            Some(JSXAttrValue::JSXFragment(fragment)) => {
              Box::new(Expr::JSXFragment(fragment.clone()))
            }
          });
        }
        JSXAttrOrSpread::SpreadElement(spread) => {
          // A spread may carry `fallback`, and which one wins depends on the
          // runtime value. Folding either way would be a guess.
          HANDLER.with(|handler| {
            handler
              .struct_span_err(
                spread.span(),
                "`experimental_enableMTSRendering: false` does not support a spread on \
                 `<Background>`: the \
                 main thread compiles no business code, so its `fallback` has to be resolvable \
                 at compile time. Pass `fallback` as an explicit attribute.",
              )
              .emit();
          });
          return Some(null_expr());
        }
      }
    }

    // No `fallback` attribute is the documented degenerate case: the main
    // thread renders nothing until the background hydrates.
    Some(fallback.unwrap_or_else(null_expr))
  }
}

fn is_runtime_package(src: &str) -> bool {
  src == RUNTIME_PKG || src.starts_with(concat!("@lynx-js/react", "/"))
}

fn null_expr() -> Box<Expr> {
  Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP })))
}

impl VisitMut for BackgroundFallbackVisitor {
  fn visit_mut_module(&mut self, module: &mut Module) {
    // Collect every binding first: an import declaration is hoisted, so it
    // may follow the JSX that uses it.
    for item in &module.body {
      if let ModuleItem::ModuleDecl(ModuleDecl::Import(import)) = item {
        self.collect_import(import);
      }
    }
    module.visit_mut_children_with(self);
  }

  fn visit_mut_script(&mut self, script: &mut Script) {
    // A script has no imports, so no `Background` binding can exist.
    script.visit_mut_children_with(self);
  }

  fn visit_mut_expr(&mut self, expr: &mut Expr) {
    if let Expr::JSXElement(element) = expr {
      if let Some(mut folded) = self.fold_to_fallback(element) {
        // Recurse into the replacement: the fallback may itself hold a
        // `<Background>`, which folds to *its* fallback.
        folded.visit_mut_with(self);
        *expr = *folded;
        return;
      }
    }
    expr.visit_mut_children_with(self);
  }

  fn visit_mut_jsx_element_child(&mut self, child: &mut JSXElementChild) {
    if let JSXElementChild::JSXElement(element) = child {
      if let Some(mut folded) = self.fold_to_fallback(element) {
        folded.visit_mut_with(self);
        *child = JSXElementChild::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(folded),
        });
        return;
      }
    }
    child.visit_mut_children_with(self);
  }
}
