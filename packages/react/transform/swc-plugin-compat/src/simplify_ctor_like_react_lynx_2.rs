use regex::Regex;
use rustc_hash::FxHashSet;
use swc_core::{
  common::util::take::Take,
  ecma::{
    ast::*,
    utils::collect_decls,
    visit::{Visit, VisitWith},
  },
};

pub struct CtorSimplifyVisitor {
  in_constructor: bool,
  is_target_object: bool,
  current_ctor_bindings: Option<FxHashSet<Id>>,

  pub remain_props: Vec<PropOrSpread>,
  pub remain_stmts: Vec<Stmt>,
}
impl CtorSimplifyVisitor {
  pub fn new() -> Self {
    CtorSimplifyVisitor {
      in_constructor: false,
      is_target_object: false,
      current_ctor_bindings: None,

      remain_props: vec![],
      remain_stmts: vec![],
    }
  }
}

impl Visit for CtorSimplifyVisitor {
  fn visit_constructor(&mut self, n: &Constructor) {
    match &n.body {
      Some(body) => {
        for stmt in &body.stmts {
          let re = Regex::new(r"^__[A-Z_]+__$").unwrap();
          match stmt {
            Stmt::If(stmt_if) => {
              let mut test_ident = &Ident::dummy();

              if stmt_if.test.is_ident() {
                // __IDENT__
                test_ident = stmt_if.test.as_ident().unwrap();
              } else if stmt_if.test.is_unary() {
                let stmt_if_test_unary = stmt_if.test.as_unary().unwrap();
                if stmt_if_test_unary.op == UnaryOp::Bang && stmt_if_test_unary.arg.is_ident() {
                  // !__IDENT__
                  test_ident = stmt_if_test_unary.arg.as_ident().unwrap();
                }
              }

              if let Some(_) = re.captures(test_ident.sym.as_str()) {
                self.remain_stmts.push(stmt.clone())
              }
            }
            _ => {}
          }
        }
      }
      None => {}
    }
    self.in_constructor = true;
    self.current_ctor_bindings = Some(collect_decls(n));
    n.visit_children_with(self);
    self.current_ctor_bindings = None;
    self.in_constructor = false;
  }

  fn visit_class_prop(&mut self, n: &ClassProp) {
    // if this is state = { ... }
    if !n.is_static {
      match &n.key {
        PropName::Ident(key) => {
          if key.sym.to_string() == "state" {
            match &n.value {
              Some(value) => {
                if value.is_object() {
                  self.is_target_object = true;
                  n.visit_children_with(self);
                  self.is_target_object = false;
                  return;
                }
              }
              _ => {}
            }
          }
        }
        _ => {}
      }
    }

    n.visit_children_with(self);
  }

  fn visit_assign_expr(&mut self, n: &AssignExpr) {
    if self.in_constructor {
      match &n {
        AssignExpr {
          op: AssignOp::Assign,
          left: AssignTarget::Simple(left),
          right,
          ..
        } => match left {
          SimpleAssignTarget::Member(member) => {
            if member.obj.is_this() {
              if let MemberProp::Ident(key) = &member.prop {
                if key.sym.to_string() == "state" {
                  if right.is_object() {
                    self.is_target_object = true;
                    n.visit_children_with(self);
                    self.is_target_object = false;
                    return;
                  }
                }
              }
            }
          }
          _ => {}
        },
        _ => {}
      }
    }

    n.visit_children_with(self);
  }

  fn visit_object_lit(&mut self, n: &ObjectLit) {
    if self.is_target_object {
      for prop_or_spread in &n.props {
        match prop_or_spread {
          PropOrSpread::Spread(_) | PropOrSpread::Prop(_) => {
            let mut call_expr_detect = CallExprDetectVisitor { has: false };
            let mut func_detect = FuncDetectVisitor { has: false };
            let mut local_decls_detect = LocalDeclsDetectVisitor {
              has: false,
              bindings: &self.current_ctor_bindings,
            };
            prop_or_spread.visit_with(&mut call_expr_detect);
            prop_or_spread.visit_with(&mut func_detect);
            prop_or_spread.visit_with(&mut local_decls_detect); //  constructor internel variable ,do not remain

            if !call_expr_detect.has && !func_detect.has && !local_decls_detect.has {
              self.remain_props.push(prop_or_spread.clone())
            }
          }
        }
      }
    }
  }
}

struct CallExprDetectVisitor {
  pub has: bool,
}

impl Visit for CallExprDetectVisitor {
  fn visit_call_expr(&mut self, _n: &CallExpr) {
    self.has = true;
  }
}

struct FuncDetectVisitor {
  pub has: bool,
}

impl Visit for FuncDetectVisitor {
  fn visit_function(&mut self, _n: &Function) {
    self.has = true;
  }

  fn visit_block_stmt_or_expr(&mut self, _n: &BlockStmtOrExpr) {
    self.has = true;
  }
}

struct LocalDeclsDetectVisitor<'a> {
  pub has: bool,
  pub bindings: &'a Option<FxHashSet<Id>>,
}

impl Visit for LocalDeclsDetectVisitor<'_> {
  fn visit_ident(&mut self, _n: &Ident) {
    if let Some(bindings) = self.bindings {
      if bindings.contains(&_n.to_id()) {
        self.has = true;
      }
    }
  }
}
