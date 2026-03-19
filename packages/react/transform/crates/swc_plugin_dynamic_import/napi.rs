use std::fmt::Debug;

use napi_derive::napi;
use swc_core::{
  common::comments::Comments,
  ecma::{ast::*, visit::VisitMut},
};

use crate::{DynamicImportVisitor as CoreVisitor, DynamicImportVisitorConfig as CoreConfig};

#[napi(object)]
#[derive(Clone, Debug)]
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

impl From<DynamicImportVisitorConfig> for CoreConfig {
  fn from(val: DynamicImportVisitorConfig) -> Self {
    CoreConfig {
      layer: val.layer,
      runtime_pkg: val.runtime_pkg,
      inject_lazy_bundle: val.inject_lazy_bundle,
    }
  }
}

impl From<CoreConfig> for DynamicImportVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    DynamicImportVisitorConfig {
      layer: val.layer,
      runtime_pkg: val.runtime_pkg,
      inject_lazy_bundle: val.inject_lazy_bundle,
    }
  }
}

pub struct DynamicImportVisitor<C>
where
  C: Comments,
{
  inner: CoreVisitor<C>,
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
  pub fn new(cfg: DynamicImportVisitorConfig, comments: Option<C>) -> Self {
    Self {
      inner: CoreVisitor::new(cfg.into(), comments),
    }
  }
}

impl<C> VisitMut for DynamicImportVisitor<C>
where
  C: Comments,
{
  fn visit_mut_call_expr(&mut self, call_expr: &mut CallExpr) {
    self.inner.visit_mut_call_expr(call_expr);
  }
  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n);
  }
}
