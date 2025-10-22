use napi_derive::napi;
use swc_core::{
  common::comments::Comments,
  ecma::{ast::*, visit::VisitMut},
};
use swc_plugins_shared::{target_napi::TransformTarget, transform_mode_napi::TransformMode};

use crate::{
  JSXTransformer as CoreJSXTransformer, JSXTransformerConfig as CoreJSXTransformerConfig,
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

impl From<JSXTransformerConfig> for CoreJSXTransformerConfig {
  /// Converts a `JSXTransformerConfig` (public JS-facing config) into a `CoreJSXTransformerConfig`.
  ///
  /// The returned core config copies all corresponding fields from the provided value and
  /// initializes `target_sdk_version` to `None`.
  ///
  /// # Examples
  ///
  /// ```
  /// let js_cfg = JSXTransformerConfig {
  ///     preserve_jsx: true,
  ///     runtime_pkg: "@lynx-js/react".to_string(),
  ///     jsx_import_source: None,
  ///     filename: "src/lib.rs".to_string(),
  ///     target: TransformTarget::LEPUS,
  ///     is_dynamic_component: None,
  /// };
  ///
  /// let core_cfg: CoreJSXTransformerConfig = js_cfg.into();
  /// assert_eq!(core_cfg.preserve_jsx, true);
  /// assert!(core_cfg.target_sdk_version.is_none());
  /// ```
  fn from(val: JSXTransformerConfig) -> Self {
    Self {
      preserve_jsx: val.preserve_jsx,
      runtime_pkg: val.runtime_pkg,
      jsx_import_source: val.jsx_import_source,
      filename: val.filename,
      target: val.target.into(),
      is_dynamic_component: val.is_dynamic_component,
      target_sdk_version: None,
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
      is_dynamic_component: val.is_dynamic_component,
    }
  }
}

pub struct JSXTransformer<C>
where
  C: Comments + Clone,
{
  inner: CoreJSXTransformer<C>,
}

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.inner.content_hash = content_hash;
    self
  }

  pub fn new(cfg: JSXTransformerConfig, comments: Option<C>, mode: TransformMode) -> Self {
    Self {
      inner: CoreJSXTransformer::new(cfg.into(), comments, mode.into()),
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