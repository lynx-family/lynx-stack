use std::vec;

use napi::Either as NapiEither;
use napi_derive::napi;
use swc_core::common::comments::Comments;
use swc_core::ecma::{ast::*, visit::VisitMut};

use swc_plugins_shared::target_napi::TransformTarget;

use crate::{
  AddComponentElementConfig as CoreAddComponentElementConfig, CompatVisitor as CoreVisitor,
  CompatVisitorConfig as CoreConfig, DarkModeConfig as CoreDarkModeConfig, Either,
};

#[napi(object)]
#[derive(Clone, Debug)]
pub struct DarkModeConfig {
  /// @public
  /// Theme expression to be used for dark mode
  pub theme_expr: String,
}

impl From<DarkModeConfig> for CoreDarkModeConfig {
  fn from(val: DarkModeConfig) -> Self {
    CoreDarkModeConfig {
      theme_expr: val.theme_expr,
    }
  }
}

impl From<CoreDarkModeConfig> for DarkModeConfig {
  fn from(val: CoreDarkModeConfig) -> Self {
    DarkModeConfig {
      theme_expr: val.theme_expr,
    }
  }
}

impl From<NapiEither<bool, DarkModeConfig>> for Either<bool, CoreDarkModeConfig> {
  fn from(val: NapiEither<bool, DarkModeConfig>) -> Self {
    match val {
      NapiEither::A(a) => Either::A(a),
      NapiEither::B(b) => Either::B(b.into()),
    }
  }
}

impl From<Either<bool, CoreDarkModeConfig>> for NapiEither<bool, DarkModeConfig> {
  fn from(val: Either<bool, CoreDarkModeConfig>) -> Self {
    match val {
      Either::A(a) => NapiEither::A(a),
      Either::B(b) => NapiEither::B(b.into()),
    }
  }
}

fn convert_dark_mode_option(
  val: Option<NapiEither<bool, DarkModeConfig>>,
) -> Option<Either<bool, CoreDarkModeConfig>> {
  val.map(|either| either.into())
}

fn convert_dark_mode_option_back(
  val: Option<Either<bool, CoreDarkModeConfig>>,
) -> Option<NapiEither<bool, DarkModeConfig>> {
  val.map(|either| either.into())
}

/// {@inheritdoc CompatVisitorConfig.addComponentElement}
/// @public
#[napi(object)]
#[derive(Clone, Debug)]
pub struct AddComponentElementConfig {
  /// @public
  /// Whether to only add component element during compilation
  ///
  /// @example
  ///
  /// Note that this only take effects on `Component` imported from {@link CompatVisitorConfig.oldRuntimePkg}.
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         addComponentElement: { compilerOnly: true }
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub compiler_only: bool,
}

impl From<AddComponentElementConfig> for CoreAddComponentElementConfig {
  fn from(val: AddComponentElementConfig) -> Self {
    CoreAddComponentElementConfig {
      compiler_only: val.compiler_only,
    }
  }
}

impl From<CoreAddComponentElementConfig> for AddComponentElementConfig {
  fn from(val: CoreAddComponentElementConfig) -> Self {
    AddComponentElementConfig {
      compiler_only: val.compiler_only,
    }
  }
}

impl From<NapiEither<bool, AddComponentElementConfig>>
  for Either<bool, CoreAddComponentElementConfig>
{
  fn from(val: NapiEither<bool, AddComponentElementConfig>) -> Self {
    match val {
      NapiEither::A(a) => Either::A(a),
      NapiEither::B(b) => Either::B(b.into()),
    }
  }
}

impl From<Either<bool, CoreAddComponentElementConfig>>
  for NapiEither<bool, AddComponentElementConfig>
{
  fn from(val: Either<bool, CoreAddComponentElementConfig>) -> Self {
    match val {
      Either::A(a) => NapiEither::A(a),
      Either::B(b) => NapiEither::B(b.into()),
    }
  }
}

/// {@inheritdoc PluginReactLynxOptions.compat}
/// @public
#[napi(object)]
#[derive(Clone, Debug)]
pub struct CompatVisitorConfig {
  /// @internal
  #[napi(ts_type = "'LEPUS' | 'JS' | 'MIXED'")]
  pub target: TransformTarget,
  /// @public
  /// Specifies the list of component package names that need compatibility processing
  ///
  /// @remarks
  /// Default value: `['@lynx-js/react-components']`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         componentsPkg: ['@my-org/components', '@legacy/ui-kit']
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub components_pkg: Vec<String>,
  /// @public
  /// Specifies the list of old runtime package names that need compatibility processing
  ///
  /// @remarks
  /// Default value: `['@lynx-js/react-runtime']`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         oldRuntimePkg: ['@my-org/runtime', '@legacy/runtime']
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub old_runtime_pkg: Vec<String>,
  /// @public
  /// Specifies the new runtime package name
  ///
  /// @remarks
  /// Default value: `'@lynx-js/react'`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         newRuntimePkg: '@my-org/react'
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub new_runtime_pkg: String,
  /// @public
  /// Specifies additional component attributes list, these attributes will be passed to the wrapped `<view>` instead of the component.
  ///
  /// @remarks
  /// This only takes effect when {@link CompatVisitorConfig.addComponentElement} is enabled.
  ///
  /// Default value: `[]`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         additionalComponentAttributes: ['custom-attr', 'data-special']
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub additional_component_attributes: Vec<String>,
  /// @public
  /// Controls whether to add wrapper elements for components
  ///
  /// @remarks
  /// Default value: `false`
  ///
  /// @example
  ///
  /// Add a `<view>` wrapper element for all components during runtime.
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         addComponentElement: true
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  ///
  /// @example
  ///
  /// Only add component element during compilation.
  /// Note that this only take effects on `Component` imported from {@link CompatVisitorConfig.oldRuntimePkg}.
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         addComponentElement: { compilerOnly: true }
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub add_component_element: NapiEither<bool, AddComponentElementConfig>,
  /// @public
  /// Whether to simplify constructor calls like ReactLynx 2
  ///
  /// @deprecated
  /// Using `simplifyCtorLikeReactLynx2` is not recommended as it introduces implicit behaviors that can:
  ///
  /// - Make code harder to understand and maintain
  ///
  /// - Create hidden dependencies between components
  ///
  /// - Complicate debugging and testing processes
  ///
  /// Instead, use `background-only` on class methods for explicit and maintainable behavior
  ///
  /// @remarks
  /// Default value: `false`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         simplifyCtorLikeReactLynx2: true
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub simplify_ctor_like_react_lynx_2: bool,

  /// @public
  /// Regular expression used to remove component attributes
  ///
  /// @deprecated It's recommended to use `background-only`.
  ///
  /// If your code depends on this switch, when distributing it to other projects through npm packages or other means, you'll also need to enable this switch. This will lead to the proliferation of switches, which is not conducive to code reuse between different projects.
  ///
  /// @remarks
  /// Default value: `None`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         removeComponentAttrRegex: '^data-test-'
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub remove_component_attr_regex: Option<String>,
  /// @public
  /// Whether to disable deprecated warnings
  ///
  /// @remarks
  /// Default value: `false`
  ///
  /// @example
  ///
  /// Disable all the `DEPRECATED:` warnings.
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         disableDeprecatedWarning: true
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub disable_deprecated_warning: bool,
  /// @public
  /// @deprecated
  /// Dark mode configuration
  ///
  /// @remarks
  /// Default value: `None`
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       compat: {
  ///         darkMode: true
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub dark_mode: Option<NapiEither<bool, DarkModeConfig>>,
}

impl Default for CompatVisitorConfig {
  fn default() -> Self {
    CompatVisitorConfig {
      target: TransformTarget::LEPUS,
      components_pkg: vec!["@lynx-js/react-components".into()],
      old_runtime_pkg: vec!["@lynx-js/react-runtime".into()],
      new_runtime_pkg: "@lynx-js/react".into(),
      additional_component_attributes: vec![],
      add_component_element: NapiEither::A(false),
      simplify_ctor_like_react_lynx_2: false,
      remove_component_attr_regex: None,
      disable_deprecated_warning: false,
      dark_mode: None,
    }
  }
}

impl From<CompatVisitorConfig> for CoreConfig {
  fn from(val: CompatVisitorConfig) -> Self {
    CoreConfig {
      target: val.target.into(),
      components_pkg: val.components_pkg,
      old_runtime_pkg: val.old_runtime_pkg,
      new_runtime_pkg: val.new_runtime_pkg,
      additional_component_attributes: val.additional_component_attributes,
      add_component_element: val.add_component_element.into(),
      simplify_ctor_like_react_lynx_2: val.simplify_ctor_like_react_lynx_2,
      remove_component_attr_regex: val.remove_component_attr_regex,
      disable_deprecated_warning: val.disable_deprecated_warning,
      dark_mode: convert_dark_mode_option(val.dark_mode),
    }
  }
}

impl From<CoreConfig> for CompatVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    CompatVisitorConfig {
      target: val.target.into(),
      components_pkg: val.components_pkg,
      old_runtime_pkg: val.old_runtime_pkg,
      new_runtime_pkg: val.new_runtime_pkg,
      additional_component_attributes: val.additional_component_attributes,
      add_component_element: val.add_component_element.into(),
      simplify_ctor_like_react_lynx_2: val.simplify_ctor_like_react_lynx_2,
      remove_component_attr_regex: val.remove_component_attr_regex,
      disable_deprecated_warning: val.disable_deprecated_warning,
      dark_mode: convert_dark_mode_option_back(val.dark_mode),
    }
  }
}

pub struct CompatVisitor<C>
where
  C: Comments + Clone,
{
  inner: CoreVisitor<C>,
}

impl<C> Default for CompatVisitor<C>
where
  C: Comments + Clone,
{
  fn default() -> Self {
    CompatVisitor::new(Default::default(), None)
  }
}

impl<C> CompatVisitor<C>
where
  C: Comments + Clone,
{
  pub fn new(cfg: CompatVisitorConfig, comments: Option<C>) -> Self {
    Self {
      inner: CoreVisitor::new(cfg.into(), comments),
    }
  }
}

impl<C> VisitMut for CompatVisitor<C>
where
  C: Comments + Clone,
{
  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    self.inner.visit_mut_module_items(n);
  }

  fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
    self.inner.visit_mut_import_decl(n);
  }

  fn visit_mut_ident(&mut self, n: &mut Ident) {
    self.inner.visit_mut_ident(n);
  }

  fn visit_mut_expr(&mut self, n: &mut Expr) {
    self.inner.visit_mut_expr(n);
  }

  fn visit_mut_jsx_element_child(&mut self, child: &mut JSXElementChild) {
    self.inner.visit_mut_jsx_element_child(child);
  }

  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    self.inner.visit_mut_jsx_element(n);
  }

  fn visit_mut_jsx_attr(&mut self, n: &mut JSXAttr) {
    self.inner.visit_mut_jsx_attr(n);
  }

  fn visit_mut_jsx_element_name(&mut self, name: &mut JSXElementName) {
    self.inner.visit_mut_jsx_element_name(name);
  }

  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    self.inner.visit_mut_call_expr(n);
  }

  fn visit_mut_class(&mut self, n: &mut Class) {
    self.inner.visit_mut_class(n);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n);
  }
}
