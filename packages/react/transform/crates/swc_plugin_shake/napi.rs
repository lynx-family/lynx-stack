use napi_derive::napi;
use swc_core::{ecma::ast::*, ecma::visit::VisitMut};

use crate::{ShakeVisitor as CoreVisitor, ShakeVisitorConfig as CoreConfig};

/// {@inheritdoc PluginReactLynxOptions.shake}
/// @public
#[napi(object)]
#[derive(Clone, Debug)]
pub struct ShakeVisitorConfig {
  /// Package names to identify runtime imports that need to be processed
  ///
  /// @example
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       shake: {
  ///         pkgName: ['@lynx-js/react-runtime']
  ///       }
  ///     })
  ///   ]
  /// })
  /// ```
  ///
  /// @remarks
  /// Default value: `['@lynx-js/react-runtime']`
  /// The provided values will be merged with the default values instead of replacing them.
  /// @public
  pub pkg_name: Vec<String>,

  /// Properties that should be retained in the component class
  ///
  /// @example
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       shake: {
  ///         retainProp: ['myCustomMethod']
  ///       }
  ///     })
  ///   ]
  /// })
  /// ```
  ///
  /// @remarks
  /// Default value: `['constructor', 'render', 'getDerivedStateFromProps', 'state', 'defaultDataProcessor', 'dataProcessors', 'contextType', 'defaultProps']`
  /// The provided values will be merged with the default values instead of replacing them.
  ///
  /// @public
  pub retain_prop: Vec<String>,

  /// Function names whose parameters should be removed during transformation
  ///
  /// @example
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       shake: {
  ///         removeCallParams: ['useMyCustomEffect']
  ///       }
  ///     })
  ///   ]
  /// })
  /// ```
  ///
  /// @remarks
  /// Default value: `['useEffect', 'useLayoutEffect', '__runInJS', 'useLynxGlobalEventListener', 'useImperativeHandle']`
  /// The provided values will be merged with the default values instead of replacing them.
  ///
  /// @public
  pub remove_call_params: Vec<String>,
}

impl Default for ShakeVisitorConfig {
  fn default() -> Self {
    let default_pkg_name = ["@lynx-js/react-runtime"];
    let default_retain_prop = [
      "constructor",
      "render",
      "getDerivedStateFromProps",
      "state",
      "defaultDataProcessor",
      "dataProcessors",
      "contextType",
      "defaultProps",
    ];
    let default_remove_call_params = [
      "useEffect",
      "useLayoutEffect",
      "__runInJS",
      "useLynxGlobalEventListener",
      "useImperativeHandle",
    ];
    ShakeVisitorConfig {
      pkg_name: default_pkg_name.iter().map(|x| x.to_string()).collect(),
      retain_prop: default_retain_prop.iter().map(|x| x.to_string()).collect(),
      remove_call_params: default_remove_call_params
        .iter()
        .map(|x| x.to_string())
        .collect(),
    }
  }
}

impl From<ShakeVisitorConfig> for CoreConfig {
  fn from(val: ShakeVisitorConfig) -> Self {
    CoreConfig {
      pkg_name: val.pkg_name,
      retain_prop: val.retain_prop,
      remove_call_params: val.remove_call_params,
    }
  }
}

impl From<CoreConfig> for ShakeVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    ShakeVisitorConfig {
      pkg_name: val.pkg_name,
      retain_prop: val.retain_prop,
      remove_call_params: val.remove_call_params,
    }
  }
}
pub struct ShakeVisitor {
  inner: CoreVisitor,
}

impl ShakeVisitor {
  pub fn new(cfg: ShakeVisitorConfig) -> Self {
    Self {
      inner: CoreVisitor::new(cfg.into()),
    }
  }
}

impl Default for ShakeVisitor {
  fn default() -> Self {
    ShakeVisitor::new(ShakeVisitorConfig::default())
  }
}

impl VisitMut for ShakeVisitor {
  fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
    self.inner.visit_mut_import_decl(n);
  }

  fn visit_mut_ident(&mut self, n: &mut Ident) {
    self.inner.visit_mut_ident(n);
  }

  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    self.inner.visit_mut_call_expr(n);
  }

  fn visit_mut_class(&mut self, n: &mut Class) {
    self.inner.visit_mut_class(n)
  }

  fn visit_mut_class_members(&mut self, n: &mut Vec<ClassMember>) {
    self.inner.visit_mut_class_members(n);
  }

  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    self.inner.visit_mut_class_member(n);
  }

  fn visit_mut_member_expr(&mut self, n: &mut MemberExpr) {
    self.inner.visit_mut_member_expr(n);
  }
}
