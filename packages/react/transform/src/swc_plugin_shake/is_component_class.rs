use swc_core::{
  ecma::ast::*,
  ecma::visit::{Visit, VisitWith},
};

pub struct TransformVisitor {
  pub has_render_method: bool,
  pub has_super_class: bool,
  pub has_jsx: bool,
}
impl TransformVisitor {
  pub fn new() -> Self {
    TransformVisitor {
      has_render_method: false,
      has_super_class: false,
      has_jsx: false,
    }
  }
}

impl Visit for TransformVisitor {
  fn visit_jsx_element(&mut self, _n: &JSXElement) {
    self.has_jsx = true;
  }
  fn visit_jsx_fragment(&mut self, _n: &JSXFragment) {
    self.has_jsx = true;
  }

  fn visit_call_expr(&mut self, n: &CallExpr) {
    // check if this call is createSnapshotInstance()
    if let Callee::Expr(callee) = &n.callee {
      if let Expr::Ident(ident) = &**callee {
        if ident.sym == *"createSnapshotInstance" {
          self.has_jsx = true;
          return;
        }
      }
    }

    n.visit_children_with(self);
  }

  fn visit_class(&mut self, n: &Class) {
    if n.super_class.is_some() {
      self.has_super_class = true;

      for member in &n.body {
        match member {
          ClassMember::Method(method) => {
            if method.key.is_ident() && method.key.as_ident().unwrap().sym == *"render" {
              self.has_render_method = true;
            }
          }
          ClassMember::ClassProp(prop) => {
            if prop.key.is_ident() && prop.key.as_ident().unwrap().sym == *"render" {
              self.has_render_method = true;
            }
          }
          _ => {}
        }
      }
    }

    n.visit_children_with(self);
  }
}
