use once_cell::sync::Lazy;
use std::collections::HashSet;
use swc_core::{
  common::{comments::Comments, Span, SyntaxContext, DUMMY_SP},
  ecma::{
    ast::*,
    utils::private_ident,
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

use crate::{target::TransformTarget, TransformMode};

#[napi(object)]
#[derive(Clone, Debug)]
pub struct MTCVisitorConfig {
  pub target: TransformTarget,
}

impl MTCVisitorConfig {
  pub fn new(target: TransformTarget) -> Self {
    Self { target }
  }
}

pub struct MTCVisitor<C>
where
  C: Comments + Clone,
{
  config: MTCVisitorConfig,
  is_mtc: bool,
  functions_to_transform: Vec<String>,
  runtime_id: Lazy<Expr>,
  comments: Option<C>,
}

impl<C> MTCVisitor<C>
where
  C: Comments + Clone,
{
  pub fn new(config: MTCVisitorConfig, mode: TransformMode, comments: Option<C>) -> Self {
    Self {
      config,
      is_mtc: false,
      functions_to_transform: Vec::new(),
      runtime_id: match mode {
        TransformMode::Development => {
          Lazy::new(|| quote!("require('@lynx-js/react/internal')" as Expr))
        }
        TransformMode::Production | TransformMode::Test => {
          Lazy::new(|| Expr::Ident(private_ident!("ReactLynx")))
        }
      },
      comments,
    }
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

  fn collect_exported_functions(&self, module: &Module) -> Vec<String> {
    let mut functions = Vec::new();

    for item in &module.body {
      match item {
        // ExportDeclaration: export function Foo() {}
        ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export_decl)) => {
          if let Decl::Fn(fn_decl) = &export_decl.decl {
            functions.push(fn_decl.ident.sym.to_string());
          }
        }

        // ExportNamedDeclaration: export { Foo, Bar }
        ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(named_export)) => {
          // not re-export
          if named_export.src.is_none() {
            for spec in &named_export.specifiers {
              if let ExportSpecifier::Named(named_spec) = spec {
                if let ModuleExportName::Ident(ident) = &named_spec.orig {
                  functions.push(ident.sym.to_string());
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
    let functions_set: HashSet<_> = self.functions_to_transform.iter().collect();

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

  fn generate_internal_mtc_name(&self, original_name: &str) -> String {
    format!("$$mtc_{}", original_name)
  }

  fn create_register_export(&self, fn_name: &str) -> ModuleItem {
    let internal_fn_name = self.generate_internal_mtc_name(fn_name);

    let mut register_mtc_call = quote!(
        r#"$runtime_id.registerMTC(
             $internal_fn_name,
        )"# as Expr,
        runtime_id: Expr = self.runtime_id.clone(),
        internal_fn_name: Expr =  Expr::Ident(internal_fn_name.into()),
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

  fn transform_mtc_in_background(&mut self, fn_decl: &mut FnDecl) {
    let props_identifier = if let Some(param) = fn_decl.function.params.first() {
      match &param.pat {
        Pat::Ident(ident) => ident.id.clone(),
        Pat::Object(_) => Ident::new("props".into(), DUMMY_SP, SyntaxContext::default()),
        _ => Ident::new("props".into(), DUMMY_SP, SyntaxContext::default()),
      }
    } else {
      Ident::new("props".into(), DUMMY_SP, SyntaxContext::default())
    };

    let mtc_container = JSXElementName::Ident(Ident::from("mtc-container"));
    let mtc_slot = JSXElementName::Ident(Ident::from("mtc-slot"));
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
    ];
    let mtc_slot_expr = Expr::Call(CallExpr {
      span: DUMMY_SP,
      callee: Callee::Expr(Box::new(Expr::Member(MemberExpr {
        span: DUMMY_SP,
        obj: Box::new(Expr::Ident(Ident::from("jsxs"))),
        prop: MemberProp::Ident(IdentName::from("map")),
      }))),
      args: vec![ExprOrSpread {
        spread: None,
        expr: Box::new(Expr::Arrow(ArrowExpr {
          span: DUMMY_SP,
          params: vec![Pat::Ident(BindingIdent {
            id: Ident::from("jsx"),
            type_ann: None,
          })],
          body: Box::new(BlockStmtOrExpr::Expr(Box::new(Expr::JSXElement(Box::new(
            JSXElement {
              span: DUMMY_SP,
              opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: mtc_slot.clone(),
                attrs: vec![],
                self_closing: false,
                type_args: None,
              },
              children: vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(Expr::Ident(Ident::from("jsx")))),
              })],
              closing: Some(JSXClosingElement {
                span: DUMMY_SP,
                name: mtc_slot,
              }),
            },
          ))))),
          is_async: false,
          is_generator: false,
          type_params: None,
          return_type: None,
          ctxt: SyntaxContext::default(),
        })),
      }],
      type_args: None,
      ctxt: SyntaxContext::default(),
    });

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
        expr: JSXExpr::Expr(Box::new(mtc_slot_expr)),
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
          "const [jsxs, transformedProps] = $runtime_id.pickJSXfromProps($props);" as Stmt,
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
    self.is_mtc = self.check_main_thread_directive(module);

    self.remove_main_thread_directive(module);

    if !self.is_mtc {
      return;
    }

    self.functions_to_transform = self.collect_exported_functions(module);

    if self.functions_to_transform.is_empty() {
      return;
    }

    if self.config.target == TransformTarget::LEPUS {
      self.remove_exported_functions(module);
    }

    module.visit_mut_children_with(self);

    if self.config.target == TransformTarget::LEPUS {
      for fn_name in &self.functions_to_transform.clone() {
        let new_export = self.create_register_export(fn_name);
        module.body.push(new_export);
      }
    }
  }

  fn visit_mut_fn_decl(&mut self, fn_decl: &mut FnDecl) {
    if self.is_mtc
      && self
        .functions_to_transform
        .contains(&fn_decl.ident.sym.to_string())
    {
      match self.config.target {
        TransformTarget::JS | TransformTarget::MIXED => {
          self.transform_mtc_in_background(fn_decl);
        }
        TransformTarget::LEPUS => {
          let internal_fn_name = self.generate_internal_mtc_name(&fn_decl.ident.sym);
          fn_decl.ident.sym = internal_fn_name.into();
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
          MTCVisitorConfig::new(TransformTarget::JS),
          TransformMode::Development,
          Some(t.comments.clone()),
        )),
      )
    },
    background_export_named,
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
          MTCVisitorConfig::new(TransformTarget::LEPUS),
          TransformMode::Development,
          Some(t.comments.clone()),
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
          MTCVisitorConfig::new(TransformTarget::LEPUS),
          TransformMode::Development,
          Some(t.comments.clone()),
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
          MTCVisitorConfig::new(TransformTarget::LEPUS),
          TransformMode::Development,
          Some(t.comments.clone()),
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
          MTCVisitorConfig::new(TransformTarget::LEPUS),
          TransformMode::Development,
          Some(t.comments.clone()),
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
          MTCVisitorConfig::new(TransformTarget::LEPUS),
          TransformMode::Development,
          Some(t.comments.clone()),
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
