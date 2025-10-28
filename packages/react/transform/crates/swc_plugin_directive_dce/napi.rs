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
}

impl Default for DirectiveDCEVisitorConfig {
  fn default() -> Self {
    DirectiveDCEVisitorConfig {
      target: TransformTarget::MIXED,
    }
  }
}

impl From<DirectiveDCEVisitorConfig> for CoreConfig {
  fn from(val: DirectiveDCEVisitorConfig) -> Self {
    CoreConfig {
      target: val.target.into(),
    }
  }
}

impl From<CoreConfig> for DirectiveDCEVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    DirectiveDCEVisitorConfig {
      target: val.target.into(),
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
}
