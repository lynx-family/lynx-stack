use napi_derive::napi;

use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut};

use crate::{WorkletVisitor as CoreVisitor, WorkletVisitorConfig as CoreConfig};
use swc_plugins_shared::{target_napi::TransformTarget, transform_mode_napi::TransformMode};

#[derive(Clone, Debug)]
#[napi(object)]
pub struct WorkletVisitorConfig {
  /// @public
  /// During the compilation of worklet, when extracting external variable identifiers,
  /// global identifiers available in lepus context need to be ignored.
  /// In addition to the default lepus global identifier list provided by the compiler,
  /// users can customize the global identifier list through this option.
  /// This configuration will take effect together with the default lepus global identifier list.
  pub custom_global_ident_names: Option<Vec<String>>,
  /// @internal
  pub filename: String,
  /// @internal
  #[napi(ts_type = "'LEPUS' | 'JS' | 'MIXED'")]
  pub target: TransformTarget,
  pub runtime_pkg: String,
}

impl Default for WorkletVisitorConfig {
  fn default() -> Self {
    WorkletVisitorConfig {
      filename: "index.js".into(),
      target: TransformTarget::LEPUS,
      custom_global_ident_names: None,
      runtime_pkg: "NoDiff".into(),
    }
  }
}

impl From<WorkletVisitorConfig> for CoreConfig {
  fn from(val: WorkletVisitorConfig) -> Self {
    CoreConfig {
      filename: val.filename,
      target: val.target.into(),
      custom_global_ident_names: val.custom_global_ident_names,
      runtime_pkg: val.runtime_pkg,
    }
  }
}

impl From<CoreConfig> for WorkletVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    WorkletVisitorConfig {
      filename: val.filename,
      target: val.target.into(),
      custom_global_ident_names: val.custom_global_ident_names,
      runtime_pkg: val.runtime_pkg,
    }
  }
}

pub struct WorkletVisitor {
  inner: CoreVisitor,
}

impl Default for WorkletVisitor {
  fn default() -> Self {
    WorkletVisitor::new(TransformMode::Production, WorkletVisitorConfig::default())
  }
}

impl VisitMut for WorkletVisitor {
  noop_visit_mut_type!();

  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    self.inner.visit_mut_class_member(n);
  }

  fn visit_mut_decl(&mut self, n: &mut Decl) {
    self.inner.visit_mut_decl(n);
  }

  fn visit_mut_expr(&mut self, n: &mut Expr) {
    self.inner.visit_mut_expr(n);
  }

  fn visit_mut_module_decl(&mut self, n: &mut ModuleDecl) {
    self.inner.visit_mut_module_decl(n);
  }

  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    self.inner.visit_mut_module_items(n);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n);
  }
}

impl WorkletVisitor {
  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.inner.content_hash = content_hash;
    self
  }

  pub fn new(mode: TransformMode, cfg: WorkletVisitorConfig) -> Self {
    Self {
      inner: CoreVisitor::new(mode.into(), cfg.into()),
    }
  }
}
