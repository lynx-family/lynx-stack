use std::{cell::RefCell, rc::Rc};

use napi_derive::napi;
use swc_core::{
  common::{comments::Comments, sync::Lrc, SourceMap},
  ecma::{ast::*, visit::VisitMut},
};
use swc_plugins_shared::{target_napi::TransformTarget, transform_mode_napi::TransformMode};

use crate::{
  JSXTransformer as CoreJSXTransformer, JSXTransformerConfig as CoreJSXTransformerConfig,
  NodeIndexRecord as CoreNodeIndexRecord,
};

/// @internal
#[napi(object)]
#[derive(Clone, Debug)]
pub struct JSXTransformerConfig {
  /// @internal
  pub preserve_jsx: bool,
  /// @internal
  pub runtime_pkg: String,
  /// @internal
  pub jsx_import_source: Option<String>,
  /// @internal
  pub filename: String,
  /// @internal
  #[napi(ts_type = "'LEPUS' | 'JS' | 'MIXED'")]
  pub target: TransformTarget,
  /// @internal
  pub enable_node_index: bool,
  /// @internal
  pub is_dynamic_component: Option<bool>,
}

/// @internal
#[napi(object)]
#[derive(Clone, Debug)]
pub struct NodeIndexRecord {
  pub node_index: u32,
  pub filename: String,
  pub line_number: u32,
  pub column_number: u32,
  pub snapshot_id: String,
}

impl From<NodeIndexRecord> for CoreNodeIndexRecord {
  fn from(val: NodeIndexRecord) -> Self {
    Self {
      node_index: val.node_index,
      filename: val.filename,
      line_number: val.line_number,
      column_number: val.column_number,
      snapshot_id: val.snapshot_id,
    }
  }
}

impl From<CoreNodeIndexRecord> for NodeIndexRecord {
  fn from(val: CoreNodeIndexRecord) -> Self {
    Self {
      node_index: val.node_index,
      filename: val.filename,
      line_number: val.line_number,
      column_number: val.column_number,
      snapshot_id: val.snapshot_id,
    }
  }
}

impl Default for JSXTransformerConfig {
  fn default() -> Self {
    Self {
      preserve_jsx: false,
      runtime_pkg: "@lynx-js/react".into(),
      jsx_import_source: Some("@lynx-js/react".into()),
      filename: Default::default(),
      target: TransformTarget::LEPUS,
      enable_node_index: false,
      is_dynamic_component: Some(false),
    }
  }
}

impl From<JSXTransformerConfig> for CoreJSXTransformerConfig {
  fn from(val: JSXTransformerConfig) -> Self {
    Self {
      preserve_jsx: val.preserve_jsx,
      runtime_pkg: val.runtime_pkg,
      jsx_import_source: val.jsx_import_source,
      filename: val.filename,
      target: val.target.into(),
      enable_node_index: val.enable_node_index,
      is_dynamic_component: val.is_dynamic_component,
    }
  }
}

impl From<CoreJSXTransformerConfig> for JSXTransformerConfig {
  fn from(val: CoreJSXTransformerConfig) -> Self {
    Self {
      preserve_jsx: val.preserve_jsx,
      runtime_pkg: val.runtime_pkg,
      jsx_import_source: val.jsx_import_source,
      filename: val.filename,
      target: val.target.into(),
      enable_node_index: val.enable_node_index,
      is_dynamic_component: val.is_dynamic_component,
    }
  }
}

pub struct JSXTransformer<C>
where
  C: Comments + Clone,
{
  inner: CoreJSXTransformer<C>,
  pub node_index_records: Rc<RefCell<Vec<CoreNodeIndexRecord>>>,
}

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.inner.content_hash = content_hash;
    self
  }

  pub fn with_node_index_records(
    mut self,
    node_index_records: Rc<RefCell<Vec<CoreNodeIndexRecord>>>,
  ) -> Self {
    self.inner.node_index_records = node_index_records.clone();
    self.node_index_records = node_index_records;
    self
  }

  pub fn new(
    cfg: JSXTransformerConfig,
    comments: Option<C>,
    mode: TransformMode,
    source_map: Option<Lrc<SourceMap>>,
  ) -> Self {
    let inner = CoreJSXTransformer::new(cfg.into(), comments, mode.into(), source_map);
    Self {
      node_index_records: inner.node_index_records.clone(),
      inner,
    }
  }
}

impl<C> VisitMut for JSXTransformer<C>
where
  C: Comments + Clone,
{
  fn visit_mut_jsx_element(&mut self, node: &mut JSXElement) {
    self.inner.visit_mut_jsx_element(node)
  }

  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    self.inner.visit_mut_module_items(n)
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n)
  }
}
