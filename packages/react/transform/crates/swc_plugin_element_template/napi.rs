use std::{cell::RefCell, rc::Rc};

use napi_derive::napi;
use swc_core::{
  common::{comments::Comments, sync::Lrc, SourceMap},
  ecma::{ast::*, visit::VisitMut},
};
use swc_plugins_shared::{target_napi::TransformTarget, transform_mode_napi::TransformMode};

use crate::{
  ElementTemplateAsset as CoreElementTemplateAsset,
  ElementTemplateTransformer as CoreElementTemplateTransformer,
  ElementTemplateTransformerConfig as CoreElementTemplateTransformerConfig,
  ElementTemplateUISourceMapRecord as CoreElementTemplateUISourceMapRecord,
};

/// @internal
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ElementTemplateAsset {
  /// @internal
  #[napi(js_name = "templateId")]
  pub template_id: String,
  /// @internal
  #[napi(js_name = "compiledTemplate")]
  pub compiled_template: serde_json::Value,
  /// @internal
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
  #[napi(js_name = "templateId")]
  pub template_id: String,
}

impl From<UISourceMapRecord> for CoreElementTemplateUISourceMapRecord {
  fn from(val: UISourceMapRecord) -> Self {
    Self {
      ui_source_map: val.ui_source_map,
      line_number: val.line_number,
      column_number: val.column_number,
      template_id: val.template_id,
    }
  }
}

impl From<CoreElementTemplateUISourceMapRecord> for UISourceMapRecord {
  fn from(val: CoreElementTemplateUISourceMapRecord) -> Self {
    Self {
      ui_source_map: val.ui_source_map,
      filename: String::new(),
      line_number: val.line_number,
      column_number: val.column_number,
      template_id: val.template_id,
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
    }
  }
}

impl From<JSXTransformerConfig> for CoreElementTemplateTransformerConfig {
  fn from(val: JSXTransformerConfig) -> Self {
    Self {
      preserve_jsx: val.preserve_jsx,
      runtime_pkg: val.runtime_pkg,
      jsx_import_source: val.jsx_import_source,
      filename: val.filename,
      target: val.target.into(),
      enable_ui_source_map: val.enable_ui_source_map.unwrap_or(false),
      is_dynamic_component: val.is_dynamic_component,
    }
  }
}

impl From<CoreElementTemplateTransformerConfig> for JSXTransformerConfig {
  fn from(val: CoreElementTemplateTransformerConfig) -> Self {
    Self {
      preserve_jsx: val.preserve_jsx,
      runtime_pkg: val.runtime_pkg,
      jsx_import_source: val.jsx_import_source,
      filename: val.filename,
      target: val.target.into(),
      enable_ui_source_map: Some(val.enable_ui_source_map),
      is_dynamic_component: val.is_dynamic_component,
    }
  }
}

pub struct JSXTransformer<C>
where
  C: Comments + Clone,
{
  inner: CoreElementTemplateTransformer<C>,
  pub ui_source_map_records: Rc<RefCell<Vec<CoreElementTemplateUISourceMapRecord>>>,
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
    let inner = CoreElementTemplateTransformer::new_with_element_templates(
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
    ui_source_map_records: Rc<RefCell<Vec<CoreElementTemplateUISourceMapRecord>>>,
  ) -> Self {
    debug_assert!(
      self.inner.ui_source_map_records.borrow().is_empty(),
      "ElementTemplateTransformer::with_ui_source_map_records must be called before records are captured"
    );
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

pub type ElementTemplateTransformerConfig = JSXTransformerConfig;
pub type ElementTemplateTransformer<C> = JSXTransformer<C>;
