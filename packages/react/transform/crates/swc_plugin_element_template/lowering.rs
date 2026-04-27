use swc_core::{
  common::{comments::Comments, DUMMY_SP},
  ecma::ast::*,
  quote,
};
use swc_plugins_shared::{jsx_helpers::jsx_children_to_expr, target::TransformTarget};

use super::{
  attr_name::AttrName,
  extractor::{DynamicAttributePart, DynamicElementPart},
  slot::{expr_to_jsx_child, lower_lepus_et_children_expr, wrap_in_slot},
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
    runtime_id: Expr,
    key: Option<JSXAttrValue>,
    dynamic_attrs: Vec<DynamicAttributePart>,
    dynamic_children: Vec<DynamicElementPart>,
  ) -> LoweredRuntimeJsx {
    let mut rendered_slot_children: Vec<JSXElementChild> = vec![];
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
              quote!(
                "$runtime_id.transformRef($value)" as Expr,
                runtime_id: Expr = runtime_id.clone(),
                value: Expr = value,
              )
            }
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

    match (dynamic_children.len(), dynamic_children.first()) {
      (0, _) => {}
      (1, Some(DynamicElementPart::Slot(expr, 0))) => {
        let child = expr_to_jsx_child(expr.clone());
        if target != TransformTarget::LEPUS {
          self.used_slot = true;
        }
        rendered_slot_children.push(wrap_in_slot(&self.slot_ident, 0, vec![child]));
      }
      _ => {
        for dynamic_child in dynamic_children {
          match dynamic_child {
            DynamicElementPart::ListSlot(expr, element_index) => {
              let child = expr_to_jsx_child(expr);
              if target != TransformTarget::LEPUS {
                self.used_slot = true;
              }
              rendered_slot_children.push(wrap_in_slot(
                &self.slot_ident,
                element_index,
                vec![child],
              ));
            }
            DynamicElementPart::Slot(expr, element_index) => {
              let child = expr_to_jsx_child(expr);
              if target != TransformTarget::LEPUS {
                self.used_slot = true;
              }
              rendered_slot_children.push(wrap_in_slot(
                &self.slot_ident,
                element_index,
                vec![child],
              ));
            }
          }
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

    if target == TransformTarget::LEPUS && !rendered_slot_children.is_empty() {
      let children_expr = jsx_children_to_expr(rendered_slot_children);
      let lowered_children_expr = lower_lepus_et_children_expr(children_expr, &self.slot_ident)
        .expect("LEPUS ET children should already be lowered to slot arrays");
      rendered_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
        span: DUMMY_SP,
        name: JSXAttrName::Ident(IdentName::new("children".into(), DUMMY_SP)),
        value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(lowered_children_expr)),
        })),
      }));
      return LoweredRuntimeJsx {
        attrs: rendered_attrs,
        children: vec![],
      };
    }

    LoweredRuntimeJsx {
      attrs: rendered_attrs,
      children: rendered_slot_children,
    }
  }
}
