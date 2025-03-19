use crate::swc_plugin_worklet::decl_collect::{
  collect_current_scope_decls, collect_inner_scope_decls,
};
use crate::swc_plugin_worklet::globals::{DEFAULT_GLOBALS, LYNX_GLOBALS};
use rustc_hash::FxHashSet;
use std::cmp::max;
use std::mem::swap;
use std::ops::Deref;
use swc_core::common::util::take::Take;
use swc_core::common::{EqIgnoreSpan, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::utils::quote_ident;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut, VisitMutWith};
use swc_core::{quote, quote_expr};

pub struct ExtractingIdentsCollectorConfig {
  pub custom_global_ident_names: Option<Vec<String>>,
}

struct ScopeEnv {
  ids_declared_locally: FxHashSet<Id>,
  is_inner_fn_scope: bool,
  is_worklet_fn_scope: bool,
}

/*
 * Collects all idents to extract in a worklet.
 */
pub struct ExtractingIdentsCollector {
  cfg: ExtractingIdentsCollectorConfig,
  values_extracted: Box<Expr>,
  idents_to_extract: Vec<Ident>,
  this_expr_to_extract: Box<Expr>,
  js_fns_to_extract: Box<Expr>,
  id_of_last_js_fn: u32,
  next_block_decls_collected: bool,
  scope_env: Vec<ScopeEnv>,
  // when visiting each ident in `a.b.c.d`, the value of `member_expr_depth` is
  // a: 3, b: 2, c: 1, d: 0.
  // when we visit an ident where `member_expr_depth` = 0,
  // we add the whole member function to `idents_to_extract`.
  member_expr_depth: u32,
  // when `d` in `a.b.c.d` is visited, `member_expr_path` should be [a, b, c].
  member_expr_path: Vec<Box<Expr>>,
}

impl ExtractingIdentsCollector {
  pub fn new(cfg: ExtractingIdentsCollectorConfig) -> Self {
    ExtractingIdentsCollector {
      cfg,
      values_extracted: quote!("{}" as Expr).into(),
      idents_to_extract: vec![],
      this_expr_to_extract: quote!("{}" as Expr).into(),
      js_fns_to_extract: quote!("{}" as Expr).into(),
      id_of_last_js_fn: 0,
      next_block_decls_collected: false,
      scope_env: vec![ScopeEnv {
        is_worklet_fn_scope: true,
        ids_declared_locally: FxHashSet::default(),
        is_inner_fn_scope: false,
      }],
      member_expr_depth: 0,
      member_expr_path: vec![],
    }
  }

  pub fn take_values(&mut self) -> Box<Expr> {
    self.values_extracted.take()
  }

  pub fn take_idents(&mut self) -> Vec<Ident> {
    self.idents_to_extract.take()
  }

  pub fn take_this_expr(&mut self) -> Box<Expr> {
    self.this_expr_to_extract.take()
  }

  pub fn take_js_fns(&mut self) -> Box<Expr> {
    self.js_fns_to_extract.take()
  }

  fn is_at_global(&self, s: &str) -> bool {
    DEFAULT_GLOBALS.contains(s)
      || LYNX_GLOBALS.contains(s)
      || (self.cfg.custom_global_ident_names.is_some()
        && self
          .cfg
          .custom_global_ident_names
          .as_ref()
          .unwrap()
          .contains(&String::from(s)))
  }

  fn add_if_needed(&mut self, name: Box<Expr>, expr_to_extract: &Box<Expr>) {
    assert!(name.is_ident() || name.is_lit() || name.is_this());

    if self.member_expr_path.is_empty()
      && name.is_ident()
      && self.is_at_global(&name.as_ident().unwrap().sym)
    {
      return;
    }

    if self.member_expr_path.is_empty() && name.is_ident() {
      // We only want to extract the first object of nested member expression.
      //
      // foo.bar.baz
      // ^^^ <-- We are here
      self
        .idents_to_extract
        .push(name.as_ident().unwrap().clone());
    }

    self.member_expr_path.push(name.clone());

    if self.member_expr_depth != 0 {
      return;
    }

    if !name.is_this() {
      if !self.member_expr_path.is_empty() && self.member_expr_path[0].is_this() {
        Self::add_inner(
          expr_to_extract,
          &mut self.this_expr_to_extract,
          &self.member_expr_path[1..],
        );
      } else {
        Self::add_inner(
          expr_to_extract,
          &mut self.values_extracted,
          &self.member_expr_path,
        )
      }
    }

    self.member_expr_path.clear();
  }

  fn add_inner(expr_to_extract: &Box<Expr>, root: &mut Box<Expr>, path: &[Box<Expr>]) {
    let name = &path[0];
    let name_prop: PropName = match &**name {
      Expr::Ident(id) => PropName::Ident(id.clone().into()),
      Expr::Lit(Lit::Str(str)) => PropName::Str(str.clone()),
      _ => unreachable!(),
    };
    let props = &mut root.as_mut_object().unwrap().props;
    let prop = Self::find_prop(props, &name_prop);

    let new_prop: PropOrSpread = if path.len() == 1 {
      if expr_to_extract.eq_ignore_span(name) {
        Prop::Shorthand(name.as_ident().unwrap().clone()).into()
      } else {
        Prop::KeyValue(KeyValueProp {
          key: name_prop.clone(),
          value: expr_to_extract.clone(),
        })
        .into()
      }
    } else {
      Prop::KeyValue(KeyValueProp {
        key: name_prop.clone(),
        value: quote!("{}" as Expr).into(),
      })
      .into()
    };

    if prop.is_some() {
      if path.len() == 1 {
        *prop.unwrap() = new_prop;
      }
    } else {
      props.push(new_prop);
    }

    if path.len() > 1 {
      let new_root: &mut Box<Expr> = match Self::find_prop(props, &name_prop)
        .unwrap()
        .as_mut_prop()
        .unwrap()
        .as_mut()
      {
        Prop::Shorthand(_) => {
          return;
        }
        Prop::KeyValue(kv) => &mut kv.value,
        _ => unreachable!(),
      };
      if new_root.is_object() {
        Self::add_inner(expr_to_extract, new_root, &path[1..]);
      }
    }
  }

  fn find_prop<'l>(
    props: &'l mut Vec<PropOrSpread>,
    name: &PropName,
  ) -> Option<&'l mut PropOrSpread> {
    let name_str: &str = match name {
      PropName::Ident(id) => &id.sym,
      PropName::Str(str) => &str.value,
      _ => unreachable!(),
    };
    props
      .iter_mut()
      .find(|prop| match prop.as_prop().unwrap().deref() {
        Prop::Shorthand(sh) if name.is_ident() => {
          let ident = name.as_ident().unwrap();

          // We create a tmp Ident with the same `ctxt`
          sh.eq_ignore_span(&Ident::new(ident.sym.clone(), ident.span, sh.ctxt))
        }
        Prop::KeyValue(KeyValueProp {
          key: PropName::Ident(id),
          ..
        }) => &id.sym == name_str,
        Prop::KeyValue(KeyValueProp {
          key: PropName::Str(str),
          ..
        }) => &str.value == name_str,
        _ => false,
      })
  }

  fn push_fn_scope(&mut self, ids_declared_in_scope: FxHashSet<Id>) {
    let last_scope = self.scope_env.last().unwrap();
    self.scope_env.push(ScopeEnv {
      is_worklet_fn_scope: false,
      is_inner_fn_scope: !last_scope.is_worklet_fn_scope,
      ids_declared_locally: ids_declared_in_scope,
    });
  }

  fn push_block_scope(&mut self, ids_declared_in_scope: FxHashSet<Id>) {
    let last_scope = self.scope_env.last().unwrap();
    self.scope_env.push(ScopeEnv {
      is_worklet_fn_scope: false,
      is_inner_fn_scope: last_scope.is_inner_fn_scope,
      ids_declared_locally: ids_declared_in_scope,
    });
  }

  fn pop_scope(&mut self) {
    self.scope_env.pop();
  }
}

impl VisitMut for ExtractingIdentsCollector {
  noop_visit_mut_type!();

  fn visit_mut_this_expr(&mut self, n: &mut ThisExpr) {
    if self.member_expr_depth > 0 {
      if !self.scope_env.last().unwrap().is_inner_fn_scope {
        self.add_if_needed(Expr::This(n.clone()).into(), &Expr::This(n.clone()).into());
      }
    }
  }

  fn visit_mut_ident(&mut self, n: &mut Ident) {
    if !self
      .scope_env
      .iter()
      .any(|env| env.ids_declared_locally.contains(&n.to_id()))
    {
      self.add_if_needed(
        Expr::Ident(n.clone()).into(),
        &Expr::Ident(n.clone()).into(),
      );
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_member_expr(&mut self, n: &mut MemberExpr) {
    let prop_is_computed = n.prop.is_computed();
    let prop_is_computed_lit = prop_is_computed && n.prop.as_computed().unwrap().expr.is_lit();
    let prop_is_computed_lit_str = prop_is_computed_lit
      && matches!(
        n.prop.as_computed().unwrap().expr.as_lit().unwrap(),
        Lit::Str(_)
      );

    if (prop_is_computed && !prop_is_computed_lit_str)
      || (n.prop.is_ident() && n.prop.as_ident().unwrap().sym == "current")
      || !(n.obj.is_ident() || n.obj.is_member() || n.obj.is_this())
    {
      self.member_expr_depth = 0;
      n.obj.visit_mut_with(self);
    } else {
      self.member_expr_depth += 1;
      n.obj.visit_mut_with(self);
      self.member_expr_depth = max(self.member_expr_depth, 1) - 1;
    }

    match &n.prop {
      MemberProp::Computed(comp) => {
        if prop_is_computed_lit_str {
          if !self.member_expr_path.is_empty() {
            self.add_if_needed(
              Expr::Lit(comp.expr.as_lit().unwrap().clone()).into(),
              &Expr::Member(n.clone()).into(),
            );
          }
        } else {
          n.prop.visit_mut_with(self);
        }
      }
      MemberProp::Ident(ident) => {
        if !self.member_expr_path.is_empty() {
          self.add_if_needed(
            Expr::Ident(ident.clone().into()).into(),
            &Expr::Member(n.clone()).into(),
          );
        }
      }
      _ => {}
    }
  }

  /*
   * Prevent extracting identifiers that are keys of a locally created object.
   * e.g.:
   * let a = { _SHOULD_NOT_BE_EXTRACTED_: 1 };
   */
  fn visit_mut_key_value_prop(&mut self, n: &mut KeyValueProp) {
    match &n.key {
      PropName::Computed(_) => {
        n.key.visit_mut_with(self);
      }
      _ => {}
    }
    n.value.visit_mut_with(self);
  }

  /*
   * For each function call whose callee is `runOnBackground`, replace it with a unique id,
   * and insert the original expr into `ident_expr_map_of_js_fns_to_extract`.
   */
  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    if !n.callee.is_expr()
      || !n.callee.as_expr().unwrap().is_ident()
      || !(n.callee.as_expr().unwrap().as_ident().unwrap().sym == "runOnBackground")
      || n.args.len() < 1
    {
      n.visit_mut_children_with(self);
      return;
    }

    self.id_of_last_js_fn += 1;
    let fn_ident = quote_ident!(format!("_jsFn{}", self.id_of_last_js_fn));
    let mut fn_expr = Box::new(fn_ident.clone().into());
    swap(&mut fn_expr, &mut n.args[0].expr);
    self.js_fns_to_extract.as_mut_object().unwrap().props.push(
      Prop::KeyValue(KeyValueProp {
        key: fn_ident.into(),
        value: CallExpr {
          ctxt: Default::default(),
          span: DUMMY_SP,
          args: vec![fn_expr.into()],
          callee: Callee::Expr(quote_expr!("transformToWorklet")),
          type_args: None,
        }
        .into(),
      })
      .into(),
    );
    // skip visit_mut_children_with() here
  }

  fn visit_mut_fn_decl(&mut self, n: &mut FnDecl) {
    self.push_fn_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }

  fn visit_mut_arrow_expr(&mut self, n: &mut ArrowExpr) {
    self.push_block_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }

  fn visit_mut_fn_expr(&mut self, n: &mut FnExpr) {
    self.push_fn_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }

  fn visit_mut_class_method(&mut self, n: &mut ClassMethod) {
    self.push_fn_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    if n.key.is_ident() {
      self
        .scope_env
        .last_mut()
        .unwrap()
        .ids_declared_locally
        .insert((n.key.clone().expect_ident().sym, Default::default()));
    }
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }

  fn visit_mut_constructor(&mut self, n: &mut Constructor) {
    self.push_fn_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }

  fn visit_mut_block_stmt(&mut self, n: &mut BlockStmt) {
    // for fn block.
    if self.next_block_decls_collected {
      self.next_block_decls_collected = false;
      n.visit_mut_children_with(self);
      return;
    }

    // for 'if', 'for' clauses etc.
    self.push_block_scope(collect_current_scope_decls(&n.stmts));
    n.visit_mut_children_with(self);
    self.pop_scope();
  }

  fn visit_mut_class_decl(&mut self, n: &mut ClassDecl) {
    self.push_fn_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }

  fn visit_mut_catch_clause(&mut self, n: &mut CatchClause) {
    self.push_block_scope(collect_inner_scope_decls(n));
    self.next_block_decls_collected = true;
    n.visit_mut_children_with(self);
    self.next_block_decls_collected = false;
    self.pop_scope();
  }
}
