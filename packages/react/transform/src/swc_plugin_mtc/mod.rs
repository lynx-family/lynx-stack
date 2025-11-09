use napi_derive::napi;
use std::collections::HashMap;
use swc_core::{
  common::{SyntaxContext, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

use crate::{
  target::TransformTarget,
  utils::{calc_hash, check_main_thread_directive},
};

#[napi(object)]
#[derive(Clone, Debug)]
pub struct MTCVisitorConfig {
  /// @internal
  pub filename: String,
  /// @internal
  #[napi(ts_type = "'LEPUS' | 'JS' | 'MIXED'")]
  pub target: TransformTarget,
}

impl MTCVisitorConfig {
  pub fn new(target: TransformTarget, filename: String) -> Self {
    Self { target, filename }
  }
}

impl Default for MTCVisitorConfig {
  fn default() -> Self {
    Self {
      target: TransformTarget::JS,
      filename: "test.js".into(),
    }
  }
}

pub struct MTCVisitor {
  cfg: MTCVisitorConfig,
  content_hash: String,
  filename_hash: String,
  runtime_id: Expr,
  is_mtc_module: bool,
  mtc_counter: u32,
  mtc_collecter: HashMap<String, String>,
  mtc_sym_to_expr: HashMap<String, Ident>,
  mtc_fn_decl: Vec<FnDecl>,
}

impl MTCVisitor {
  pub fn new(cfg: MTCVisitorConfig, runtime_id: Expr) -> Self {
    Self {
      filename_hash: calc_hash(&cfg.filename.clone()),
      is_mtc_module: false,
      mtc_collecter: HashMap::new(),
      mtc_sym_to_expr: HashMap::new(),
      mtc_fn_decl: Vec::new(),
      runtime_id,
      cfg,
      mtc_counter: 0,
      content_hash: "test".into(),
    }
  }

  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.content_hash = content_hash;
    self
  }

  // fn remove_main_thread_directive(&self, module: &mut Module) {
  //   if self.check_main_thread_directive(module) {
  //     module.body.remove(0);
  //   }
  // }

  fn gen_mtc_uid(&mut self) -> String {
    self.mtc_counter += 1;
    format!(
      "$$mtc_{}_{}_{}",
      self.filename_hash, self.content_hash, self.mtc_counter
    )
  }

  fn collect_mtc_collecter(&mut self, module: &Module) -> HashMap<String, String> {
    let mut mtcs = HashMap::new();

    for item in &module.body {
      match item {
        // ExportDeclaration: export function Foo() {}
        ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
          if let Decl::Fn(fn_decl) = &export_decl.decl {
            mtcs.insert(fn_decl.ident.sym.to_string(), self.gen_mtc_uid());
            self.mtc_sym_to_expr.insert(
              fn_decl.ident.sym.to_string(),
              self.generate_internal_mtc_ident(&fn_decl.ident.sym),
            );
          }
        }

        // ExportNamedDeclaration: export { Foo, Bar }
        ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(named_export)) => {
          // not re-export
          if named_export.src.is_none() {
            for spec in &named_export.specifiers {
              if let ExportSpecifier::Named(named_spec) = spec {
                if let ModuleExportName::Ident(ident) = &named_spec.orig {
                  mtcs.insert(ident.sym.to_string(), self.gen_mtc_uid());
                  self.mtc_sym_to_expr.insert(
                    ident.sym.to_string(),
                    self.generate_internal_mtc_ident(&ident.sym),
                  );
                }
              }
            }
          }
          // TODO: Handle re-export
        }

        // ExportDefaultDeclaration: export default function Foo() {}
        _ => {}
      }
    }

    mtcs
  }

  // fn remove_exported_functions(&self, module: &mut Module) {
  //   let functions_set: HashSet<_> = self.mtc_collecter.keys().collect();

  //   let mut new_items = Vec::new();

  //   module.body.retain(|item| match item {
  //     ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export_named)) => {
  //       !export_named.specifiers.iter().any(|spec| match spec {
  //         ExportSpecifier::Named(named_spec) => match &named_spec.orig {
  //           ModuleExportName::Ident(ident) => functions_set.contains(&ident.sym.to_string()),
  //           _ => false,
  //         },
  //         _ => false,
  //       })
  //     }
  //     ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
  //       if let Decl::Fn(fn_decl) = &export_decl.decl {
  //         if functions_set.contains(&fn_decl.ident.sym.to_string()) {
  //           new_items.push(ModuleItem::Stmt(Stmt::Decl(export_decl.decl.clone())));
  //           return false;
  //         }
  //       }
  //       true
  //     }
  //     _ => true,
  //   });

  //   module.body.extend(new_items);
  // }

  fn generate_internal_mtc_ident(&self, original_name: &str) -> Ident {
    Ident::new(
      format!("$$mtc_{}", original_name).into(),
      DUMMY_SP,
      SyntaxContext::default(),
    )
  }

  fn create_register_call(&self, fn_name: &str, mtc_uid: &str) -> ModuleItem {
    let internal_mtc_ident = self.generate_internal_mtc_ident(fn_name);

    let register_mtc_call = quote!(
        r#"$runtime_id.registerMTC(
             $mtc_uid,
             $internal_fn_name,
        )"# as Expr,
        runtime_id: Expr = self.runtime_id.clone(),
        mtc_uid: Expr = Expr::Lit(Lit::Str(mtc_uid.into())),
        internal_fn_name: Ident =  self.mtc_sym_to_expr
          .get(fn_name)
          .cloned()
          .unwrap_or_else(|| internal_mtc_ident.clone())
    );

    ModuleItem::Stmt(Stmt::Expr(ExprStmt {
      span: DUMMY_SP,
      expr: Box::new(register_mtc_call),
    }))
  }

  fn transform_mtc(&self, fn_decl: &mut FnDecl, mtc_uid: &str) {
    let props_identifier = if let Some(param) = fn_decl.function.params.first_mut() {
      match &param.pat {
        Pat::Ident(ident) => Some(ident.id.clone()),
        Pat::Object(_) => {
          let props_ident = Ident::new("props".into(), DUMMY_SP, SyntaxContext::default());

          // {p3, children} -> props
          param.pat = Pat::Ident(BindingIdent {
            id: props_ident.clone(),
            type_ann: None,
          });

          Some(props_ident)
        }
        _ => {
          let props_ident = Ident::new("props".into(), DUMMY_SP, SyntaxContext::default());
          param.pat = Pat::Ident(BindingIdent {
            id: props_ident.clone(),
            type_ann: None,
          });

          Some(props_ident)
        }
      }
    } else {
      None
    };

    let render_fake_mtc_slot = quote!(
        r#"$runtime_id.renderFakeMTCSlot($jsxs)"# as Expr,
        runtime_id: Expr = self.runtime_id.clone(),
        jsxs: Expr = Expr::Ident(Ident::from("jsxs")),
    );

    let pick_jsx_from_props_call = match props_identifier {
      Some(props) => quote!(
          r#"const [jsxs, transformedProps] = $runtime_id.pickJSXFromProps($props)"# as Stmt,
          runtime_id: Expr = self.runtime_id.clone(),
          props = props
      ),
      None => quote!(
          r#"const [jsxs, transformedProps] = $runtime_id.pickJSXFromProps()"# as Stmt,
          runtime_id: Expr = self.runtime_id.clone(),
      ),
    };

    let create_element_stmt = match self.cfg.target {
      TransformTarget::JS | TransformTarget::MIXED => {
        quote!(
          "return (
            $runtime_id.createElement('mtc-container', {
              values: [transformedProps],
            }, $render_fake_mtc_slot)
          );" as Stmt,
          runtime_id: Expr = self.runtime_id.clone(),
          render_fake_mtc_slot: Expr = render_fake_mtc_slot
        )
      }
      TransformTarget::LEPUS => {
        quote!(
          "return (
            $runtime_id.createElementLepus('mtc-container', {
              values: [transformedProps],
            }, $render_fake_mtc_slot)
          );" as Stmt,
          runtime_id: Expr = self.runtime_id.clone(),
          render_fake_mtc_slot: Expr = render_fake_mtc_slot
        )
      }
    };

    let new_body = BlockStmt {
      span: DUMMY_SP,
      stmts: vec![
        quote!(
          "const componentInstanceId = $runtime_id.useMemo($runtime_id.genMTCInstanceId, []);" as Stmt,
          runtime_id: Expr = self.runtime_id.clone(),
        ),
        pick_jsx_from_props_call,
        quote!(
          "transformedProps.__MTCProps = {
            componentTypeId: $component_type_id,
            componentInstanceId,
          };" as Stmt,
          component_type_id: Expr = Expr::Lit(Lit::Str(mtc_uid.into()))
        ),
        create_element_stmt,
      ],
      ctxt: SyntaxContext::default(),
    };

    fn_decl.function.body = Some(new_body);
  }
}

impl VisitMut for MTCVisitor {
  fn visit_mut_module(&mut self, module: &mut Module) {
    if check_main_thread_directive(module) {
      self.is_mtc_module = true;
      // self.remove_main_thread_directive(module);
    } else {
      return;
    }

    self.mtc_collecter = self.collect_mtc_collecter(module);

    if self.mtc_collecter.is_empty() {
      return;
    }

    if self.cfg.target == TransformTarget::LEPUS {
      for item in &module.body {
        let fn_decl = match item {
          // function Foo() {}
          // export { Foo }
          ModuleItem::Stmt(Stmt::Decl(Decl::Fn(fn_decl))) => Some(fn_decl),
          // export function Foo() {}
          ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
            if let Decl::Fn(fn_decl) = &export_decl.decl {
              Some(fn_decl)
            } else {
              None
            }
          }
          // TODO: export const Foo = () => {}
          _ => None,
        };

        if let Some(fn_decl) = fn_decl {
          let fn_name = fn_decl.ident.sym.to_string();
          if self.mtc_collecter.contains_key(&fn_name) {
            let mut origin_mtc = fn_decl.clone();
            if let Some(renamed_ident) = self.mtc_sym_to_expr.get(&fn_name) {
              origin_mtc.ident = renamed_ident.clone();
            }
            self.mtc_fn_decl.push(origin_mtc);
          }
        }
      }

      for origin_mtc in self.mtc_fn_decl.drain(..) {
        module
          .body
          .push(ModuleItem::Stmt(Stmt::Decl(Decl::Fn(origin_mtc))));
      }
    }

    module.visit_mut_children_with(self);

    if self.cfg.target == TransformTarget::LEPUS {
      for (mtc_name, mtc_uid) in &self.mtc_collecter {
        module
          .body
          .push(self.create_register_call(mtc_name, mtc_uid));
      }
    }

    self.is_mtc_module = false;
    self.mtc_counter = 0;
    self.mtc_collecter = HashMap::new();
  }

  fn visit_mut_jsx_expr_container(&mut self, jsx_expr: &mut JSXExprContainer) {
    if !self.is_mtc_module || self.cfg.target != TransformTarget::LEPUS {
      return;
    }

    if let JSXExpr::Expr(expr) = &mut jsx_expr.expr {
      let render_mtc_slot_call = quote!(
          r#"$runtime_id.renderMTCSlot(
             $origin_expr,
        )"# as Expr,
          runtime_id: Expr = self.runtime_id.clone(),
          origin_expr: Expr = *expr.clone(),
      );

      jsx_expr.expr = JSXExpr::Expr(Box::new(render_mtc_slot_call));
    }

    jsx_expr.visit_mut_children_with(self);
  }

  fn visit_mut_fn_decl(&mut self, fn_decl: &mut FnDecl) {
    if self.is_mtc_module {
      let mtc_name = fn_decl.ident.sym.to_string();
      if let Some(mtc_uid) = self.mtc_collecter.get(&mtc_name) {
        self.transform_mtc(fn_decl, mtc_uid);
      }
    }

    fn_decl.visit_mut_children_with(self);
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::{
    common::Mark,
    ecma::{
      parser::{EsSyntax, Syntax},
      transforms::{base::resolver, testing::test},
      utils::private_ident,
      visit::visit_mut_pass,
    },
  };

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    background_export_named,
    // Input codes
    r#"
"main thread"
function FakeMTC(props) {
    return <view>
      { props.p3 }
    </view>
}
function FakeMTC2(props) {
    return <view>
      { props.p3 }
    </view>
}
export { FakeMTC, FakeMTC2 }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    main_thread_export_named,
    // Input codes
    r#"
"main thread"
function RealMTC(props) {
    return <view>
      { props.p3 }
    </view>
}
export { RealMTC }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    main_thread_export_named_without_directive,
    // Input codes
    r#"
function RealMTC(props) {
    return <view>
      { props.p3 }
    </view>
}
export { RealMTC }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    main_thread_export_decl,
    // Input codes
    r#"
"main thread"
export function RealMTC(props) {
    return <view>
      { props.p3 }
    </view>
}
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    background_custom_props_name,
    // Input codes
    r#"
"main thread"
export function FakeMTC(customPropsName) {
    return <view>
      { customPropsName.p3 }
    </view>
}
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    background_spread_props,
    // Input codes
    r#"
"main thread"
export function FakeMTC({p3, children}) {
    return <view>
      { p3 }
      { children }
    </view>
}
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    main_thread_nested_jsx_expr_container,
    // Input codes
    r#"
"main thread"
export function FakeMTC({p3, children}) {
    return <view>
      <view>123 + {p3}</view>
      { children }
    </view>
}
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    background_pure_mtc,
    // Input codes
    r#"
"main thread"
export function FakeMTC() {
    return <view>pure MTC</view>
}
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    main_thread_multiply_export_named,
    // Input codes
    r#"
"main thread"
function RealMTC(props) {
    return <view>
      { props.p3 }
    </view>
}
function RealMTC2(props) {
    return <view>
      { props.p3 }
    </view>
}
export { RealMTC, RealMTC2 }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Expr::Ident(private_ident!("ReactLynx")),
        )),
      )
    },
    main_thread_multiply_export_decl,
    // Input codes
    r#"
"main thread"
export function RealMTC(props) {
    return <view>
      { props.p3 }
    </view>
}
export function RealMTC2(props) {
    return <view>
      { props.p3 }
    </view>
}
    "#
  );
}
