use swc_core::{
  common::{comments::Comments, DUMMY_SP},
  ecma::ast::*,
  quote,
};
use swc_plugins_shared::target::TransformTarget;

use super::{
  attr_name::AttrName,
  extractor::{DynamicAttributePart, DynamicElementPart},
  JSXTransformer,
};

pub(super) struct LoweredRuntimeJsx {
  pub attrs: Vec<JSXAttrOrSpread>,
  pub children: Vec<JSXElementChild>,
}

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  pub(super) fn lower_runtime_jsx(
    &mut self,
    target: TransformTarget,
    _runtime_id: Expr,
    key: Option<JSXAttrValue>,
    dynamic_attrs: Vec<DynamicAttributePart>,
    dynamic_children: Vec<DynamicElementPart>,
  ) -> LoweredRuntimeJsx {
    let mut attr_slot_values: Vec<Option<ExprOrSpread>> = vec![];
    let mut rendered_attrs: Vec<JSXAttrOrSpread> = vec![];

    if let Some(key) = key {
      rendered_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::new("key".into(), DUMMY_SP)),
        value: Some(key),
      }));
    }

    for dynamic_attr in dynamic_attrs {
      match dynamic_attr {
        DynamicAttributePart::Attr {
          value,
          attr_name,
          slot_index,
        } => {
          let slot_value = if let AttrName::Event = attr_name {
            if target == TransformTarget::LEPUS {
              quote!("1" as Expr)
            } else {
              value
            }
          } else if let AttrName::Ref = attr_name {
            if target == TransformTarget::LEPUS {
              quote!("1" as Expr)
            } else {
              value
            }
          } else if let AttrName::WorkletRef = attr_name {
            quote!("null" as Expr)
          } else {
            value
          };
          let idx = usize::try_from(slot_index).expect("ET attr slot index must be non-negative");
          if attr_slot_values.len() <= idx {
            attr_slot_values.resize_with(idx + 1, || None);
          }
          debug_assert!(attr_slot_values[idx].is_none());
          attr_slot_values[idx] = Some(ExprOrSpread {
            spread: None,
            expr: Box::new(slot_value),
          });
        }
        DynamicAttributePart::Spread { value, slot_index } => {
          let idx = usize::try_from(slot_index).expect("ET attr slot index must be non-negative");
          if attr_slot_values.len() <= idx {
            attr_slot_values.resize_with(idx + 1, || None);
          }
          debug_assert!(attr_slot_values[idx].is_none());
          attr_slot_values[idx] = Some(ExprOrSpread {
            spread: None,
            expr: Box::new(value),
          });
        }
      }
    }

    if !attr_slot_values.is_empty() {
      rendered_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::new("attributeSlots".into(), DUMMY_SP)),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: attr_slot_values,
          }))),
        })),
      }));
    }

    for dynamic_child in dynamic_children {
      let (slot_index, expr) = match dynamic_child {
        DynamicElementPart::Slot(expr, idx) | DynamicElementPart::ListSlot(expr, idx) => {
          (idx, expr)
        }
      };
      rendered_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::new(format!("${}", slot_index).into(), DUMMY_SP)),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(expr)),
        })),
      }));
    }

    LoweredRuntimeJsx {
      attrs: rendered_attrs,
      children: vec![],
    }
  }
}
