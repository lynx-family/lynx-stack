use swc_core::{
  common::{SyntaxContext, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

pub struct BaVisitor {
  runtime_id: Expr,
}

impl BaVisitor {
  pub fn new(runtime_id: Expr) -> Self {
    Self { runtime_id }
  }

  fn check_ba_directive_fn_decl(&self, fn_decl: &FnDecl) -> bool {
    match fn_decl.function.body.as_ref() {
      Some(block_stmt) => match block_stmt.stmts.first() {
        Some(Stmt::Expr(expr_stmt)) => match &*expr_stmt.expr {
          Expr::Lit(Lit::Str(str_lit)) => str_lit.value.trim() == "use background",
          _ => false,
        },
        _ => false,
      },
      _ => false,
    }
  }

  fn check_ba_directive_fn_expr(&self, fn_expr: &FnExpr) -> bool {
    match fn_expr.function.body.as_ref() {
      Some(block_stmt) => match block_stmt.stmts.first() {
        Some(Stmt::Expr(expr_stmt)) => match &*expr_stmt.expr {
          Expr::Lit(Lit::Str(str_lit)) => str_lit.value.trim() == "use background",
          _ => false,
        },
        _ => false,
      },
      _ => false,
    }
  }

  fn check_ba_directive_arrow(&self, arrow: &ArrowExpr) -> bool {
    match arrow.body.as_ref() {
      BlockStmtOrExpr::BlockStmt(block) => match block.stmts.first() {
        Some(Stmt::Expr(expr_stmt)) => match &*expr_stmt.expr {
          Expr::Lit(Lit::Str(str_lit)) => str_lit.value.trim() == "use background",
          _ => false,
        },
        _ => false,
      },
      BlockStmtOrExpr::Expr(_) => false,
    }
  }

  fn remove_ba_directive(&self, function: &mut Function) {
    if let Some(ref mut body) = function.body {
      if let Some(Stmt::Expr(expr_stmt)) = body.stmts.first() {
        if let Expr::Lit(Lit::Str(str_lit)) = expr_stmt.expr.as_ref() {
          if str_lit.value.trim() == "use background" {
            body.stmts.remove(0);
          }
        }
      }
    }
  }

  fn remove_ba_directive_from_block(&mut self, block: &mut BlockStmt) {
    if let Some(Stmt::Expr(expr_stmt)) = block.stmts.first() {
      if let Expr::Lit(Lit::Str(str_lit)) = expr_stmt.expr.as_ref() {
        if str_lit.value.as_ref() == "use background" {
          block.stmts.remove(0);
        }
      }
    }
  }

  fn create_ba_object_from_fn(&mut self, function: &Function) -> Expr {
    let mut func = function.clone();
    self.remove_ba_directive(&mut func);

    let fn_expr = Expr::Fn(FnExpr {
      ident: None,
      function: Box::new(Function {
        params: func.params,
        decorators: func.decorators,
        span: DUMMY_SP,
        body: Some(func.body.unwrap_or_else(|| BlockStmt {
          span: DUMMY_SP,
          stmts: vec![],
          ctxt: SyntaxContext::default(),
        })),
        is_generator: func.is_generator,
        is_async: func.is_async,
        type_params: func.type_params,
        return_type: func.return_type,
        ctxt: SyntaxContext::default(),
      }),
    });

    self.create_ba_object_expr(fn_expr)
  }

  fn create_ba_object_from_arrow(&mut self, arrow: &ArrowExpr) -> Expr {
    let mut arrow_clone = arrow.clone();

    if let BlockStmtOrExpr::BlockStmt(ref mut block) = &mut *arrow_clone.body {
      self.remove_ba_directive_from_block(block);
    }

    let arrow_expr = Expr::Arrow(ArrowExpr {
      span: DUMMY_SP,
      params: arrow_clone.params,
      body: arrow_clone.body,
      is_async: arrow_clone.is_async,
      is_generator: arrow_clone.is_generator,
      type_params: arrow_clone.type_params,
      return_type: arrow_clone.return_type,
      ctxt: SyntaxContext::default(),
    });

    self.create_ba_object_expr(arrow_expr)
  }

  fn create_ba_object_expr(&self, func: Expr) -> Expr {
    let register_ba_call = quote!(
        r#"$runtime_id.registerBgAction(
           $func,
        )"# as Expr,
        runtime_id: Expr = self.runtime_id.clone(),
        func: Expr = func,
    );

    Expr::Object(ObjectLit {
      span: DUMMY_SP,
      props: vec![
        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
          key: PropName::Ident(IdentName::new("__type".into(), DUMMY_SP)),
          value: Box::new(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: "$$mtc_ba".into(),
            raw: None,
          }))),
        }))),
        PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
          key: PropName::Ident(IdentName::new("__runtimeId".into(), DUMMY_SP)),
          value: Box::new(register_ba_call),
        }))),
      ],
    })
  }
}

impl VisitMut for BaVisitor {
  fn visit_mut_stmt(&mut self, stmt: &mut Stmt) {
    // function ba(e) { 'use background'; }
    if let Stmt::Decl(Decl::Fn(fn_decl)) = stmt {
      if self.check_ba_directive_fn_decl(fn_decl) {
        let ba_object = self.create_ba_object_from_fn(&fn_decl.function);

        *stmt = Stmt::Decl(Decl::Var(Box::new(VarDecl {
          span: DUMMY_SP,
          kind: VarDeclKind::Const,
          declare: false,
          decls: vec![VarDeclarator {
            span: DUMMY_SP,
            name: Pat::Ident(BindingIdent {
              id: fn_decl.ident.clone(),
              type_ann: None,
            }),
            init: Some(Box::new(ba_object)),
            definite: false,
          }],
          ctxt: SyntaxContext::empty(),
        })));

        return;
      }
    }

    if let Stmt::Decl(Decl::Var(var_decl)) = stmt {
      for declarator in &mut var_decl.decls {
        if let Some(init) = &mut declarator.init {
          // // const ba = (e) => { 'use background'; }
          if let Expr::Arrow(arrow_expr) = init.as_mut() {
            if self.check_ba_directive_arrow(arrow_expr) {
              let ba_object = self.create_ba_object_from_arrow(arrow_expr);

              **init = ba_object;
              return;
            }
          }
          // const ba = function(e) { 'use background'; }
          else if let Expr::Fn(fn_expr) = init.as_mut() {
            if self.check_ba_directive_fn_expr(fn_expr) {
              **init = self.create_ba_object_from_fn(&fn_expr.function);
              return;
            }
          }
        }
      }
    }

    stmt.visit_mut_children_with(self);
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
        visit_mut_pass(BaVisitor::new(Expr::Ident(private_ident!("ReactLynx")))),
      )
    },
    background_action_fn_decl,
    // Input codes
    r#"
function ba(e) {
    'use background';
    console.log("background action", e);
}
function BTC() {
    return <MTC onClick={ba}/>;
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
        visit_mut_pass(BaVisitor::new(Expr::Ident(private_ident!("ReactLynx")))),
      )
    },
    background_action_arrow,
    // Input codes
    r#"
const ba = (e) => {
    'use background';
    console.log("background action", e);
}
function BTC() {
    return <MTC onClick={ba}/>;
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
        visit_mut_pass(BaVisitor::new(Expr::Ident(private_ident!("ReactLynx")))),
      )
    },
    background_action_fn_expr,
    // Input codes
    r#"
const ba = function(e){
    'use background';
    console.log("background action", e);
}
function BTC() {
    return <MTC onClick={ba}/>;
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
        visit_mut_pass(BaVisitor::new(Expr::Ident(private_ident!("ReactLynx")))),
      )
    },
    background_action_inlined_fn_decl,
    // Input codes
    r#"
function BTC() {
    function ba(e){
      'use background';
      console.log("background action", e);
    }
    return <MTC onClick={ba}/>;
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
        visit_mut_pass(BaVisitor::new(Expr::Ident(private_ident!("ReactLynx")))),
      )
    },
    background_action_inlined_arrow,
    // Input codes
    r#"
function BTC() {
    const ba = (e) => {
      'use background';
      console.log("background action", e);
    }
    return <MTC onClick={ba}/>;
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
        visit_mut_pass(BaVisitor::new(Expr::Ident(private_ident!("ReactLynx")))),
      )
    },
    background_action_inlined_fn_expr,
    // Input codes
    r#"
function BTC() {
    const ba = function(e){
      'use background';
      console.log("background action", e);
    }
    return <MTC onClick={ba}/>;
}
    "#
  );
}
