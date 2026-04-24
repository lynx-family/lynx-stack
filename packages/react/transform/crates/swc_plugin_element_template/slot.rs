use swc_core::{common::DUMMY_SP, ecma::ast::*, quote};
use swc_plugins_shared::jsx_helpers::jsx_children_to_expr;

use super::i32_to_expr;

pub(super) fn wrap_in_slot(
  slot_ident: &Ident,
  id: i32,
  children: Vec<JSXElementChild>,
) -> JSXElementChild {
  // ET dynamic children are transported as indexed element slots. Keeping the
  // marker in JSX form lets the later React lowering decide the final JS shape
  // without losing slot identity.
  let children_expr = jsx_children_to_expr(children);
  JSXElementChild::JSXExprContainer(JSXExprContainer {
    span: DUMMY_SP,
    expr: JSXExpr::Expr(Box::new(quote!(
      "$slot_ident($id, $children_expr)" as Expr,
      slot_ident: Ident = slot_ident.clone(),
      id: Expr = i32_to_expr(&id),
      children_expr: Expr = children_expr,
    ))),
  })
}

pub(super) fn expr_to_jsx_child(expr: Expr) -> JSXElementChild {
  match expr {
    Expr::JSXElement(jsx) => JSXElementChild::JSXElement(jsx),
    _ => JSXElementChild::JSXExprContainer(JSXExprContainer {
      span: DUMMY_SP,
      expr: JSXExpr::Expr(Box::new(expr)),
    }),
  }
}

fn unwrap_et_slot_expr(expr: &Expr, slot_ident: &Ident) -> Option<(usize, Expr)> {
  let Expr::Call(call_expr) = expr else {
    return None;
  };
  let Callee::Expr(callee) = &call_expr.callee else {
    return None;
  };
  let Expr::Ident(ident) = &**callee else {
    return None;
  };
  if ident.sym != slot_ident.sym {
    return None;
  }
  if call_expr.args.len() != 2 {
    return None;
  }

  let slot_id = match &*call_expr.args[0].expr {
    Expr::Lit(Lit::Num(Number { value, .. })) if *value >= 0.0 => *value as usize,
    _ => return None,
  };

  Some((slot_id, *call_expr.args[1].expr.clone()))
}

fn build_et_slot_array_expr(entries: Vec<(usize, Expr)>) -> Expr {
  let mut slots: Vec<Option<ExprOrSpread>> = vec![];

  for (slot_id, child_expr) in entries {
    if slots.len() <= slot_id {
      slots.resize(slot_id + 1, None);
    }
    slots[slot_id] = Some(ExprOrSpread {
      spread: None,
      expr: Box::new(child_expr),
    });
  }

  Expr::Array(ArrayLit {
    span: DUMMY_SP,
    elems: slots,
  })
}

pub(super) fn lower_lepus_et_children_expr(expr: Expr, slot_ident: &Ident) -> Option<Expr> {
  // LEPUS host components receive children through a plain slot array. JS output
  // can keep nested JSX children, but LEPUS needs the marker calls collapsed here
  // so the main-thread ET runtime reads the same elementSlotIndex ordering as the
  // compiled Template Definition.
  let slot_entries = match expr {
    Expr::Call(_) => vec![unwrap_et_slot_expr(&expr, slot_ident)?],
    Expr::Array(array) => array
      .elems
      .iter()
      .map(|elem| {
        let elem = elem.as_ref()?;
        unwrap_et_slot_expr(&elem.expr, slot_ident)
      })
      .collect::<Option<Vec<_>>>()?,
    _ => return None,
  };

  Some(build_et_slot_array_expr(slot_entries))
}
