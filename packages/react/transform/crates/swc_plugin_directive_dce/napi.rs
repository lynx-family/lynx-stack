use napi_derive::napi;
use std::fmt::Debug;
use swc_core::ecma::{ast::*, visit::VisitMut};

use crate::{DirectiveDCEVisitor as CoreVisitor, DirectiveDCEVisitorConfig as CoreConfig};
use swc_plugins_shared::target_napi::TransformTarget;

#[napi(object)]
#[derive(Clone, Debug)]
pub struct DirectiveDCEVisitorConfig {
  /// @internal
  #[napi(ts_type = "'LEPUS' | 'JS' | 'MIXED'")]
  pub target: TransformTarget,
  /// When `true` on the `LEPUS` target, empties the render body of every
  /// component while keeping the module-scope snapshot and worklet
  /// definitions — the compile-time half of a root-level `<Background>`
  /// (0.0 first screen), so component render logic never reaches the
  /// main-thread bundle without per-component annotation.
  /// @internal
  pub strip_all_components: Option<bool>,
}

impl Default for DirectiveDCEVisitorConfig {
  fn default() -> Self {
    DirectiveDCEVisitorConfig {
      target: TransformTarget::MIXED,
      strip_all_components: None,
    }
  }
}

impl From<DirectiveDCEVisitorConfig> for CoreConfig {
  fn from(val: DirectiveDCEVisitorConfig) -> Self {
    CoreConfig {
      target: val.target.into(),
      strip_all_components: val.strip_all_components.unwrap_or(false),
    }
  }
}

impl From<CoreConfig> for DirectiveDCEVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    DirectiveDCEVisitorConfig {
      target: val.target.into(),
      strip_all_components: Some(val.strip_all_components),
    }
  }
}

pub struct DirectiveDCEVisitor {
  inner: CoreVisitor,
}

impl DirectiveDCEVisitor {
  pub fn new(cfg: DirectiveDCEVisitorConfig) -> Self {
    Self {
      inner: CoreVisitor::new(cfg.into()),
    }
  }
}

impl VisitMut for DirectiveDCEVisitor {
  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    self.inner.visit_mut_class_member(n)
  }
  fn visit_mut_fn_decl(&mut self, n: &mut FnDecl) {
    self.inner.visit_mut_fn_decl(n)
  }
  fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
    self.inner.visit_mut_arrow_expr(arrow)
  }
  fn visit_mut_fn_expr(&mut self, n: &mut FnExpr) {
    self.inner.visit_mut_fn_expr(n)
  }
  // The module/script hooks let the core visitor flush the keep-alive
  // statement that carries the component references of every body it emptied
  // (see `KEEP_COMPONENT_REFS_PROBE`). Forwarding them also roots the whole
  // traversal in the core visitor, so its visit methods see the same tree the
  // wasm plugin (which uses the core visitor directly) sees.
  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n)
  }
  fn visit_mut_script(&mut self, n: &mut Script) {
    self.inner.visit_mut_script(n)
  }
}
