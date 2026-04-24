use swc_core::{
  common::{comments::Comments, DUMMY_SP},
  ecma::ast::*,
  quote,
};
use swc_plugins_shared::jsx_helpers::{jsx_name, jsx_text_to_str, transform_jsx_attr_str};

use super::{
  i32_to_expr,
  template_attribute::{template_attribute_descriptor_key, TemplateAttributeSlot},
  template_slot::{is_slot_placeholder, slot_placeholder_index},
  JSXTransformer,
};

impl<C> JSXTransformer<C>
where
  C: Comments + Clone,
{
  // Template Definition owns ET's serialized tree/descriptor contract.
  pub(super) fn element_template_to_json(&self, expr: &Expr) -> serde_json::Value {
    // Build descriptors with SWC Expr helpers first so the golden tests can inspect
    // the same shape as codegen. Serialization intentionally accepts only the
    // literal/object/array subset that belongs in the native Template Definition.
    match expr {
      Expr::Lit(lit) => match lit {
        Lit::Str(s) => serde_json::Value::String(s.value.as_str().unwrap_or("").to_string()),
        Lit::Num(n) => serde_json::Number::from_f64(n.value)
          .map(serde_json::Value::Number)
          .unwrap_or(serde_json::Value::Null),
        Lit::Bool(b) => serde_json::Value::Bool(b.value),
        Lit::Null(_) => serde_json::Value::Null,
        _ => serde_json::Value::Null,
      },
      Expr::Array(arr) => {
        let elems: Vec<serde_json::Value> = arr
          .elems
          .iter()
          .map(|elem| {
            if let Some(elem) = elem {
              self.element_template_to_json(&elem.expr)
            } else {
              serde_json::Value::Null
            }
          })
          .collect();
        serde_json::Value::Array(elems)
      }
      Expr::Object(obj) => {
        let mut map = serde_json::Map::new();
        for prop in &obj.props {
          if let PropOrSpread::Prop(prop) = prop {
            if let Prop::KeyValue(kv) = &**prop {
              let key;
              if let PropName::Ident(ident) = &kv.key {
                key = ident.sym.as_str().to_string();
              } else if let PropName::Str(s) = &kv.key {
                key = s.value.as_str().unwrap_or("").to_string();
              } else {
                continue;
              };
              let value = self.element_template_to_json(&kv.value);
              map.insert(key, value);
            }
          }
        }
        serde_json::Value::Object(map)
      }
      _ => serde_json::Value::Null,
    }
  }

  fn element_template_string_expr(&self, value: &str) -> Expr {
    Expr::Lit(Lit::Str(Str {
      span: DUMMY_SP,
      raw: None,
      value: value.into(),
    }))
  }

  fn element_template_array_expr(&self, items: Vec<Expr>) -> Expr {
    Expr::Array(ArrayLit {
      span: DUMMY_SP,
      elems: items
        .into_iter()
        .map(|expr| {
          Some(ExprOrSpread {
            spread: None,
            expr: Box::new(expr),
          })
        })
        .collect(),
    })
  }

  fn element_template_static_attribute_descriptor(&self, key: &str, value: Expr) -> Expr {
    quote!(
      r#"{ kind: "attribute", key: $key, binding: "static", value: $value }"# as Expr,
      key: Expr = self.element_template_string_expr(key),
      value: Expr = value,
    )
  }

  fn element_template_attribute_slot_descriptor(&self, key: &str, attr_slot_index: i32) -> Expr {
    quote!(
      r#"{ kind: "attribute", key: $key, binding: "slot", attrSlotIndex: $attr_slot_index }"# as Expr,
      key: Expr = self.element_template_string_expr(key),
      attr_slot_index: Expr = i32_to_expr(&attr_slot_index),
    )
  }

  fn element_template_spread_slot_descriptor(&self, attr_slot_index: i32) -> Expr {
    quote!(
      r#"{ kind: "spread", binding: "slot", attrSlotIndex: $attr_slot_index }"# as Expr,
      attr_slot_index: Expr = i32_to_expr(&attr_slot_index),
    )
  }

  fn element_template_element_slot(&self, element_slot_index: i32) -> Expr {
    quote!(
      r#"{ kind: "elementSlot", type: "slot", elementSlotIndex: $element_slot_index }"# as Expr,
      element_slot_index: Expr = i32_to_expr(&element_slot_index),
    )
  }

  fn element_template_element_node(
    &self,
    tag: &str,
    attributes: Vec<Expr>,
    children: Vec<Expr>,
  ) -> Expr {
    quote!(
      r#"{ kind: "element", type: $tag, attributesArray: $attributes, children: $children }"# as Expr,
      tag: Expr = self.element_template_string_expr(tag),
      attributes: Expr = self.element_template_array_expr(attributes),
      children: Expr = self.element_template_array_expr(children),
    )
  }

  fn next_dynamic_attribute_slot<'a>(
    &self,
    dynamic_attr_slots: &'a [TemplateAttributeSlot],
    dynamic_attr_slot_cursor: &mut usize,
  ) -> &'a TemplateAttributeSlot {
    let slot = dynamic_attr_slots
      .get(*dynamic_attr_slot_cursor)
      .unwrap_or_else(|| {
        panic!(
          "Template Definition requested attr slot {}, but extractor produced only {} slots",
          *dynamic_attr_slot_cursor,
          dynamic_attr_slots.len()
        )
      });
    *dynamic_attr_slot_cursor += 1;
    slot
  }

  fn element_template_from_jsx_children(
    &self,
    children: &[JSXElementChild],
    dynamic_attr_slots: &[TemplateAttributeSlot],
    dynamic_attr_slot_cursor: &mut usize,
    element_slot_index: &mut i32,
  ) -> Vec<Expr> {
    let mut out: Vec<Expr> = vec![];

    for child in children {
      match child {
        JSXElementChild::JSXText(txt) => {
          let s = jsx_text_to_str(&txt.value);
          if s.trim().is_empty() {
            continue;
          }

          out.push(self.element_template_element_node(
            "raw-text",
            vec![self.element_template_static_attribute_descriptor(
              "text",
              self.element_template_string_expr(s.as_ref()),
            )],
            vec![],
          ));
        }
        JSXElementChild::JSXElement(el) => out.push(self.element_template_from_jsx_element_impl(
          el,
          dynamic_attr_slots,
          dynamic_attr_slot_cursor,
          element_slot_index,
        )),
        JSXElementChild::JSXFragment(frag) => {
          out.extend(self.element_template_from_jsx_children(
            &frag.children,
            dynamic_attr_slots,
            dynamic_attr_slot_cursor,
            element_slot_index,
          ));
        }
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(_),
          ..
        }) => {
          let idx = *element_slot_index;
          *element_slot_index += 1;
          out.push(self.element_template_element_slot(idx));
        }
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::JSXEmptyExpr(_),
          ..
        }) => {}
        JSXElementChild::JSXSpreadChild(_) => {
          let idx = *element_slot_index;
          *element_slot_index += 1;
          out.push(self.element_template_element_slot(idx));
        }
      }
    }

    out
  }

  pub(super) fn element_template_from_jsx_element(
    &self,
    n: &JSXElement,
    dynamic_attr_slots: &[TemplateAttributeSlot],
    dynamic_attr_slot_cursor: &mut usize,
    element_slot_index: &mut i32,
  ) -> Expr {
    self.element_template_from_jsx_element_impl(
      n,
      dynamic_attr_slots,
      dynamic_attr_slot_cursor,
      element_slot_index,
    )
  }

  fn element_template_from_jsx_element_impl(
    &self,
    n: &JSXElement,
    dynamic_attr_slots: &[TemplateAttributeSlot],
    dynamic_attr_slot_cursor: &mut usize,
    element_slot_index: &mut i32,
  ) -> Expr {
    if is_slot_placeholder(n) {
      let idx = slot_placeholder_index(n).unwrap_or_else(|| {
        let idx = *element_slot_index;
        *element_slot_index += 1;
        idx
      });
      return self.element_template_element_slot(idx);
    }

    let tag_expr = jsx_name(n.opening.name.clone());
    let tag_value = match *tag_expr {
      Expr::Lit(Lit::Str(s)) => s.value,
      _ => "".into(),
    };

    let mut attribute_descriptors: Vec<Expr> = vec![];

    for attr in &n.opening.attrs {
      match attr {
        JSXAttrOrSpread::JSXAttr(attr) => {
          let key = template_attribute_descriptor_key(&attr.name);

          if key == "__lynx_part_id" {
            continue;
          }

          let static_value = match &attr.value {
            None => Some(Expr::Lit(Lit::Bool(Bool {
              span: DUMMY_SP,
              value: true,
            }))),
            Some(JSXAttrValue::Str(s)) => Some(Expr::Lit(Lit::Str(Str {
              span: s.span,
              value: transform_jsx_attr_str(&s.value).into(),
              raw: None,
            }))),
            Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
              expr: JSXExpr::Expr(expr),
              ..
            })) => match &**expr {
              Expr::Lit(Lit::Str(s)) => Some(Expr::Lit(Lit::Str(s.clone()))),
              Expr::Lit(Lit::Num(n)) => Some(Expr::Lit(Lit::Num(n.clone()))),
              Expr::Lit(Lit::Bool(b)) => Some(Expr::Lit(Lit::Bool(*b))),
              Expr::Lit(Lit::Null(n)) => Some(Expr::Lit(Lit::Null(*n))),
              // TODO: Support complex static values (Object, Array, Template Literal without expressions)
              // See ElementTemplate/Todo-StaticAttributesOpts.md
              _ => None,
            },
            _ => None,
          };

          if let Some(static_value) = static_value {
            attribute_descriptors
              .push(self.element_template_static_attribute_descriptor(&key, static_value));
          } else {
            match self.next_dynamic_attribute_slot(dynamic_attr_slots, dynamic_attr_slot_cursor) {
              TemplateAttributeSlot::Attr {
                key: slot_key,
                slot_index,
              } => {
                debug_assert_eq!(
                  slot_key, &key,
                  "Template Definition attr slot key must match extractor output"
                );
                attribute_descriptors
                  .push(self.element_template_attribute_slot_descriptor(slot_key, *slot_index));
              }
              TemplateAttributeSlot::Spread { .. } => {
                panic!("Template Definition expected attribute slot for {key}, got spread slot")
              }
            }
          }
        }
        JSXAttrOrSpread::SpreadElement(_) => {
          match self.next_dynamic_attribute_slot(dynamic_attr_slots, dynamic_attr_slot_cursor) {
            TemplateAttributeSlot::Spread { slot_index } => {
              attribute_descriptors.push(self.element_template_spread_slot_descriptor(*slot_index));
            }
            TemplateAttributeSlot::Attr { key, .. } => {
              panic!("Template Definition expected spread slot, got attribute slot for {key}")
            }
          }
        }
      }
    }

    // Optimization for text tags:
    // If <text> (or similar) has only one static text child, use `text` attribute instead of checking children.
    let is_text_tag = tag_value == "text"
      || tag_value == "raw-text"
      || tag_value == "inline-text"
      || tag_value == "x-text"
      || tag_value == "x-inline-text";
    let mut text_child_optimized = false;

    if is_text_tag {
      let valid_children: Vec<&JSXElementChild> = n
        .children
        .iter()
        .filter(|c| match c {
          JSXElementChild::JSXText(t) => !jsx_text_to_str(&t.value).trim().is_empty(),
          _ => true,
        })
        .collect();

      if valid_children.len() == 1 {
        if let JSXElementChild::JSXText(txt) = valid_children[0] {
          let s = jsx_text_to_str(&txt.value);
          attribute_descriptors.push(self.element_template_static_attribute_descriptor(
            "text",
            self.element_template_string_expr(s.as_ref()),
          ));
          text_child_optimized = true;
        }
      }
    }

    let children = if text_child_optimized {
      vec![]
    } else {
      self.element_template_from_jsx_children(
        &n.children,
        dynamic_attr_slots,
        dynamic_attr_slot_cursor,
        element_slot_index,
      )
    };

    let final_tag = tag_value.to_string_lossy().to_string();
    self.element_template_element_node(&final_tag, attribute_descriptors, children)
  }
}
