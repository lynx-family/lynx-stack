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
  #[napi(ts_type = "unknown")]
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
      is_dynamic_component: val.is_dynamic_component,
    }
  }
}

pub struct JSXTransformer<C>
where
  C: Comments + Clone,
{
  inner: CoreElementTemplateTransformer<C>,
  element_templates: Rc<RefCell<Vec<CoreElementTemplateAsset>>>,
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
      element_templates,
      inner,
    }
  }

  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.inner.content_hash = content_hash;
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
  fn visit_mut_program(&mut self, node: &mut Program) {
    self.inner.visit_mut_program(node)
  }

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
