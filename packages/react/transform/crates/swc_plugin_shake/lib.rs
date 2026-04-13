use serde::Deserialize;
use std::collections::HashMap;
use swc_core::{
  common::DUMMY_SP,
  ecma::ast::*,
  ecma::visit::{VisitMut, VisitMutWith, VisitWith},
};

mod is_component_class;
#[cfg(feature = "napi")]
pub mod napi;

/// {@inheritdoc PluginReactLynxOptions.shake}
/// @public
#[derive(Deserialize, PartialEq, Clone, Debug)]
#[serde(rename_all = "camelCase")]
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

  /// Function names whose calls should be replaced with `undefined` during transformation
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
  ///         removeCall: ['useMyCustomEffect']
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
  pub remove_call: Vec<String>,

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
  /// Default value: `[]`
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
    let default_remove_call = [
      "useEffect",
      "useLayoutEffect",
      "__runInJS",
      "useLynxGlobalEventListener",
      "useImperativeHandle",
    ];
    ShakeVisitorConfig {
      pkg_name: default_pkg_name.iter().map(|x| x.to_string()).collect(),
      retain_prop: default_retain_prop.iter().map(|x| x.to_string()).collect(),
      remove_call: default_remove_call.iter().map(|x| x.to_string()).collect(),
      remove_call_params: Vec::new(),
    }
  }
}

pub struct ShakeVisitor {
  opts: ShakeVisitorConfig,
  current_method_name: Option<String>,
  current_method_ref_names: Option<Vec<(String, String)>>,
  import_ids: HashMap<Id, String>,
}

impl ShakeVisitor {
  pub fn new(opts: ShakeVisitorConfig) -> Self {
    ShakeVisitor {
      opts,
      current_method_name: None,
      current_method_ref_names: None,
      import_ids: HashMap::new(),
    }
  }

  /// Returns true when the call targets a configured runtime import.
  ///
  /// This shared check is used by both:
  /// - `remove_call`, where the whole call expression is removed/replaced
  /// - `remove_call_params`, where only the call arguments are cleared
  fn should_remove_call(&self, n: &CallExpr, target_calls: &[String]) -> bool {
    let Some(callee) = n.callee.as_expr() else {
      // Skip non-expression callees such as `super(...)` and `import(...)`.
      return false;
    };

    // Case 1: direct calls like `useEffect(...)` or `myUseEffect(...)`.
    if let Some(fn_name) = callee.as_ident() {
      return self
        .import_ids
        .get(&fn_name.to_id())
        .is_some_and(|imported_name| {
          target_calls.contains(imported_name) || target_calls.contains(&fn_name.sym.to_string())
        });
    }

    // Case 2: member calls like `ReactLynxRuntime.useEffect(...)`.
    // We only support member access on top-level runtime imports collected in `import_ids`.
    let Some(member) = callee.as_member() else {
      return false;
    };
    let Expr::Ident(object_ident) = &*member.obj else {
      return false;
    };
    let Some(imported_name) = self.import_ids.get(&object_ident.to_id()) else {
      return false;
    };

    // Only `default import` and `namespace import` can legally produce runtime member calls.
    if imported_name != "default" && imported_name != "*" {
      return false;
    }

    match &member.prop {
      // Dot access: `ReactLynxRuntime.useEffect`
      MemberProp::Ident(prop_ident) => target_calls.contains(&prop_ident.sym.to_string()),
      // Computed string access: `ReactLynxRuntime["useEffect"]`
      MemberProp::Computed(computed) => computed
        .expr
        .as_lit()
        .and_then(|lit| match lit {
          Lit::Str(str) => Some(str.value.to_string_lossy().into_owned()),
          _ => None,
        })
        .is_some_and(|prop_name| target_calls.contains(&prop_name)),
      _ => false,
    }
  }
}

impl Default for ShakeVisitor {
  fn default() -> Self {
    ShakeVisitor::new(ShakeVisitorConfig::default())
  }
}

impl VisitMut for ShakeVisitor {
  fn visit_mut_stmt(&mut self, n: &mut Stmt) {
    if let Stmt::Expr(expr_stmt) = n {
      if let Expr::Call(call_expr) = &*expr_stmt.expr {
        if self.should_remove_call(call_expr, &self.opts.remove_call) {
          *n = Stmt::Empty(EmptyStmt { span: DUMMY_SP });
          return;
        }
      }
    }
    n.visit_mut_children_with(self);
  }

  fn visit_mut_expr(&mut self, n: &mut Expr) {
    if let Expr::Call(call_expr) = n {
      if self.should_remove_call(call_expr, &self.opts.remove_call) {
        *n = Expr::Ident(Ident::new("undefined".into(), DUMMY_SP, Default::default()));
        return;
      }
    }
    n.visit_mut_children_with(self);
  }

  /**
   * Record runtime imports as `local_id -> imported_name` so aliased imports
   * like `import { useEffect as myUseEffect }` still match `useEffect`.
   */
  fn visit_mut_import_decl(&mut self, n: &mut ImportDecl) {
    let import_src = n.src.value.to_string_lossy();
    if self
      .opts
      .pkg_name
      .iter()
      .any(|pkg| pkg == import_src.as_ref())
    {
      for specifier in &n.specifiers {
        match specifier {
          ImportSpecifier::Named(named) => {
            // Example:
            //   import { useEffect } from "@lynx-js/react-runtime";
            //   import { useEffect as myUseEffect } from "@lynx-js/react-runtime";
            // Result:
            //   import_ids[useEffect(local id)] = "useEffect"
            //   import_ids[myUseEffect(local id)] = "useEffect"
            let imported_name = named
              .imported
              .as_ref()
              .map(|imported| match imported {
                ModuleExportName::Ident(ident) => ident.sym.to_string(),
                ModuleExportName::Str(str) => str.value.to_string_lossy().into_owned(),
              })
              .unwrap_or_else(|| named.local.sym.to_string());
            self.import_ids.insert(named.local.to_id(), imported_name);
          }
          ImportSpecifier::Default(default) => {
            // Example:
            //   import ReactLynxRuntime from "@lynx-js/react-runtime";
            // Result:
            //   import_ids[ReactLynxRuntime(local id)] = "default"
            self
              .import_ids
              .insert(default.local.to_id(), "default".to_string());
          }
          ImportSpecifier::Namespace(namespace) => {
            // Example:
            //   import * as ReactLynxRuntime from "@lynx-js/react-runtime";
            // Result:
            //   import_ids[ReactLynxRuntime(local id)] = "*"
            self
              .import_ids
              .insert(namespace.local.to_id(), "*".to_string());
          }
        }
      }
    }
    n.visit_mut_children_with(self);
  }
  /**
   * labeling function call
   */
  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    if self.should_remove_call(n, &self.opts.remove_call_params) {
      n.args.clear();
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
            let v = vec![val.clone()];
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
              ref_names.push((method_name.into(), l.value.to_string_lossy().into_owned()));
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
    ClassMember::Method(m) => m.key.as_ident().map(|i| i.sym.to_string()),
    ClassMember::PrivateMethod(m) => Some(m.key.name.to_string()),
    ClassMember::ClassProp(m) => m.key.as_ident().map(|i| i.sym.to_string()),
    ClassMember::PrivateProp(m) => Some(m.key.name.to_string()),
    ClassMember::TsIndexSignature(_) => None,
    ClassMember::Empty(_) => None,
    ClassMember::StaticBlock(_) => None,
    // Stage 3
    // https://github.com/tc39/proposal-grouped-and-auto-accessors
    ClassMember::AutoAccessor(accessor) => match &accessor.key {
      Key::Private(name) => Some(name.name.to_string()),
      Key::Public(name) => name.as_ident().map(|i| i.sym.to_string()),
      #[cfg(swc_ast_unknown)]
      _ => panic!("unknown node"),
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

  use crate::{ShakeVisitor, ShakeVisitorConfig};

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
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ShakeVisitor::new(Default::default())),
    ),
    should_remove_use_effect_call,
    r#"
    import { useEffect } from "@lynx-js/react-runtime";
    const myUseEffect = useEffect;
    export function A () {
      useEffect(()=>{
        console.log("remove useEffect")
      })
      myUseEffect(()=>{
        console.log("remove myUseEffect")
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
    should_not_remove_call_in_scope_id,
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
    should_replace_use_effect_call_with_undefined,
    r#"
    import { useEffect } from '@lynx-js/react-runtime'
    const a = useEffect(() => {});
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
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: Vec::new(),
      remove_call_params: vec!["useEffect".to_string()],
      ..Default::default()
    })),
    should_remove_use_effect_param,
    r#"
    import { useEffect } from "@lynx-js/react-runtime";
    const myUseEffect = useEffect;
    export function A () {
      useEffect(()=>{
        console.log("remove useEffect")
      })
      myUseEffect(()=>{
        console.log("remove myUseEffect")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: vec!["useEffect".to_string()],
      remove_call_params: Vec::new(),
      ..Default::default()
    })),
    should_remove_aliased_use_effect_call,
    r#"
    import { useEffect as myUseEffect } from "@lynx-js/react-runtime";
    export function A () {
      myUseEffect(()=>{
        console.log("keep aliased useEffect")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: vec!["myUseEffect".to_string()],
      remove_call_params: Vec::new(),
      ..Default::default()
    })),
    should_remove_aliased_use_effect_call_by_local_name,
    r#"
    import { useEffect as myUseEffect } from "@lynx-js/react-runtime";
    export function A () {
      myUseEffect(()=>{
        console.log("remove aliased useEffect by local name")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: vec!["useEffect".to_string()],
      remove_call_params: Vec::new(),
      ..Default::default()
    })),
    should_remove_default_and_namespace_runtime_import_calls,
    r#"
    import ReactLynxRuntime from "@lynx-js/react-runtime";
    import * as ReactLynxRuntimeNS from "@lynx-js/react-runtime";
    export function A () {
      ReactLynxRuntime['useEffect'](()=>{
        console.log("remove default import member call")
      })
      ReactLynxRuntimeNS.useEffect(()=>{
        console.log("remove namespace import member call")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: Vec::new(),
      remove_call_params: vec!["useEffect".to_string()],
      ..Default::default()
    })),
    should_remove_default_and_namespace_runtime_import_params,
    r#"
    import ReactLynxRuntime from "@lynx-js/react-runtime";
    import * as ReactLynxRuntimeNS from "@lynx-js/react-runtime";
    export function A () {
      ReactLynxRuntime.useEffect(()=>{
        console.log("remove default import member call")
      })
      ReactLynxRuntimeNS.useEffect(()=>{
        console.log("remove namespace import member call")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: Vec::new(),
      remove_call_params: vec!["myUseEffect".to_string()],
      ..Default::default()
    })),
    should_remove_aliased_use_effect_param_by_local_name,
    r#"
    import { useEffect as myUseEffect } from "@lynx-js/react-runtime";
    export function A () {
      myUseEffect(()=>{
        console.log("remove aliased useEffect by local name")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: Vec::new(),
      remove_call_params: vec!["useEffect".to_string()],
      ..Default::default()
    })),
    should_remove_aliased_use_effect_param,
    r#"
    import { useEffect as myUseEffect } from "@lynx-js/react-runtime";
    export function A () {
      myUseEffect(()=>{
        console.log("keep aliased useEffect")
      })
    }
    "#
  );

  test!(
    Default::default(),
    |_| visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
      remove_call: vec!["useEffect".to_string()],
      remove_call_params: Vec::new(),
      ..Default::default()
    })),
    should_keep_use_effect_call_from_custom_runtime,
    r#"
    import { useEffect } from "@lynx-js/custom-react-runtime";
    export function A () {
      useEffect(()=>{
        console.log("keep useEffect from custom runtime")
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
      visit_mut_pass(ShakeVisitor::new(ShakeVisitorConfig {
        remove_call_params: vec!["useEffect".to_string()],
        remove_call: Vec::new(),
        ..Default::default()
      })),
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
