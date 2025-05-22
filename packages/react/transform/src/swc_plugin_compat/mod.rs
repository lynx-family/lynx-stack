use std::vec;

use convert_case::{Case, Casing};
use napi::Either;
use napi_derive::napi;
use once_cell::sync::Lazy;
use regex::Regex;
use swc_core::common::comments::Comments;
use swc_core::common::util::take::Take;
use swc_core::common::Span;
use swc_core::{
  common::{errors::HANDLER, DUMMY_SP},
  ecma::{
    ast::*,
    utils::{prepend_stmt, private_ident},
    visit::{VisitMut, VisitMutWith, VisitWith},
  },
  quote,
};

use crate::target::TransformTarget;

mod is_component_class;
mod simplify_ctor_like_react_lynx_2;

type Stack<T> = Vec<T>;

// Note: Should sync with Lynx/tasm/component_attributes.cc
static COMPONENT_ATTRIBUTES: Lazy<Vec<&str>> = Lazy::new(|| {
  vec![
    "name",
    "style",
    "class",
    "flatten",
    "clip-radius",
    "overlap",
    "user-interaction-enabled",
    "native-interaction-enabled",
    "block-native-event",
    "enableLayoutOnly",
    "cssAlignWithLegacyW3C",
    "intersection-observers",
    "trigger-global-event",
    "exposure-scene",
    "exposure-id",
    "exposure-screen-margin-top",
    "exposure-screen-margin-bottom",
    "exposure-screen-margin-left",
    "exposure-screen-margin-right",
    "focusable",
    "focus-index",
    "accessibility-label",
    "accessibility-element",
    "accessibility-traits",
    "enable-new-animator",
  ]
});

#[napi(object)]
#[derive(Clone, Debug)]
pub struct DarkModeConfig {
  /// @public
  /// Theme expression to be used for dark mode
  pub theme_expr: String,
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
  pub add_component_element: Either<bool, AddComponentElementConfig>,
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
  pub dark_mode: Option<Either<bool, DarkModeConfig>>,
}

impl Default for CompatVisitorConfig {
  fn default() -> Self {
    CompatVisitorConfig {
      target: TransformTarget::LEPUS,
      components_pkg: vec!["@lynx-js/react-components".into()],
      old_runtime_pkg: vec!["@lynx-js/react-runtime".into()],
      new_runtime_pkg: "@lynx-js/react".into(),
      additional_component_attributes: vec![],
      add_component_element: Either::A(false),
      simplify_ctor_like_react_lynx_2: false,
      remove_component_attr_regex: None,
      disable_deprecated_warning: false,
      dark_mode: None,
    }
  }
}

type AddComponentElementState = (
  /*primitive_attrs: */ Vec<JSXAttrOrSpread>,
  /*component_jsx: */ JSXElement,
  /*has_spread: */ bool,
  /*should_handle: */ bool,
);

pub struct CompatVisitor<C>
where
  C: Comments + Clone,
{
  opts: CompatVisitorConfig,

  // state
  is_components_pkg: bool,
  is_old_runtime_pkg: bool,
  is_target_jsx_element: Stack<bool>,
  add_component_element_state: Vec<AddComponentElementState>,
  old_runtime_import_ids: Vec<Id>,
  runtime_id: Lazy<Ident>,
  comments: Option<C>,
  has_component_is: bool,
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
  pub fn new(opts: CompatVisitorConfig, comments: Option<C>) -> Self {
    CompatVisitor {
      opts,
      is_components_pkg: false,
      is_old_runtime_pkg: false,
      old_runtime_import_ids: vec![],
      is_target_jsx_element: vec![],
      add_component_element_state: vec![],
      runtime_id: Lazy::new(|| private_ident!("ReactLynx")),
      comments,
      has_component_is: false,
    }
  }

  fn wrap_with_lynx_component_helper(&mut self, state: AddComponentElementState) -> Expr {
    let (mut primitive_attrs, component_jsx, has_spread, _) = state;

    let spread_ident = Ident::from("__spread");
    if has_spread {
      primitive_attrs.push(JSXAttrOrSpread::SpreadElement(SpreadElement {
        dot3_token: DUMMY_SP,
        expr: Box::new(Expr::Ident(spread_ident.clone())),
      }));
    }

    let children_ident = Ident::from("__c");
    let jsx_name = JSXElementName::Ident(Ident::from("view"));
    let mut snapshot_jsx = JSXElement {
      span: DUMMY_SP,
      opening: JSXOpeningElement {
        span: DUMMY_SP,
        name: jsx_name.clone(),
        attrs: primitive_attrs,
        self_closing: false,
        type_args: None,
      },
      children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Ident(children_ident.clone()))),
      })],
      closing: Some(JSXClosingElement {
        span: DUMMY_SP,
        name: jsx_name,
      }),
    };

    snapshot_jsx.visit_mut_with(self);

    let mut wrap_call = if has_spread {
      quote!(
        "$runtime_id.wrapWithLynxComponent(($children, $spread) => $snapshot_jsx, $component_jsx)" as Expr,
        runtime_id: Ident = self.runtime_id.clone(),
        children: Ident = children_ident,
        spread: Ident = spread_ident,
        snapshot_jsx: Expr = Expr::JSXElement(Box::new(snapshot_jsx)),
        component_jsx: Expr = Expr::JSXElement(Box::new(component_jsx))
      )
    } else {
      quote!(
        "$runtime_id.wrapWithLynxComponent(($children) => $snapshot_jsx, $component_jsx)" as Expr,
        runtime_id: Ident = self.runtime_id.clone(),
        children: Ident = children_ident,
        snapshot_jsx: Expr = Expr::JSXElement(Box::new(snapshot_jsx)),
        component_jsx: Expr = Expr::JSXElement(Box::new(component_jsx))
      )
    };

    wrap_call = match wrap_call {
      Expr::Call(mut call) => {
        let pure_span = Span::dummy_with_cmt();
        self.comments.add_pure_comment(pure_span.lo);
        call.span = pure_span;
        Expr::Call(call)
      }
      _ => unreachable!(),
    };

    wrap_call
  }
}

impl<C> VisitMut for CompatVisitor<C>
where
  C: Comments + Clone,
{
  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    n.retain_mut(|stmt| {
      self.is_components_pkg = false;
      self.is_old_runtime_pkg = false;
      stmt.visit_mut_children_with(self);
      if self.is_components_pkg {
        return false;
      }
      true
    });
  }

  /**
   * Traverse imports, mark whether they come from a specific package
   */
  fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
    if self.opts.components_pkg.contains(&n.src.value.to_string()) {
      if !self.opts.disable_deprecated_warning {
        HANDLER.with(|handler| {
          handler
            .struct_span_warn(
              n.span,
              format!("DEPRECATED: old package \"{}\" is removed", n.src.value).as_str(),
            )
            .emit()
        });
      }

      self.is_components_pkg = true;
    }

    if self.opts.old_runtime_pkg.contains(&n.src.value.to_string()) {
      if !self.opts.disable_deprecated_warning {
        HANDLER.with(|handler| {
          handler
            .struct_span_warn(
              n.span,
              format!(
                "DEPRECATED: old runtime package \"{}\" is changed to \"{}\"",
                n.src.value, self.opts.new_runtime_pkg
              )
              .as_str(),
            )
            .emit()
        });
      }

      n.src = Box::new(Str {
        span: DUMMY_SP,
        raw: None,
        value: format!("{}/legacy-react-runtime", self.opts.new_runtime_pkg.clone()).into(),
      });

      self.is_old_runtime_pkg = true;
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_ident(&mut self, n: &mut Ident) {
    if self.is_components_pkg {
      self.old_runtime_import_ids.push(n.to_id());
    }
    n.visit_mut_children_with(self);
  }

  fn visit_mut_expr(&mut self, n: &mut Expr) {
    match n {
      Expr::JSXElement(_) => match self.opts.add_component_element {
        Either::A(true) => {
          let state = (vec![], JSXElement::dummy(), false, false);
          self.add_component_element_state.push(state);
          n.visit_mut_children_with(self);

          let (primitive_attrs, component_jsx, has_spread, should_handle) =
            self.add_component_element_state.pop().unwrap();

          if should_handle {
            *n = self.wrap_with_lynx_component_helper((
              primitive_attrs,
              component_jsx,
              has_spread,
              should_handle,
            ))
          }
        }
        _ => {
          n.visit_mut_children_with(self);
        }
      },
      _ => {
        n.visit_mut_children_with(self);
      }
    }
  }

  fn visit_mut_jsx_element_child(&mut self, child: &mut JSXElementChild) {
    match child {
      JSXElementChild::JSXElement(_) => match self.opts.add_component_element {
        Either::A(true) => {
          let state = (vec![], JSXElement::dummy(), false, false);
          self.add_component_element_state.push(state);
          child.visit_mut_children_with(self);

          let (primitive_attrs, component_jsx, has_spread, should_handle) =
            self.add_component_element_state.pop().unwrap();

          if should_handle {
            *child = JSXElementChild::JSXExprContainer(JSXExprContainer {
              span: DUMMY_SP,
              expr: JSXExpr::Expr(Box::new(self.wrap_with_lynx_component_helper((
                primitive_attrs,
                component_jsx,
                has_spread,
                should_handle,
              )))),
            });
          }
        }
        _ => {
          child.visit_mut_children_with(self);
        }
      },
      _ => {
        child.visit_mut_children_with(self);
      }
    };
  }

  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    let is_component_is = match &n {
      JSXElement {
        opening: JSXOpeningElement { name, attrs, .. },
        ..
      } => match name {
        JSXElementName::Ident(id) => {
          if id.sym.to_string() == "component" {
            // <component is=? />
            if attrs
              .into_iter()
              .find(|attr| match attr {
                JSXAttrOrSpread::JSXAttr(JSXAttr {
                  name: JSXAttrName::Ident(ident),
                  ..
                }) => ident.sym.to_string() == "is",
                JSXAttrOrSpread::JSXAttr(JSXAttr {
                  name: JSXAttrName::JSXNamespacedName(_),
                  ..
                }) => false,
                JSXAttrOrSpread::SpreadElement(_) => false,
              })
              .is_some()
            {
              true
            } else {
              false
            }
          } else {
            false
          }
        }
        JSXElementName::JSXMemberExpr(_) => false,
        _ => false,
      },
    };

    if is_component_is {
      self.has_component_is = true;
      match &n.opening.name {
        JSXElementName::Ident(_) => {
          n.opening.name = JSXElementName::JSXMemberExpr(JSXMemberExpr {
            obj: JSXObject::Ident(self.runtime_id.clone()),
            prop: private_ident!("__ComponentIsPolyfill").into(),
            span: DUMMY_SP,
          })
        }
        JSXElementName::JSXMemberExpr(_) => unreachable!(),
        JSXElementName::JSXNamespacedName(_) => unreachable!(),
      }
      if !self.opts.disable_deprecated_warning {
        HANDLER.with(|handler| {
                    handler
                        .struct_span_warn(n.span, format!("DEPRECATED: syntax `<component is=? />` is deprecated, use `lazy` and `loadLazyBundle` exported from \"{}\" instead.", self.opts.new_runtime_pkg).as_str())
                        .emit()
                });
      }
    }

    let is_target_jsx_element = match &n {
      JSXElement {
        opening: JSXOpeningElement { name, .. },
        ..
      } => match name {
        JSXElementName::Ident(id) => {
          if self.old_runtime_import_ids.contains(&id.to_id()) {
            // import { View } from "@lynx-js/react-components"
            // <View/>
            true
          } else if id.sym.to_string().to_lowercase() == id.sym.to_string() {
            // lowercase
            // <view/>
            true
          } else {
            false
          }
        }
        _ => false,
      },
    };

    let is_component = match &n {
      JSXElement {
        opening: JSXOpeningElement { name, .. },
        ..
      } => match name {
        JSXElementName::Ident(id) => {
          if self.old_runtime_import_ids.contains(&id.to_id()) {
            // import { View } from "@lynx-js/react-components"
            // <View/>
            false
          } else if id.sym.to_string().to_lowercase() == id.sym.to_string() {
            // lowercase
            // <view/>
            false
          } else {
            true
          }
        }
        JSXElementName::JSXMemberExpr(_) => true,
        _ => false,
      },
    };

    if is_component {
      let mut has_spread = false;
      let mut ignore_this_jsx = false;
      // ignore_this_jsx, default false,
      // if some attr is removeComponentElement={true}, ignore_this_jsx = true
      // if some attr is JSXSpread, ignore_this_jsx = true
      if !matches!(self.opts.add_component_element, Either::A(false)) {
        // we use `iter().rev()` because JSXAttr will override previous SpreadElement
        ignore_this_jsx = n.opening.attrs.iter().rev().any(|attr| match attr {
          JSXAttrOrSpread::JSXAttr(attr) => match (&attr.name, &attr.value) {
            (JSXAttrName::Ident(name), None) => name.sym.to_string() == "removeComponentElement",
            (
              JSXAttrName::Ident(name),
              Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                expr: JSXExpr::Expr(expr),
                ..
              })),
            ) => {
              name.sym.to_string() == "removeComponentElement"
                && match &**expr {
                  Expr::Lit(Lit::Bool(Bool { value, .. })) => *value,
                  _ => false,
                }
            }
            (JSXAttrName::Ident(_), _) => false,
            (JSXAttrName::JSXNamespacedName(_), None) => false,
            (JSXAttrName::JSXNamespacedName(_), Some(_)) => false,
          },
          JSXAttrOrSpread::SpreadElement(spread) => {
            if matches!(
              self.opts.add_component_element,
              Either::B(AddComponentElementConfig {
                compiler_only: true
              })
            ) {
              HANDLER.with(|handler| {
                handler
                  .struct_span_warn(
                    spread.dot3_token,
                    "addComponentElement: component with JSXSpread is ignored to avoid badcase, you can switch addComponentElement.compilerOnly to false to enable JSXSpread support",
                  )
                  .emit()
              });
            } else {
              has_spread = true;
            }
            true
          }
        });

        if matches!(self.opts.add_component_element, Either::A(true)) && has_spread {
          ignore_this_jsx = false;
        }
      }

      if self.opts.target == TransformTarget::LEPUS {
        if let Some(remove_component_attr_regex) = &self.opts.remove_component_attr_regex {
          let re = regex::Regex::new(&remove_component_attr_regex).unwrap();
          n.opening.attrs.retain(|p| {
            if let JSXAttrOrSpread::JSXAttr(JSXAttr { name, .. }) = p {
              if let JSXAttrName::Ident(IdentName { sym, .. }) = name {
                if re.is_match(&sym.as_ref().to_string()) {
                  return false;
                }
              }
            }
            true
          });
        }
      }

      n.opening.attrs.retain(|a| match &a {
        JSXAttrOrSpread::JSXAttr(JSXAttr {
          name: JSXAttrName::Ident(ident),
          ..
        }) => {
          let ident_str = ident.sym.to_string();

          if ident_str == "item-key" {
            HANDLER.with(|handler| {
              handler
                .struct_span_warn(
                  ident.span,
                  "BROKEN: \"item-key\" in component props takes no effect, this may indicate that your code is not fully migrated",
                )
                .emit()
            });

            return false;
          }

          if ident_str == "removeComponentElement" {
            return false;
          }

          true
        }
        _ => true,
      });

      let mut primitive_attrs = vec![];

      if !matches!(self.opts.add_component_element, Either::A(false))
        && !ignore_this_jsx
        && !has_spread
      {
        n.opening.attrs.retain(|a| match &a {
          JSXAttrOrSpread::JSXAttr(attr) => match &attr.name {
            JSXAttrName::Ident(ident) => {
              let ident_str = ident.sym.to_string();

              if COMPONENT_ATTRIBUTES.contains(&ident_str.as_str()) {
                primitive_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                return false;
              }

              if self
                .opts
                .additional_component_attributes
                .contains(&ident_str)
              {
                primitive_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                return false;
              }

              let re1 =
                Regex::new(r"^(global-bind|bind|catch|capture-bind|capture-catch)([A-Za-z]+)$")
                  .unwrap();
              let re2 = Regex::new(r"^data-([A-Za-z]+)$").unwrap();

              if re1.is_match(ident_str.as_str()) || re2.is_match(ident_str.as_str()) {
                primitive_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                return false;
              }

              match ident_str.as_str() {
                                "dataSet" | "data-set" | "className" | "id"  // | 'ref' | "item-key" | "lynx-key" | "key", ref and key should still be bind on Component,
                                => {
                                    primitive_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                                    return false;
                                }
                                _ => {}
                            }

              return true;
            }
            JSXAttrName::JSXNamespacedName(JSXNamespacedName {
              ns: _,
              name,
              span: _,
            }) => {
              let re1 =
                Regex::new(r"^(global-bind|bind|catch|capture-bind|capture-catch)([A-Za-z]+)$")
                  .unwrap();
              if re1.is_match(name.sym.to_string().as_str()) {
                primitive_attrs.push(JSXAttrOrSpread::JSXAttr(attr.clone()));
                return false;
              }
              return true;
            }
          },
          JSXAttrOrSpread::SpreadElement(_) => true,
        });
      }

      self.is_target_jsx_element.push(false);
      n.visit_mut_children_with(self);
      self.is_target_jsx_element.pop();

      if !matches!(self.opts.add_component_element, Either::A(false)) && !ignore_this_jsx {
        // <C /> => <view><C/></view>
        if matches!(
          self.opts.add_component_element,
          Either::B(AddComponentElementConfig {
            compiler_only: true
          })
        ) {
          *n = JSXElement {
            span: Default::default(),
            opening: JSXOpeningElement {
              span: Default::default(),
              name: JSXElementName::Ident(IdentName::new("view".into(), Default::default()).into()),
              self_closing: false,
              attrs: primitive_attrs,
              type_args: None,
            },
            children: vec![JSXElementChild::JSXElement(Box::new(n.clone()))],
            closing: Some(JSXClosingElement {
              span: Default::default(),
              name: JSXElementName::Ident(IdentName::new("view".into(), Default::default()).into()),
            }),
          };

          n.opening.visit_mut_children_with(self);
          n.closing.visit_mut_children_with(self);
        } else {
          let (
            ref mut primitive_attrs_state,
            ref mut component_jsx,
            ref mut has_spread_state,
            ref mut should_handle,
          ) = self.add_component_element_state.last_mut().unwrap();

          *primitive_attrs_state = primitive_attrs;
          *component_jsx = n.take();
          *has_spread_state = has_spread;
          *should_handle = true;
        }
      }
    } else {
      self.is_target_jsx_element.push(is_target_jsx_element);
      n.visit_mut_children_with(self);
      self.is_target_jsx_element.pop();
    }
  }

  fn visit_mut_jsx_attr(&mut self, n: &mut JSXAttr) {
    // change attr name
    // <View onClick={} /> => <View bindtap={} />
    // <View onTouchStart={} /> => <View bindtouchstart={} />

    fn transform_event_name(mut props_key: &str) -> Option<String> {
      if props_key.starts_with("on") {
        let prefix = if props_key.ends_with("Catch") {
          props_key = &props_key[..props_key.len() - 5];
          "catch"
        } else {
          "bind"
        };
        let suffix = if props_key.starts_with("onClick") {
          "tap".into()
        } else {
          props_key[2..].to_lowercase()
        };
        return Some(format!("{}{}", prefix, suffix));
      }
      None
    }

    let warning_transform_event_name = |old_name, new_name| {
      if !self.opts.disable_deprecated_warning {
        HANDLER.with(|handler| {
          handler
            .struct_span_warn(
              n.span,
              format!(
                "DEPRECATED: old event props \"{}\" is changed to \"{}\"",
                old_name, new_name
              )
              .as_str(),
            )
            .emit()
        });
      }
    };

    if *self.is_target_jsx_element.last().unwrap_or(&false) {
      match &n.name {
        JSXAttrName::Ident(id) => {
          if let Some(new_name) = transform_event_name(id.sym.to_string().as_str()) {
            warning_transform_event_name(&id.sym, &new_name);
            n.name = JSXAttrName::Ident(IdentName::new(new_name.into(), id.span));
          }
        }
        JSXAttrName::JSXNamespacedName(JSXNamespacedName { ns, name, span }) => {
          if let Some(new_name) = transform_event_name(name.sym.to_string().as_str()) {
            warning_transform_event_name(&name.sym, &new_name);
            n.name = JSXAttrName::JSXNamespacedName(JSXNamespacedName {
              ns: ns.clone(),
              name: IdentName::new(new_name.into(), name.span).into(),
              span: *span,
            });
          }
        }
      }
    }

    match &n.name {
      JSXAttrName::Ident(id) => {
        if id.sym.to_string() == "lynx-key" {
          if !self.opts.disable_deprecated_warning {
            HANDLER.with(|handler| {
              handler
                .struct_span_warn(id.span, "DEPRECATED: lynx-key is changed to key")
                .emit()
            });
          }

          n.name = JSXAttrName::Ident(IdentName::new("key".into(), id.span));
        }
      }
      JSXAttrName::JSXNamespacedName(_) => {}
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_jsx_element_name(&mut self, name: &mut JSXElementName) {
    match &name {
      JSXElementName::Ident(id) => {
        if *self.is_target_jsx_element.last().unwrap_or(&false) {
          let new_id_str = id
            .sym
            .to_string()
            .from_case(Case::UpperCamel)
            .to_case(Case::Kebab);

          if new_id_str != id.sym.to_string() {
            if !self.opts.disable_deprecated_warning {
              HANDLER.with(|handler| {
                handler
                  .struct_span_warn(
                    id.span,
                    format!(
                      "DEPRECATED: old JSXElementName \"{}\" is changed to \"{}\"",
                      id.sym, new_id_str
                    )
                    .as_str(),
                  )
                  .emit()
              });
            }

            *name = JSXElementName::Ident(IdentName::new(new_id_str.into(), id.span).into());
          }
        }
      }
      JSXElementName::JSXMemberExpr(_) => {}
      JSXElementName::JSXNamespacedName(_) => {}
    }
  }

  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    // check if it is e.stopPropagation()
    match &mut n.callee {
      Callee::Expr(e) => match &**e {
        Expr::Member(m) => {
          // check if it is e.stopPropagation
          match &m.prop {
            MemberProp::Ident(id) => {
              if id.sym.to_string() == "stopPropagation" {
                HANDLER.with(|handler| {
                  handler
                    .struct_span_warn(
                      n.span,
                      "BROKEN: e.stopPropagation() takes no effect and MUST be migrated in ReactLynx 3.0",
                    )
                    .emit()
                });
              }
            }
            _ => {}
          }
          match &*m.obj {
            Expr::This(_) => match &m.prop {
              MemberProp::Ident(id) => match id.sym.to_string().as_str() {
                "getNodeRef" | "getNodeRefFromRoot" | "createSelectorQuery" => {
                  HANDLER.with(|handler| {
                                            handler
                                                .struct_span_warn(
                                                    n.span,
                                                    format!("BROKEN: {} on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.createSelectorQuery instead.", id.sym.to_string()).as_str(),
                                                )
                                                .emit()
                                        });
                }
                "getElementById" => {
                  HANDLER.with(|handler| {
                                        handler
                                            .struct_span_warn(
                                                n.span,
                                                format!("BROKEN: {} on component instance is broken and MUST be migrated in ReactLynx 3.0, please use ref or lynx.getElementById instead.", id.sym.to_string()).as_str(),
                                            )
                                            .emit()
                                    });
                }
                &_ => {}
              },
              _ => {}
            },
            _ => {}
          }
        }
        _ => {}
      },
      _ => {}
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_class(&mut self, n: &mut Class) {
    let mut is_jsx_visitor = is_component_class::TransformVisitor::new();
    n.visit_with(&mut is_jsx_visitor);

    // only for class with jsx
    if is_jsx_visitor.has_jsx && is_jsx_visitor.has_render_method && is_jsx_visitor.has_super_class
    {
      if self.opts.target == TransformTarget::LEPUS && self.opts.simplify_ctor_like_react_lynx_2 {
        let mut simplify_ctor_like_react_lynx_2_visitor =
          simplify_ctor_like_react_lynx_2::CtorSimplifyVisitor::new();
        n.visit_children_with(&mut simplify_ctor_like_react_lynx_2_visitor);

        n.body.retain_mut(|member| match member {
          ClassMember::Constructor(_) => false, // remove constructor
          ClassMember::ClassProp(ClassProp {
            is_static: false,
            key,
            ..
          }) => match key {
            PropName::Ident(ident) => {
              if ident.sym.to_string() == "state" {
                false // remove `state = {...}`
              } else {
                true
              }
            }
            _ => true,
          },
          _ => true,
        });

        // add a simplified `state = {...}`
        let simplified_state = Expr::Object(ObjectLit {
          span: DUMMY_SP,
          props: simplify_ctor_like_react_lynx_2_visitor.remain_props,
        });
        let simplified = ClassMember::ClassProp(ClassProp {
          span: DUMMY_SP,
          key: PropName::Ident(IdentName::new("state".into(), DUMMY_SP)),
          value: if simplify_ctor_like_react_lynx_2_visitor.remain_stmts.len() > 0 {
            Some(Box::new(Expr::Seq(SeqExpr {
              span: DUMMY_SP,
              exprs: vec![
                Box::new(quote!(
                  r#"($stmts_iife)()"# as Expr,
                  stmts_iife: Expr = Expr::Arrow(ArrowExpr {
                    ctxt: Default::default(),
                    span: DUMMY_SP,
                    params: vec![],
                    body: Box::new(BlockStmtOrExpr::BlockStmt(BlockStmt {
                      ctxt: Default::default(),
                      span: DUMMY_SP,
                      stmts: simplify_ctor_like_react_lynx_2_visitor.remain_stmts,
                    })),
                    is_async: false,
                    is_generator: false,
                    type_params: None,
                    return_type: None,
                  }),
                )),
                Box::new(simplified_state),
              ],
            })))
          } else {
            Some(Box::new(simplified_state))
          },
          type_ann: None,
          is_static: false,
          decorators: vec![],
          accessibility: None,
          is_abstract: false,
          is_optional: false,
          is_override: false,
          readonly: false,
          declare: false,
          definite: false,
        });

        n.body.push(simplified);
      }

      n.body.retain_mut(|member| match member {
                ClassMember::ClassProp(ClassProp {
                    is_static: false,
                    key,
                    span,
                    ..
                }) => match key {
                    PropName::Ident(ident) => {
                        if ident.sym.to_string() == "config" {
                            HANDLER.with(|handler| {
                                handler
                                    .struct_span_warn(
                                        *span,
                                        "BROKEN: supporting for class property `config` is removed and MUST be migrated in ReactLynx 3.0, you should put your configs inside `pageConfig` in lynx.config.js",
                                    )
                                    .emit()
                            });
                            false // remove `config = {...}`
                        } else {
                            true
                        }
                    }
                    _ => true,
                },
                _ => true,
            });
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    n.visit_mut_children_with(self);

    match Lazy::<Ident>::get(&self.runtime_id) {
      Some(runtime_id) => {
        prepend_stmt(
          &mut n.body,
          ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            phase: ImportPhase::Evaluation,
            specifiers: vec![ImportSpecifier::Namespace(ImportStarAsSpecifier {
              span: DUMMY_SP,
              local: runtime_id.clone(),
            })],
            src: Box::new(Str {
              span: DUMMY_SP,
              raw: None,
              value: format!("{}/internal", self.opts.new_runtime_pkg).into(),
            }),
            type_only: Default::default(),
            with: Default::default(),
          })),
        );
      }
      None => {}
    }

    if self.has_component_is {
      prepend_stmt(
        &mut n.body,
        ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
          span: DUMMY_SP,
          phase: ImportPhase::Evaluation,
          specifiers: vec![],
          src: Box::new(Str {
            span: DUMMY_SP,
            raw: None,
            value: format!("{}/experimental/lazy/import", self.opts.new_runtime_pkg).into(),
          }),
          type_only: Default::default(),
          with: Default::default(),
        })),
      );
    }
  }
}

#[cfg(test)]
mod tests {
  use napi::Either;
  use swc_core::{
    common::Mark,
    ecma::{
      parser::{EsSyntax, Syntax},
      transforms::{
        base::{hygiene::hygiene_with_config, resolver},
        testing::test,
      },
      visit::visit_mut_pass,
    },
  };

  use crate::CompatVisitorConfig;
  use crate::{swc_plugin_compat::AddComponentElementConfig, CompatVisitor};

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_rename_view,
    r#"
    import { View } from "@lynx-js/react-components";
    const a = <View />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_not_rename_view_in_scope,
    r#"
    import { View } from "@lynx-js/react-components";
    {
      const View = "view";
      const a = <View />;
    }
    {
      const a = <View />;
    }
    const a = <View />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_not_rename_view_redeclaration,
    r#"
    import { View } from "@lynx-js/react-components";
    {
      const View2 = View;
      const a = <View2 />;
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_not_handle_jsx_member_expression,
    r#"
    import { View } from "@lynx-js/react-components";
    const a = <View.View />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_transform_event_props_1,
    r#"
    import { View } from "@lynx-js/react-components";
    const a = <View onClick onClickCatch/>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_transform_event_props_2,
    r#"
    const a = <view onClick onClickCatch/>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_handle_recursive,
    r#"
    import { ScrollView } from "@lynx-js/react-components";
    const a = (
      <view onClick onClickCatch onTouchStartCatch>
        <ScrollView onClick onClickCatch/>
        <View onClick onClickCatch/>
      </view>
    );
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig::default(),
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_change_runtime_pkg,
    r#"
    import { Component } from "@lynx-js/react-runtime";
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_add_component_element,
    r#"
    <Component />;
    <Component item-key="111"/>;
    <Component id="1" exposure-screen-margin-top/>;
    <Component bindtap={() => {}} id="1"/>;
    <Component ui:bindtap={() => {}} id="1"/>;
    <Component item-key="111" lynx-key="222"/>;
    <Component item-key="111" lynx-key="222" style={s}/>;
    <Component {...props} lynx-key="222"/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!"/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!" removeComponentElement={true}/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!" someProps={p}/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!" style={s}/>;
    <Component removeComponentElement/>;
    <Component removeComponentElement={false}/>;
    <Component removeComponentElement={true}/>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::B(AddComponentElementConfig {
            compiler_only: true
          }),
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_add_component_element_compiler_only,
    r#"
    <Component />;
    <Component item-key="111"/>;
    <Component id="1" exposure-screen-margin-top/>;
    <Component bindtap={() => {}} id="1"/>;
    <Component ui:bindtap={() => {}} id="1"/>;
    <Component item-key="111" lynx-key="222"/>;
    <Component item-key="111" lynx-key="222" style={s}/>;
    <Component {...props} lynx-key="222"/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!"/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!" removeComponentElement={true}/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!" someProps={p}/>;
    <Component {...props} lynx-key="222" id="!!!" className="!!!!" style={s}/>;
    <Component removeComponentElement/>;
    <Component removeComponentElement={false}/>;
    <Component removeComponentElement={true}/>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_add_component_element_embedded,
    r#"
    <Component><Component /></Component>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::B(AddComponentElementConfig {
            compiler_only: true
          }),
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_add_component_element_embedded_compiler_only,
    r#"
    <Component><Component /></Component>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          // add_component_element: Either::A(true),
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_left_no_remove_component_element_attr,
    r#"
    <Component removeComponentElement />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          simplify_ctor_like_react_lynx_2: true,
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_simplify_ctor,
    r#"
    class A extends Component {
      state = {
        d: 1,
      }
      constructor(props) {
        super(props)
        this.state = {
            a: 1,
            e: lepusGet(),
        }
      }
      render() {
        return <view />
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          simplify_ctor_like_react_lynx_2: true,
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_simplify_ctor_correct_order,
    r#"
    class A extends Component {
      state = {
        d: 1,
      }
      constructor(props) {
        super(props)
        this.state = {
          a: 1,
        }
        this.state = {
          a: 2,
        }
      }
      render() {
        return <view />
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          simplify_ctor_like_react_lynx_2: true,
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_simplify_ctor_not_remain_local_decls,
    r#"
    let c = 1;
    class A extends Component {
      constructor(props) {
        let b = 1;
        super(props)
        this.state = {
          b,
          c,
          d: props.d,
        }
      }
      render() {
        return <view />
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          simplify_ctor_like_react_lynx_2: true,
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_simplify_ctor_not_remain_local_decls_with_spread,
    r#"
    let c = 1;
    class A extends Component {
      constructor(props) {
        let b = {};
        super(props)
        this.state = {
          ...lynx.__initData,
          ...__REACTLYNX3__ ? lynx.__initData : {},
          ...a,
          ...b,
          c,
        }
      }
      render() {
        return <view />
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          add_component_element: Either::A(true),
          simplify_ctor_like_react_lynx_2: true,
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_simplify_ctor_not_remain_local_decls_with_macro,
    r#"
    let c = 1;
    class A extends Component {
      constructor(props) {
        let b = 1;
        super(props);

        if (__LEPUS__) {
          xxx();
        }
        if (__LE_P_US__) {
          xxx();
        }
        if (!__LE_P_US__) {
          xxx();
        }
        if (+__LE_P_US__) {
          xxx();
        }

        this.state = {
          b,
          c,
          d: props.d,
        }
      }
      render() {
        return <view />
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          remove_component_attr_regex: Some("^(on|handle|bind)[A-Z]".into()),
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_remove_component_attr_regex,
    r#"
    let c = 1;
    const a1 = <A onClick={this.handleClick} handleTap={this.handleClick} />
    const a2 = <A.B onClick={this.handleClick} handleTap={this.handleClick} />
    // FIXME: the `is_component` check is align with previous version of ReactLynx for compat reason
    const a3 = <__a onClick={this.handleClick} handleTap={this.handleClick} />
    const a4 = <A {...x} onLoad={console.log} />
    const b = <view onClick={this.handleClick} handleTap={this.handleClick} />
    a1, a2, a3, a4, b;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(CompatVisitor::new(
        CompatVisitorConfig {
          ..Default::default()
        },
        Some(t.comments.clone())
      )),
      hygiene_with_config(Default::default()),
    ),
    should_add_component_is_import,
    r#"
    let c = <component is="xxxx" />;
    "#
  );
}
