use std::{cell::RefCell, rc::Rc};

use napi_derive::napi;
use swc_core::{
  common::{comments::Comments, sync::Lrc, SourceMap},
  ecma::{ast::*, visit::VisitMut},
};
use swc_plugins_shared::{target_napi::TransformTarget, transform_mode_napi::TransformMode};

use crate::{
  ElementTemplateAsset as CoreElementTemplateAsset, JSXTransformer as CoreJSXTransformer,
  JSXTransformerConfig as CoreJSXTransformerConfig, UISourceMapRecord as CoreUISourceMapRecord,
};

/// @internal
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ElementTemplateAsset {
  #[napi(js_name = "templateId")]
  pub template_id: String,
  #[napi(js_name = "compiledTemplate")]
  pub compiled_template: serde_json::Value,
  #[napi(js_name = "sourceFile")]
  pub source_file: String,
}

impl From<CoreElementTemplateAsset> for ElementTemplateAsset {
  fn from(val: CoreElementTemplateAsset) -> Self {
    Self {
      template_id: val.template_id,
      compiled_template: val.compiled_template,
      source_file: val.source_file,
    }
  }
}

/// @internal
#[napi(object)]
#[derive(Clone, Debug)]
pub struct UISourceMapRecord {
  pub ui_source_map: i32,
  pub filename: String,
  pub line_number: u32,
  pub column_number: u32,
  pub snapshot_id: String,
}

impl From<UISourceMapRecord> for CoreUISourceMapRecord {
  fn from(val: UISourceMapRecord) -> Self {
    Self {
      ui_source_map: val.ui_source_map,
      line_number: val.line_number,
      column_number: val.column_number,
      snapshot_id: val.snapshot_id,
    }
  }
}

impl From<CoreUISourceMapRecord> for UISourceMapRecord {
  fn from(val: CoreUISourceMapRecord) -> Self {
    Self {
      ui_source_map: val.ui_source_map,
      filename: String::new(),
      line_number: val.line_number,
      column_number: val.column_number,
      snapshot_id: val.snapshot_id,
    }
  }
}

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
  pub enable_ui_source_map: Option<bool>,
  /// @internal
  pub is_dynamic_component: Option<bool>,
  /// @internal
  pub experimental_enable_element_template: Option<bool>,
}

impl Default for JSXTransformerConfig {
  fn default() -> Self {
    Self {
      preserve_jsx: false,
      runtime_pkg: "@lynx-js/react".into(),
      jsx_import_source: Some("@lynx-js/react".into()),
      filename: Default::default(),
      target: TransformTarget::LEPUS,
      enable_ui_source_map: Some(false),
      is_dynamic_component: Some(false),
      experimental_enable_element_template: None,
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
      enable_ui_source_map: val.enable_ui_source_map.unwrap_or(false),
      is_dynamic_component: val.is_dynamic_component,
      experimental_enable_element_template: val
        .experimental_enable_element_template
        .unwrap_or(false),
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
      enable_ui_source_map: Some(val.enable_ui_source_map),
      is_dynamic_component: val.is_dynamic_component,
      experimental_enable_element_template: Some(val.experimental_enable_element_template),
    }
  }
}

pub struct JSXTransformer<C>
where
  C: Comments + Clone,
{
  inner: CoreJSXTransformer<C>,
  pub ui_source_map_records: Rc<RefCell<Vec<CoreUISourceMapRecord>>>,
  pub element_templates: Rc<RefCell<Vec<CoreElementTemplateAsset>>>,
}

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  pub fn new_with_element_templates(
    cfg: JSXTransformerConfig,
    comments: Option<C>,
    mode: TransformMode,
    source_map: Option<Lrc<SourceMap>>,
    element_templates: Option<Rc<RefCell<Vec<CoreElementTemplateAsset>>>>,
  ) -> Self {
    let element_templates = element_templates.unwrap_or_else(|| Rc::new(RefCell::new(vec![])));
    let inner = CoreJSXTransformer::new_with_element_templates(
      cfg.into(),
      comments,
      mode.into(),
      source_map,
      Some(element_templates.clone()),
    );
    Self {
      ui_source_map_records: inner.ui_source_map_records.clone(),
      element_templates,
      inner,
    }
  }

  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.inner.content_hash = content_hash;
    self
  }

  pub fn with_ui_source_map_records(
    mut self,
    ui_source_map_records: Rc<RefCell<Vec<CoreUISourceMapRecord>>>,
  ) -> Self {
    self.inner.ui_source_map_records = ui_source_map_records.clone();
    self.ui_source_map_records = ui_source_map_records;
    self
  }

  pub fn new(
    cfg: JSXTransformerConfig,
    comments: Option<C>,
    mode: TransformMode,
    source_map: Option<Lrc<SourceMap>>,
  ) -> Self {
    // The napi wrapper always keeps the collector side channel alive so callers can
    // opt into ET asset export without needing a separate constructor shape.
    Self::new_with_element_templates(cfg, comments, mode, source_map, None)
  }

  pub fn take_element_templates(&self) -> Vec<CoreElementTemplateAsset> {
    self.element_templates.borrow_mut().drain(..).collect()
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
