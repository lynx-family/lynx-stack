use std::collections::HashMap;

use swc_core::{
  common::{comments::Comments, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};
use swc_plugins_shared::jsx_helpers::jsx_attr_value;

// Run after extraction so authored static trees and Template Definitions keep
// their existing boundaries. Only identifiers owned by this transform qualify.
pub(super) struct HostLowering<'a, C: Comments> {
  pub identities: &'a HashMap<Id, (String, Ident, bool)>,
  pub runtime: Expr,
  pub comments: &'a Option<C>,
}

impl<C: Comments> HostLowering<'_, C> {
  fn lower(&self, node: &JSXElement) -> Option<Expr> {
    let JSXElementName::Ident(ident) = &node.opening.name else {
      return None;
    };
    let (key, bundle, has_no_adapters) = self.identities.get(&ident.to_id())?;
    let mut values = [None, None, None, None];
    for attr in &node.opening.attrs {
      let JSXAttrOrSpread::JSXAttr(attr) = attr else {
        unreachable!("compiled ET host attributes are explicit");
      };
      let JSXAttrName::Ident(name) = &attr.name else {
        unreachable!();
      };
      let index = match name.sym.as_ref() {
        "key" => 0,
        "attributeSlots" => 1,
        "slotChildren" => 2,
        "__listItemPlatformInfo" => 3,
        _ => unreachable!("unexpected compiled ET host attribute"),
      };
      values[index] = Some(*jsx_attr_value(attr.value.clone()));
    }
    let plain = *has_no_adapters && values[3].is_none();
    let mut args = vec![
      Expr::Ident(ident.clone()),
      Expr::Lit(Lit::Str(key.clone().into())),
      Expr::Ident(bundle.clone()),
    ];
    // Retain key evaluation before attributes and children, as in the lowered JSX.
    args.extend(
      values
        .into_iter()
        .map(|value| value.unwrap_or_else(|| quote!("void 0" as Expr))),
    );
    if plain {
      args.push(quote!("true" as Expr));
    }
    self.comments.add_pure_comment(node.span.lo);
    Some(Expr::Call(CallExpr {
      span: node.span,
      ctxt: Default::default(),
      callee: Callee::Expr(Box::new(
        quote!("$runtime.__etHost" as Expr, runtime: Expr = self.runtime.clone()),
      )),
      args: args
        .into_iter()
        .map(|expr| ExprOrSpread {
          spread: None,
          expr: Box::new(expr),
        })
        .collect(),
      type_args: None,
    }))
  }
}

impl<C: Comments> VisitMut for HostLowering<'_, C> {
  fn visit_mut_expr(&mut self, node: &mut Expr) {
    node.visit_mut_children_with(self);
    if let Expr::JSXElement(element) = node {
      if let Some(expr) = self.lower(element) {
        *node = expr;
      }
    }
  }

  fn visit_mut_jsx_attr_value(&mut self, node: &mut JSXAttrValue) {
    node.visit_mut_children_with(self);
    if let JSXAttrValue::JSXElement(element) = node {
      if let Some(expr) = self.lower(element) {
        *node = JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(expr)),
        });
      }
    }
  }

  fn visit_mut_jsx_element_child(&mut self, node: &mut JSXElementChild) {
    node.visit_mut_children_with(self);
    if let JSXElementChild::JSXElement(element) = node {
      if let Some(expr) = self.lower(element) {
        *node = JSXElementChild::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(expr)),
        });
      }
    }
  }
}
