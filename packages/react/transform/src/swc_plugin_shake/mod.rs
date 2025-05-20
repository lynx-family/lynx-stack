use std::collections::HashMap;

use napi_derive::napi;
use swc_core::{
  ecma::ast::*,
  ecma::visit::{VisitMut, VisitMutWith, VisitWith},
};

mod is_component_class;

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

pub struct ShakeVisitor {
  opts: ShakeVisitorConfig,
  is_runtime_import: bool,
  current_method_name: Option<String>,
  current_method_ref_names: Option<Vec<(String, String)>>,
  import_ids: Vec<Id>,
}

impl ShakeVisitor {
  pub fn new(opts: ShakeVisitorConfig) -> Self {
    ShakeVisitor {
      opts,
      is_runtime_import: false,
      current_method_name: None,
      current_method_ref_names: None,
      import_ids: Vec::new(),
    }
  }
  pub fn default() -> Self {
    ShakeVisitor::new(ShakeVisitorConfig::default())
  }
}

impl VisitMut for ShakeVisitor {
  /**
   * labeling import stmt
   */
  fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
    if self.opts.pkg_name.contains(&n.src.value.to_string()) {
      self.is_runtime_import = true;
    }
    n.visit_mut_children_with(self);
    self.is_runtime_import = false;
  }
  /**
   * labeling identifiers of the import by id
   */
  fn visit_mut_ident(&mut self, n: &mut Ident) {
    if self.is_runtime_import {
      self.import_ids.push(n.to_id())
    }
    n.visit_mut_children_with(self);
  }
  /**
   * labeling function call
   */
  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    if let Some(fn_name) = n.callee.as_expr().and_then(|s| s.as_ident()) {
      if self.import_ids.contains(&fn_name.to_id().into()) {
        if self
          .opts
          .remove_call_params
          .contains(&fn_name.sym.to_string())
        {
          n.args.clear();
        }
      }
    }
    n.visit_mut_children_with(self);
  }
  /**
   * only fir jsxclass,
   */
  fn visit_mut_class(&mut self, n: &mut Class) {
    let mut is_jsx_visitor = is_component_class::TransformVisitor::new();
    n.visit_with(&mut is_jsx_visitor);
    if is_jsx_visitor.has_jsx && is_jsx_visitor.has_render_method && is_jsx_visitor.has_super_class
    {
      n.visit_mut_children_with(self);
    }
  }
  /**
   * Collect the variables on this used in each method, and process them to get the members that need to be retained
   */
  fn visit_mut_class_members(&mut self, n: &mut Vec<ClassMember>) {
    let previous_method_ref_names = self.current_method_ref_names.take();
    self.current_method_ref_names = Some(Vec::new());
    n.visit_mut_children_with(self);
    let mut used_members: Vec<String> = Vec::new();
    let mut scannd_map: HashMap<String, Vec<String>> = HashMap::new();
    if let Some(ref_names) = &self.current_method_ref_names {
      for (member, val) in ref_names {
        match scannd_map.get_mut(member) {
          Some(v) => {
            v.push(val.clone());
          }
          None => {
            let mut v: Vec<String> = Vec::new();
            v.push(val.clone());
            scannd_map.insert(member.clone(), v);
          }
        }
      }
    }
    mark_used(&mut used_members, &self.opts.retain_prop, &scannd_map);
    n.retain(|x| {
      if let Some(k) = get_class_member_name(x) {
        used_members.contains(&k)
      } else {
        false
      }
    });
    self.current_method_ref_names = previous_method_ref_names;
  }
  /**
   * labeling under methods
   */
  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    let previous_method_name = self.current_method_name.take();
    self.current_method_name = get_class_member_name(n);
    n.visit_mut_children_with(self);
    self.current_method_name = previous_method_name;
  }
  /**
   * labeling this.xx and corresponding class methods
   */
  fn visit_mut_member_expr(&mut self, n: &mut MemberExpr) {
    if let Some(method_name) = &self.current_method_name {
      if n.obj.is_this() {
        if let Some(ref_names) = &mut self.current_method_ref_names {
          if let Some(prop) = n.prop.as_ident() {
            ref_names.push((method_name.into(), prop.sym.to_string()));
          } else if let Some(prop) = n.prop.as_computed() {
            if let Some(Lit::Str(l)) = prop.expr.as_lit() {
              ref_names.push((method_name.into(), l.value.to_string()));
            }
          }
        }
      }
    }
    n.visit_mut_children_with(self);
  }
}

fn mark_used(used: &mut Vec<String>, add: &Vec<String>, scannd_map: &HashMap<String, Vec<String>>) {
  for i in add {
    if !used.contains(i) {
      used.push(i.clone());
      if let Some(items) = scannd_map.get(i) {
        mark_used(used, items, scannd_map);
      }
    }
  }
}

fn get_class_member_name(c: &ClassMember) -> Option<String> {
  match c {
    ClassMember::Constructor(_) => Some("constructor".into()),
    ClassMember::Method(m) => m.key.as_ident().and_then(|i| Some(i.sym.to_string())),
    ClassMember::PrivateMethod(m) => Some(m.key.name.to_string()),
    ClassMember::ClassProp(m) => m.key.as_ident().and_then(|i| Some(i.sym.to_string())),
    ClassMember::PrivateProp(m) => Some(m.key.name.to_string()),
    ClassMember::TsIndexSignature(_) => None,
    ClassMember::Empty(_) => None,
    ClassMember::StaticBlock(_) => None,
    // Stage 3
    // https://github.com/tc39/proposal-grouped-and-auto-accessors
    ClassMember::AutoAccessor(accessor) => match &accessor.key {
      Key::Private(name) => Some(name.name.to_string()),
      Key::Public(name) => name.as_ident().and_then(|i| Some(i.sym.to_string())),
    },
  }
}

#[cfg(test)]
mod tests {
  use swc_core::{
    common::Mark,
    ecma::parser::Syntax,
    ecma::{parser::EsSyntax, transforms::testing::test},
    ecma::{transforms::base::resolver, visit::visit_mut_pass},
  };

  use crate::ShakeVisitor;

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_remove_test,
    r#"
    export class A extends Component {
      test(){}
      render(){
        return <view></view>
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
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_not_remove_test_with_other_runtime,
    r#"
    export class A extends Component {
      test(){}
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_keep_state_and_remove_other,
    r#"
    export class A extends Component {
      state = {
        a: 1
      }
      b = {
        a:1
      }
      render(){
        return <></>
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
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_keep_constructor_and_used,
    r#"
    export class A extends Component {
      constructor(props) {
        super(props);
        this.c = "cc";
        this["d"] = "dd";
      }
      b = "b"
      c = "c"
      d = "d"
      logA(){}
      render(){
        return <></>
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
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_keep_with_nested_class,
    r#"
    export class A extends Component {
      a = "should keep"
      render(){
        class foo extends bar {
          render() { return <></> }
        }
        return new foo(this.a).render();
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
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_keep_render_and_used,
    r#"
    import { Component } from "@lynx-js/react-runtime";
    export class A extends Component {
      renderA(){}
      renderB(){}
      renderC = () => {}
      getSrc(){}
      render(){
        this.renderA()
        this.renderC()
        return <image src={this.getSrc()}></image>
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
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_keep_indirect,
    r#"
    export class A extends Component {
      d = 1
      c = 2
      renderA(){
        this.c = 1;
        this.renderB()
      }
      renderB(){}
      renderC(){}
      render(){
        this.renderA()
        return <></>
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
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_remove_unused_indirect,
    r#"
    export class A extends Component {
      d = 1
      c = 2
      renderA(){
        this.c = 1;
        this.renderB()
      }
      renderB(){}
      renderC(){}
      render(){
        return <></>
      }
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::default()),
    should_remove_use_effect_param,
    r#"
    import { useEffect } from "@lynx-js/react-runtime";
    export function A () {
      useEffect(()=>{
        console.log("remove")
      })
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ShakeVisitor::new(Default::default())),
    ),
    should_not_remove_in_scope_id,
    r#"
    import { useEffect } from '@lynx-js/react-runtime'
    {
      const useEffect = () => {};
      useEffect(() => {});
    }
    useEffect(() => {});
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ShakeVisitor::new(Default::default())),
    ),
    only_shake_class_like_react_component_class,
    r#"
    export class A extends Component {
      d = 1
      c = 2
      renderA(){
        this.c = 1;
        this.renderB()
      }
      renderB(){}
      renderC(){}
      render(){
        return <></>
      }
    }

    class B {
      log() {
        console.log(<A/>)
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
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ShakeVisitor::new(Default::default())),
    ),
    should_keep_access_inside_class_property_iife,
    r#"
    export class A extends Component {
      a = 1;
      state = ((()=>{this.a;})(), {a:1})
      render(){
        return <></>
      }
    }
    "#
  );
}
