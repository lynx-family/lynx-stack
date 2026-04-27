use swc_core::{
  common::{SyntaxContext, DUMMY_SP},
  ecma::ast::*,
};

pub(super) const ET_SLOT_PLACEHOLDER_TAG: &str = "__et_slot_placeholder";
const ET_SLOT_PLACEHOLDER_INDEX_ATTR: &str = "__et_slot_index";

fn number_jsx_attr(value: i32) -> JSXAttrValue {
  JSXAttrValue::JSXExprContainer(JSXExprContainer {
    span: DUMMY_SP,
    expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Num(Number {
      span: DUMMY_SP,
      value: value as f64,
      raw: None,
    })))),
  })
}

pub(super) fn slot_placeholder_node(slot_index: i32, self_closing: bool) -> JSXElement {
  let name = JSXElementName::Ident(Ident::new(
    ET_SLOT_PLACEHOLDER_TAG.into(),
    DUMMY_SP,
    SyntaxContext::default(),
  ));
  JSXElement {
    span: DUMMY_SP,
    opening: JSXOpeningElement {
      span: DUMMY_SP,
      name: name.clone(),
      attrs: vec![JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::new(
          ET_SLOT_PLACEHOLDER_INDEX_ATTR.into(),
          DUMMY_SP,
        )),
        value: Some(number_jsx_attr(slot_index)),
      })],
      self_closing,
      type_args: None,
    },
    closing: (!self_closing).then_some(JSXClosingElement {
      span: DUMMY_SP,
      name,
    }),
    children: vec![],
  }
}

pub(super) fn is_slot_placeholder(n: &JSXElement) -> bool {
  matches!(
    &n.opening.name,
    JSXElementName::Ident(ident) if ident.sym == ET_SLOT_PLACEHOLDER_TAG
  )
}

pub(super) fn slot_placeholder_index(n: &JSXElement) -> Option<i32> {
  n.opening.attrs.iter().find_map(|attr| {
    let JSXAttrOrSpread::JSXAttr(attr) = attr else {
      return None;
    };
    let JSXAttrName::Ident(name) = &attr.name else {
      return None;
    };
    if name.sym != ET_SLOT_PLACEHOLDER_INDEX_ATTR {
      return None;
    }
    let Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::Expr(expr),
      ..
    })) = &attr.value
    else {
      return None;
    };
    let Expr::Lit(Lit::Num(Number { value, .. })) = &**expr else {
      return None;
    };

    Some(*value as i32)
  })
}
