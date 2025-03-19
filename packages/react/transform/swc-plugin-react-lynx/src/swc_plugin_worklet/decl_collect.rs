use rustc_hash::FxHashSet;
use swc_core::common::SyntaxContext;
use swc_core::ecma::ast::*;
use swc_core::ecma::utils::ident::IdentLike;
use swc_core::ecma::visit::{noop_visit_type, Visit, VisitWith};

pub struct BindingCollector {
  decls: FxHashSet<Id>,
  is_pat_decl: bool,
  should_enter_ctx: bool,
  add_var_only: bool,
  enter_next_block: bool,
}

impl BindingCollector {
  fn add(&mut self, i: &Ident) {
    self.decls.insert(Id::from_ident(i));
  }

  fn add_ident_name(&mut self, i: &IdentName) {
    self.decls.insert((i.sym.clone(), SyntaxContext::default()));
  }
}

impl Visit for BindingCollector {
  noop_visit_type!();

  fn visit_arrow_expr(&mut self, n: &ArrowExpr) {
    if self.should_enter_ctx {
      self.should_enter_ctx = false;
      self.enter_next_block = true;

      let old = self.is_pat_decl;

      for p in &n.params {
        self.is_pat_decl = true;
        p.visit_with(self);
      }

      n.body.visit_with(self);
      self.is_pat_decl = old;
    }
  }

  fn visit_assign_pat_prop(&mut self, node: &AssignPatProp) {
    node.value.visit_with(self);

    if self.is_pat_decl {
      self.add(&node.key);
    }
  }

  fn visit_block_stmt(&mut self, n: &BlockStmt) {
    if self.enter_next_block {
      self.enter_next_block = false;
      n.visit_children_with(self);
      return;
    }

    let add_var_only = self.add_var_only;
    self.add_var_only = true;
    n.visit_children_with(self);
    self.add_var_only = add_var_only;
  }

  fn visit_prop_name(&mut self, n: &PropName) {
    if let PropName::Ident(id) = n {
      self.add_ident_name(id);
    }
  }

  fn visit_class_decl(&mut self, node: &ClassDecl) {
    if self.should_enter_ctx {
      self.should_enter_ctx = false;
      self.enter_next_block = true;
      node.visit_children_with(self);
    }

    self.add(&node.ident);
  }

  fn visit_expr(&mut self, node: &Expr) {
    let old = self.is_pat_decl;
    self.is_pat_decl = false;
    node.visit_children_with(self);
    self.is_pat_decl = old;
  }

  fn visit_fn_decl(&mut self, node: &FnDecl) {
    if self.should_enter_ctx {
      self.should_enter_ctx = false;
      self.enter_next_block = true;
      node.visit_children_with(self);
    }

    self.add(&node.ident);
  }

  fn visit_fn_expr(&mut self, node: &FnExpr) {
    if self.should_enter_ctx {
      self.should_enter_ctx = false;
      self.enter_next_block = true;
      node.visit_children_with(self);
    }

    if node.ident.is_some() {
      self.add(node.ident.as_ref().unwrap());
    }
  }

  fn visit_class_method(&mut self, node: &ClassMethod) {
    if self.should_enter_ctx {
      self.should_enter_ctx = false;
      self.enter_next_block = true;
      node.visit_children_with(self);
    }
    if node.key.is_ident() {
      self.add_ident_name(node.key.as_ident().unwrap());
    }
  }

  fn visit_catch_clause(&mut self, node: &CatchClause) {
    if self.should_enter_ctx {
      self.should_enter_ctx = false;
      let old = self.is_pat_decl;
      self.is_pat_decl = true;
      node.param.visit_with(self);
      self.is_pat_decl = old;
    }
    node.body.visit_with(self);
  }

  fn visit_param(&mut self, node: &Param) {
    let old = self.is_pat_decl;
    self.is_pat_decl = true;
    node.visit_children_with(self);
    self.is_pat_decl = old;
  }

  fn visit_pat(&mut self, node: &Pat) {
    node.visit_children_with(self);

    if self.is_pat_decl {
      if let Pat::Ident(i) = node {
        self.add(&i.id)
      }
    }
  }

  fn visit_var_decl(&mut self, n: &VarDecl) {
    if !self.add_var_only || n.kind == VarDeclKind::Var {
      n.visit_children_with(self);
    }
  }

  fn visit_var_declarator(&mut self, node: &VarDeclarator) {
    let old = self.is_pat_decl;
    self.is_pat_decl = true;
    node.name.visit_with(self);

    self.is_pat_decl = false;
    node.init.visit_with(self);
    self.is_pat_decl = old;
  }
}

/*
 * Collects id decls in the given function scope.
 * ```
 * // `f` & `param` are collected.
 * function f(param) {
 *   if (true) {
 *     let a = 1;  // `a` is not collected, for it can't be accessed in function f.
 *     var b = 1;  // `b` is collected.
 *   }
 *   // `g` is collected, and `param2` `c` are not.
 *   function g(param2) {
 *     var c = 1;
 *   }
 * }
 * ```
 */
pub fn collect_inner_scope_decls<N>(n: &N) -> FxHashSet<Id>
where
  N: VisitWith<BindingCollector>,
{
  let mut v = BindingCollector {
    decls: Default::default(),
    is_pat_decl: false,
    should_enter_ctx: true,
    add_var_only: false,
    enter_next_block: false,
  };
  n.visit_with(&mut v);
  v.decls
}

/*
 * Collects id decls in the current scope.
 * ```
 * // only `f` is collected.
 * function f(param) {
 *   if (true) {
 *     let a = 1;
 *     var b = 1;
 *   }
 *   function g(param2) {
 *     var c = 1;
 *   }
 * }
 * ```
 */
pub fn collect_current_scope_decls<N>(n: &N) -> FxHashSet<Id>
where
  N: VisitWith<BindingCollector>,
{
  let mut v = BindingCollector {
    decls: Default::default(),
    is_pat_decl: false,
    should_enter_ctx: false,
    add_var_only: false,
    enter_next_block: false,
  };
  n.visit_with(&mut v);
  v.decls
}
