use napi_derive::napi;
use once_cell::sync::Lazy;
use std::collections::{HashMap, HashSet};
use swc_core::{
  common::{comments::Comments, Span, SyntaxContext, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

use crate::{target::TransformTarget, utils::calc_hash};

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

pub struct MTCVisitor<C>
where
  C: Comments + Clone,
{
  is_mtc: bool,
  cfg: MTCVisitorConfig,
  content_hash: String,
  filename_hash: String,
  mtc_counter: u32,
  functions_to_transform: HashMap<String, String>,
  functions_to_expr: HashMap<String, Ident>,
  runtime_id: Expr,
  comments: Option<C>,
}

impl<C> MTCVisitor<C>
where
  C: Comments + Clone,
{
  pub fn new(cfg: MTCVisitorConfig, comments: Option<C>, runtime_id: Expr) -> Self {
    Self {
      filename_hash: calc_hash(&cfg.filename.clone()),
      comments,
      is_mtc: false,
      functions_to_transform: HashMap::new(),
      functions_to_expr: HashMap::new(),
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

  fn check_main_thread_directive(&self, module: &Module) -> bool {
    match module.body.first() {
      Some(ModuleItem::Stmt(Stmt::Expr(expr_stmt))) => match &*expr_stmt.expr {
        Expr::Lit(Lit::Str(str_lit)) => str_lit.value.trim() == "main thread",
        _ => false,
      },
      _ => false,
    }
  }

  fn remove_main_thread_directive(&self, module: &mut Module) {
    if self.check_main_thread_directive(module) {
      module.body.remove(0);
    }
  }

  fn gen_mtc_uid(&mut self) -> String {
    self.mtc_counter += 1;
    format!(
      "$$mtc_{}_{}_{}",
      self.filename_hash, self.content_hash, self.mtc_counter
    )
  }

  fn collect_exported_functions(&mut self, module: &Module) -> HashMap<String, String> {
    let mut functions = HashMap::new();

    for item in &module.body {
      match item {
        // ExportDeclaration: export function Foo() {}
        ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
          if let Decl::Fn(fn_decl) = &export_decl.decl {
            functions.insert(fn_decl.ident.sym.to_string(), self.gen_mtc_uid());
            self.functions_to_expr.insert(
              fn_decl.ident.sym.to_string(),
              self.generate_internal_mtc_name(&fn_decl.ident.sym),
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
                  functions.insert(ident.sym.to_string(), self.gen_mtc_uid());
                  self.functions_to_expr.insert(
                    ident.sym.to_string(),
                    self.generate_internal_mtc_name(&ident.sym),
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

    functions
  }

  fn remove_exported_functions(&self, module: &mut Module) {
    let functions_set: HashSet<_> = self.functions_to_transform.keys().collect();

    let mut new_items = Vec::new();

    module.body.retain(|item| match item {
      ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export_named)) => {
        !export_named.specifiers.iter().any(|spec| match spec {
          ExportSpecifier::Named(named_spec) => match &named_spec.orig {
            ModuleExportName::Ident(ident) => functions_set.contains(&ident.sym.to_string()),
            _ => false,
          },
          _ => false,
        })
      }
      ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
        if let Decl::Fn(fn_decl) = &export_decl.decl {
          if functions_set.contains(&fn_decl.ident.sym.to_string()) {
            new_items.push(ModuleItem::Stmt(Stmt::Decl(export_decl.decl.clone())));
            return false;
          }
        }
        true
      }
      _ => true,
    });

    module.body.extend(new_items);
  }

  fn generate_internal_mtc_name(&self, original_name: &str) -> Ident {
    Ident::new(
      format!("$$mtc_{}", original_name).into(),
      DUMMY_SP,
      SyntaxContext::default(),
    )
  }

  fn create_register_export(&self, fn_name: &str, mtc_uid: &str) -> ModuleItem {
    let internal_fn_name = self.generate_internal_mtc_name(fn_name);

    let mut register_mtc_call = quote!(
        r#"$runtime_id.registerMTC(
             $mtc_uid,
             $internal_fn_name,
        )"# as Expr,
        runtime_id: Expr = self.runtime_id.clone(),
        mtc_uid: Expr = Expr::Lit(Lit::Str(mtc_uid.into())),
        internal_fn_name: Ident =  self.functions_to_expr
          .get(fn_name)
          .cloned()
          .unwrap_or_else(|| internal_fn_name.clone())
    );

    register_mtc_call = match register_mtc_call {
      Expr::Call(mut call) => {
        let pure_span = Span::dummy_with_cmt();
        self.comments.add_pure_comment(pure_span.lo);
        call.span = pure_span;
        Expr::Call(call)
      }
      _ => unreachable!("Unexpected expression type in MTC register - expected Call expression"),
    };

    let export_stmt = quote!(
        r#"export const $fn_name = $register_call"# as ModuleItem,
        fn_name = Ident::new(fn_name.into(), DUMMY_SP, SyntaxContext::default()),
        register_call: Expr = register_mtc_call,
    );

    export_stmt
  }

  fn transform_mtc_in_background(&self, fn_decl: &mut FnDecl, mtc_uid: &str) {
    let mtc_container = JSXElementName::Ident(Ident::from("mtc-container"));

    let props_identifier = if let Some(param) = fn_decl.function.params.first_mut() {
      match &param.pat {
        Pat::Ident(ident) => ident.id.clone(),
        Pat::Object(_) => {
          let props_ident = Ident::new("props".into(), DUMMY_SP, SyntaxContext::default());

          // {p3, children} -> props
          param.pat = Pat::Ident(BindingIdent {
            id: props_ident.clone(),
            type_ann: None,
          });

          props_ident
        }
        _ => {
          let props_ident = Ident::new("props".into(), DUMMY_SP, SyntaxContext::default());
          param.pat = Pat::Ident(BindingIdent {
            id: props_ident.clone(),
            type_ann: None,
          });
          props_ident
        }
      }
    } else {
      // TODO: handle pure MTC
      Ident::new("props".into(), DUMMY_SP, SyntaxContext::default())
    };

    let mtc_container_attrs = vec![
      // _p={transformedProps}
      JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::from("_p")),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::from("transformedProps")))),
        })),
      }),
      // _mtcId
      JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::from("_mtcId")),
        value: Some(JSXAttrValue::Lit(Lit::Str(mtc_uid.into()))),
      }),
    ];

    let mtc_jsx = JSXElement {
      span: DUMMY_SP,
      opening: JSXOpeningElement {
        span: DUMMY_SP,
        name: mtc_container.clone(),
        attrs: mtc_container_attrs,
        self_closing: false,
        type_args: None,
      },
      children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(quote!(
          "$runtime_id.renderFakeMTCSlot($jsxs)" as Expr,
          runtime_id: Expr = self.runtime_id.clone(),
          jsxs: Expr = Expr::Ident(Ident::from("jsxs")),
        ))),
      })],
      closing: Some(JSXClosingElement {
        span: DUMMY_SP,
        name: mtc_container,
      }),
    };

    let new_body = BlockStmt {
      span: DUMMY_SP,
      stmts: vec![
        quote!(
          "const [jsxs, transformedProps] = $runtime_id.pickJSXFromProps($props);" as Stmt,
          runtime_id: Expr = self.runtime_id.clone(),
          props = props_identifier
        ),
        quote!(
          "return $mtc_jsx" as Stmt,
          mtc_jsx: Expr = Expr::JSXElement(Box::new(mtc_jsx)),
        ),
      ],
      ctxt: SyntaxContext::default(),
    };

    fn_decl.function.body = Some(new_body);
  }
}

impl<C> VisitMut for MTCVisitor<C>
where
  C: Comments + Clone,
{
  fn visit_mut_module(&mut self, module: &mut Module) {
    if self.check_main_thread_directive(module) {
      self.is_mtc = true;
      self.remove_main_thread_directive(module);
    } else {
      return;
    }

    self.functions_to_transform = self.collect_exported_functions(module);

    if self.functions_to_transform.is_empty() {
      return;
    }

    if self.cfg.target == TransformTarget::LEPUS {
      self.remove_exported_functions(module);
    }

    module.visit_mut_children_with(self);

    if self.cfg.target == TransformTarget::LEPUS {
      for (fn_name, mtc_uid) in &self.functions_to_transform {
        let new_export = self.create_register_export(fn_name, mtc_uid);
        module.body.push(new_export);
      }
    }

    self.is_mtc = false;
    self.mtc_counter = 0;
    self.functions_to_transform = HashMap::new();
  }

  fn visit_mut_fn_decl(&mut self, fn_decl: &mut FnDecl) {
    if self.is_mtc {
      let fn_name = fn_decl.ident.sym.to_string();
      if let Some(mtc_uid) = self.functions_to_transform.get(&fn_name) {
        match self.cfg.target {
          TransformTarget::JS | TransformTarget::MIXED => {
            self.transform_mtc_in_background(fn_decl, mtc_uid);
          }
          TransformTarget::LEPUS => {
            let internal_fn_name = self.generate_internal_mtc_name(&fn_decl.ident.sym);

            fn_decl.ident = self
              .functions_to_expr
              .get(&fn_name)
              .cloned()
              .unwrap_or_else(|| internal_fn_name.clone())
          }
        }
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::JS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Some(t.comments.clone()),
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
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(MTCVisitor::new(
          MTCVisitorConfig::new(TransformTarget::LEPUS, "test.js".into()),
          Some(t.comments.clone()),
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
