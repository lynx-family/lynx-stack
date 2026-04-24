use once_cell::sync::Lazy;
use std::collections::HashSet;

use swc_core::{
  common::{util::take::Take, Span, DUMMY_SP},
  ecma::{
    ast::{JSXExpr, *},
    utils::is_literal,
    visit::{VisitMut, VisitMutWith},
  },
  quote_expr,
};
use swc_plugins_shared::{
  css::get_string_inline_style_from_literal,
  jsx_helpers::{
    jsx_attr_name, jsx_attr_value, jsx_children_to_expr, jsx_has_dynamic_key,
    jsx_is_children_full_dynamic, jsx_is_custom, jsx_is_list, jsx_text_to_str,
  },
};

use super::attr_name::AttrName;
use super::template_attribute::{
  template_attribute_key, template_namespaced_attribute_descriptor_key, TemplateAttributeSlot,
};
use super::template_slot::{is_slot_placeholder, slot_placeholder_node};

static NO_FLATTEN_ATTRIBUTES: Lazy<HashSet<String>> = Lazy::new(|| {
  HashSet::from([
    "name".to_string(),
    "clip-radius".to_string(),
    "overlap".to_string(),
    "exposure-scene".to_string(),
    "exposure-id".to_string(),
  ])
});

#[derive(Debug)]
pub(super) enum DynamicAttributePart {
  Attr {
    value: Expr,
    attr_name: AttrName,
    slot_index: i32,
  },
  Spread {
    value: Expr,
    slot_index: i32,
  },
}

#[derive(Debug)]
pub(super) enum DynamicElementPart {
  Slot(Expr, i32),
  ListSlot(Expr, i32),
}

pub(super) struct ExtractedTemplateParts {
  pub key: Option<JSXAttrValue>,
  pub dynamic_attrs: Vec<DynamicAttributePart>,
  pub dynamic_attr_slots: Vec<TemplateAttributeSlot>,
  pub dynamic_children: Vec<DynamicElementPart>,
}

fn bool_jsx_attr(value: bool) -> JSXAttrValue {
  JSXAttrValue::JSXExprContainer(JSXExprContainer {
    span: DUMMY_SP,
    expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Bool(Bool {
      span: DUMMY_SP,
      value,
    })))),
  })
}

pub(super) struct ElementTemplateExtractor<'a, V, F>
where
  V: VisitMut,
  F: Fn(Span) -> Expr,
{
  parent_element: bool,
  dynamic_attrs: Vec<DynamicAttributePart>,
  dynamic_attr_slots: Vec<TemplateAttributeSlot>,
  dynamic_children: Vec<DynamicElementPart>,
  dynamic_part_visitor: &'a mut V,
  pub(super) key: Option<JSXAttrValue>,
  attr_slot_counter: i32,
  element_slot_counter: i32,
  enable_ui_source_map: bool,
  node_index_fn: F,
}

impl<'a, V, F> ElementTemplateExtractor<'a, V, F>
where
  V: VisitMut,
  F: Fn(Span) -> Expr,
{
  pub(super) fn new(
    dynamic_part_visitor: &'a mut V,
    enable_ui_source_map: bool,
    node_index_fn: F,
  ) -> Self {
    Self {
      parent_element: false,
      dynamic_attrs: vec![],
      dynamic_attr_slots: vec![],
      dynamic_children: vec![],
      dynamic_part_visitor,
      key: None,
      attr_slot_counter: 0,
      element_slot_counter: 0,
      enable_ui_source_map,
      node_index_fn,
    }
  }

  fn record_node_index(&self, span: Span) {
    if self.enable_ui_source_map {
      let _ = (self.node_index_fn)(span);
    }
  }

  fn next_attr_slot_index(&mut self) -> i32 {
    let idx = self.attr_slot_counter;
    self.attr_slot_counter += 1;
    idx
  }

  fn next_children_slot_index(&mut self) -> i32 {
    let idx = self.element_slot_counter;
    self.element_slot_counter += 1;
    idx
  }

  fn push_dynamic_attr(&mut self, value: Expr, attr_name: AttrName, key: &str) {
    let slot_index = self.next_attr_slot_index();
    self.dynamic_attr_slots.push(TemplateAttributeSlot::Attr {
      key: key.to_string(),
      slot_index,
    });
    self.dynamic_attrs.push(DynamicAttributePart::Attr {
      value,
      attr_name,
      slot_index,
    });
  }

  fn push_dynamic_spread(&mut self, value: Expr) {
    let slot_index = self.next_attr_slot_index();
    self
      .dynamic_attr_slots
      .push(TemplateAttributeSlot::Spread { slot_index });
    self
      .dynamic_attrs
      .push(DynamicAttributePart::Spread { value, slot_index });
  }

  fn normalize_inline_styles_if_static(&self, value: &mut Option<JSXAttrValue>) {
    let mut static_style_val = None;
    if let Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::Expr(expr),
      span,
      ..
    })) = value
    {
      let expr = &**expr;
      if is_literal(expr) {
        if let Some(s) = get_string_inline_style_from_literal(expr, span) {
          static_style_val = Some((s, *span));
        }
      }
    }

    if let Some((s_val, span)) = static_style_val {
      *value = Some(JSXAttrValue::Str(Str {
        span,
        value: s_val.into(),
        raw: None,
      }));
    }
  }

  fn push_dynamic_jsx_attr(
    &mut self,
    attr_name: AttrName,
    key: &str,
    value: &mut Option<JSXAttrValue>,
    preserve_literal_expr: bool,
  ) {
    match &attr_name {
      AttrName::Attr | AttrName::Dataset | AttrName::Class | AttrName::ID => {
        if let Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(expr),
          ..
        })) = value
        {
          if !(preserve_literal_expr && matches!(&**expr, Expr::Lit(_))) {
            self.push_dynamic_attr(*expr.clone(), attr_name, key);
          }
        }
      }
      AttrName::Style => {
        self.normalize_inline_styles_if_static(value);
        if let Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(expr),
          ..
        })) = value
        {
          self.push_dynamic_attr(*expr.clone(), attr_name, key);
        }
      }
      AttrName::Event | AttrName::Ref => {
        self.push_dynamic_attr(*jsx_attr_value((*value).clone()), attr_name, key);
      }
      AttrName::TimingFlag => {
        self.push_dynamic_attr(
          *quote_expr!("{__ltf: $flag}", flag: Expr = *jsx_attr_value((*value).clone())),
          attr_name,
          key,
        );
      }
      AttrName::WorkletEvent | AttrName::WorkletRef | AttrName::Gesture => {
        self.push_dynamic_attr(*jsx_attr_value((*value).clone()), attr_name, key);
      }
    }
  }

  fn ensure_flatten_attr(&self, n: &mut JSXElement) {
    let mut flatten = None;
    for attr in &n.opening.attrs {
      if let JSXAttrOrSpread::JSXAttr(attr) = attr {
        let name = jsx_attr_name(&attr.name.clone()).to_string();
        if NO_FLATTEN_ATTRIBUTES.contains(&name) {
          flatten = Some(JSXAttrOrSpread::JSXAttr(JSXAttr {
            span: DUMMY_SP,
            name: JSXAttrName::Ident(IdentName::new("flatten".into(), DUMMY_SP)),
            value: Some(bool_jsx_attr(false)),
          }));
          break;
        }
      }
    }

    if let Some(flatten) = flatten {
      let mut has_origin_flatten = false;
      for attr in &mut n.opening.attrs {
        if let JSXAttrOrSpread::JSXAttr(attr) = attr {
          let name = jsx_attr_name(&attr.name.clone()).to_string();
          if name == *"flatten" {
            attr.value = Some(bool_jsx_attr(false));
            has_origin_flatten = true;
          }
        }
      }
      if !has_origin_flatten {
        n.opening.attrs.push(flatten);
      }
    }
  }

  fn push_dynamic_jsx_attr_by_name(
    &mut self,
    name: &JSXAttrName,
    value: &mut Option<JSXAttrValue>,
  ) {
    match name {
      JSXAttrName::Ident(ident_name) => {
        let key = template_attribute_key(ident_name.sym.as_ref()).to_string();
        let attr_name = AttrName::from(<IdentName as Into<Ident>>::into(ident_name.clone()));
        self.push_dynamic_jsx_attr(attr_name, &key, value, true);
      }
      JSXAttrName::JSXNamespacedName(JSXNamespacedName { ns, name, .. }) => {
        let key = template_namespaced_attribute_descriptor_key(ns, name);
        let attr_name = AttrName::from_ns(ns.clone().into(), name.clone().into());
        match attr_name {
          AttrName::WorkletEvent | AttrName::WorkletRef | AttrName::Gesture => {
            self.push_dynamic_jsx_attr(attr_name, &key, value, false);
          }
          _ => todo!(),
        }
      }
    }
  }

  fn push_dynamic_jsx_attr_or_spread(&mut self, attr_or_spread: &mut JSXAttrOrSpread) {
    match attr_or_spread {
      JSXAttrOrSpread::SpreadElement(spread) => {
        self.push_dynamic_spread(*spread.expr.clone());
      }
      JSXAttrOrSpread::JSXAttr(JSXAttr { name, value, .. }) => {
        let name = name.clone();
        self.push_dynamic_jsx_attr_by_name(&name, value);
      }
    }
  }

  pub(super) fn into_extracted_template_parts(self) -> ExtractedTemplateParts {
    ExtractedTemplateParts {
      key: self.key,
      dynamic_attrs: self.dynamic_attrs,
      dynamic_attr_slots: self.dynamic_attr_slots,
      dynamic_children: self.dynamic_children,
    }
  }
}

impl<V, F> VisitMut for ElementTemplateExtractor<'_, V, F>
where
  V: VisitMut,
  F: Fn(Span) -> Expr,
{
  fn visit_mut_jsx_element_childs(&mut self, n: &mut Vec<JSXElementChild>) {
    if n.is_empty() {
      return;
    }

    let mut merged_children: Vec<JSXElementChild> = vec![];
    let mut current_chunk: Vec<JSXElementChild> = vec![];

    for mut child in n.take() {
      let should_merge = match child {
        JSXElementChild::JSXText(ref text) => {
          if jsx_text_to_str(&text.value).is_empty() {
            current_chunk.is_empty()
          } else {
            true
          }
        }
        JSXElementChild::JSXElement(ref element) => !jsx_is_custom(element),
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(_),
          ..
        }) => false,
        JSXElementChild::JSXFragment(_)
        | JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::JSXEmptyExpr(_),
          ..
        }) => true,
        JSXElementChild::JSXSpreadChild(_) => {
          unreachable!("JSXSpreadChild is not supported yet");
        }
      };

      if should_merge {
        if !current_chunk.is_empty() {
          current_chunk.visit_mut_with(self.dynamic_part_visitor);
          let slot_index = self.next_children_slot_index();
          self.dynamic_children.push(DynamicElementPart::Slot(
            jsx_children_to_expr(current_chunk.take()),
            slot_index,
          ));

          let mut child =
            JSXElementChild::JSXElement(Box::new(slot_placeholder_node(slot_index, false)));
          child.visit_mut_with(self);
          merged_children.push(child);
        }

        child.visit_mut_with(self);
        merged_children.push(child);
      } else {
        current_chunk.push(child);
      }
    }

    if !current_chunk.is_empty() {
      current_chunk.visit_mut_with(self.dynamic_part_visitor);
      let slot_index = self.next_children_slot_index();
      self.dynamic_children.push(DynamicElementPart::Slot(
        jsx_children_to_expr(current_chunk.take()),
        slot_index,
      ));

      let mut child =
        JSXElementChild::JSXElement(Box::new(slot_placeholder_node(slot_index, false)));
      child.visit_mut_with(self);
      merged_children.push(child);
    }

    *n = merged_children;
  }

  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    if is_slot_placeholder(n) {
      return;
    }

    if self.parent_element && jsx_is_list(n) {
      let slot_index = self.next_children_slot_index();
      n.visit_mut_with(self.dynamic_part_visitor);
      self.dynamic_children.push(DynamicElementPart::ListSlot(
        Expr::JSXElement(Box::new(n.take())),
        slot_index,
      ));

      *n = slot_placeholder_node(slot_index, true);
      n.visit_mut_with(self);
      return;
    }

    if !jsx_is_custom(n) {
      self.record_node_index(n.span);

      if jsx_has_dynamic_key(n) && self.parent_element {
        let is_list = jsx_is_list(n);
        n.visit_mut_with(self.dynamic_part_visitor);
        let expr = Expr::JSXElement(Box::new(n.take()));
        let slot_index = self.next_children_slot_index();

        if is_list {
          self
            .dynamic_children
            .push(DynamicElementPart::ListSlot(expr, slot_index));
        } else {
          self
            .dynamic_children
            .push(DynamicElementPart::Slot(expr, slot_index));
        }

        *n = slot_placeholder_node(slot_index, false);
      }

      self.ensure_flatten_attr(n);

      n.opening
        .attrs
        .retain_mut(|attr_or_spread| match attr_or_spread {
          JSXAttrOrSpread::SpreadElement(_) => true,
          JSXAttrOrSpread::JSXAttr(JSXAttr { name, value, .. }) => match name {
            JSXAttrName::Ident(ident_name) => match ident_name.sym.as_ref() {
              "key" => {
                if !self.parent_element {
                  self.key = value.take();
                }
                false
              }
              _ => true,
            },
            JSXAttrName::JSXNamespacedName(_) => true,
          },
        });

      for attr_or_spread in &mut n.opening.attrs {
        self.push_dynamic_jsx_attr_or_spread(attr_or_spread);
      }

      if !jsx_is_children_full_dynamic(n) {
        let previous_parent_element = self.parent_element;
        self.parent_element = true;
        n.visit_mut_children_with(self);
        self.parent_element = previous_parent_element;
      } else {
        n.visit_mut_children_with(self.dynamic_part_visitor);
        let children_expr = jsx_children_to_expr(n.children.take());
        let slot_index = self.next_children_slot_index();
        if jsx_is_list(n) {
          self
            .dynamic_children
            .push(DynamicElementPart::ListSlot(children_expr, slot_index));
        } else {
          self
            .dynamic_children
            .push(DynamicElementPart::Slot(children_expr, slot_index));
        }
        n.children = vec![JSXElementChild::JSXElement(Box::new(
          slot_placeholder_node(slot_index, true),
        ))];
      }
    } else {
      n.visit_mut_children_with(self.dynamic_part_visitor);

      if self.parent_element {
        let slot_index = self.next_children_slot_index();
        self.dynamic_children.push(DynamicElementPart::Slot(
          Expr::JSXElement(Box::new(n.take())),
          slot_index,
        ));

        *n = slot_placeholder_node(slot_index, true);
        n.visit_mut_with(self);
      }
    }
  }

  fn visit_mut_jsx_text(&mut self, n: &mut JSXText) {
    if !jsx_text_to_str(&n.value).is_empty() {
      self.record_node_index(n.span);
    }
  }
}
