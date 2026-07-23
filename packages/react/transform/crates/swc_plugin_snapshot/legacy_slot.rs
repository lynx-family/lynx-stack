//! Frozen legacy (pre-SlotV2) snapshot codegen, enabled by the
//! `legacySlot` config (`pluginReactLynx({ compat: { legacySlot: true } })`).
//!
//! This module compiles dynamic children as children + wrapper (`Slot`/
//! `Children`/`ListChildren` dynamic parts rendered through wrapper
//! elements), matching the output consumed by `@lynx-js/react` runtimes
//! without `SlotV2` support (< 0.120.0, before #1764).
//!
//! It is intentionally self-contained and FROZEN: do not refactor it along
//! with the default (SlotV2) codegen in `lib.rs`, and do not "fix" it to
//! follow mainline changes — its whole purpose is to keep emitting exactly
//! the output that legacy runtimes were verified against.

use std::{cell::RefCell, collections::HashMap};

use once_cell::sync::Lazy;
use swc_core::{
  common::{comments::Comments, util::take::Take, Mark, Span, Spanned, SyntaxContext, DUMMY_SP},
  ecma::{
    ast::{JSXExpr, *},
    utils::{is_literal, private_ident},
    visit::{VisitMut, VisitMutWith},
  },
  quote, quote_expr,
};

use swc_plugins_shared::{
  css::get_string_inline_style_from_literal,
  jsx_helpers::{
    jsx_attr_name, jsx_attr_to_prop, jsx_attr_value, jsx_children_to_expr, jsx_has_dynamic_key,
    jsx_is_children_full_dynamic, jsx_is_custom, jsx_is_list, jsx_is_list_item, jsx_name,
    jsx_props_to_obj, jsx_text_to_str, transform_jsx_attr_str,
  },
  target::TransformTarget,
  utils::calc_hash_number,
};

use super::{
  attr_name::AttrName, bool_jsx_attr, bool_to_expr, i32_to_expr, JSXTransformer, UISourceMapRecord,
  NO_FLATTEN_ATTRIBUTES, WRAPPER_NODE, WRAPPER_NODE_2,
};

// ---------------------------------------------------------------------------
// Wrapper marker pre-pass (formerly slot_marker.rs)
// ---------------------------------------------------------------------------

pub static INTERNAL_SLOT_STR: &str = "internal-slot";

pub fn jsx_is_internal_slot(jsx: &JSXElement) -> bool {
  match *jsx_name(jsx.opening.name.clone()) {
    Expr::Lit(Lit::Str(s)) => s.value.to_string_lossy().as_ref() == INTERNAL_SLOT_STR,
    _ => false,
  }
}

pub fn jsx_unwrap_internal_slot(mut jsx: JSXElement) -> JSXElement {
  if jsx_is_internal_slot(&jsx) {
    if let Some(JSXElementChild::JSXElement(jsx)) = jsx.children.first_mut() {
      return *jsx.take();
    }
  }
  unreachable!("unwrap_internal_slot");
}

fn jsx_wrapped(with: &str, n: JSXElement) -> JSXElement {
  JSXElement {
    span: DUMMY_SP,
    opening: JSXOpeningElement {
      span: DUMMY_SP,
      name: JSXElementName::Ident(IdentName::new(with.into(), DUMMY_SP).into()),
      attrs: vec![],
      self_closing: false,
      type_args: None,
    },
    closing: Some(JSXClosingElement {
      span: DUMMY_SP,
      name: JSXElementName::Ident(IdentName::new(with.into(), DUMMY_SP).into()),
    }),
    children: vec![JSXElementChild::JSXElement(Box::new(n))],
  }
}

// Wrap dynamic part with wrapper node (or if it's children is full dynamic, do nothing)
// after this pass, all dynamic part will be wrapped with wrapper node
pub struct WrapperMarker {
  pub current_is_children_full_dynamic: bool,
  pub dynamic_part_count: i32,
}

impl VisitMut for WrapperMarker {
  fn visit_mut_jsx_element_childs(&mut self, n: &mut Vec<JSXElementChild>) {
    if self.current_is_children_full_dynamic {
      return;
    }

    if n.is_empty() {
      return;
    }

    // merge dynamic parts together to reduce wrapper node count

    let mut merged_children: Vec<JSXElementChild> = vec![];
    let mut current_chunk: Vec<JSXElementChild> = vec![];
    for mut child in n.take() {
      let should_merge: bool;
      match child {
        JSXElementChild::JSXText(ref text) => {
          if jsx_text_to_str(&text.value).is_empty() {
            should_merge = current_chunk.is_empty();
          } else {
            should_merge = true;
          }
        }
        JSXElementChild::JSXElement(ref element) => {
          should_merge = !jsx_is_custom(element);
        }
        JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(ref _expr),
          ..
        }) => {
          should_merge = false;
        }
        JSXElementChild::JSXFragment(_)
        | JSXElementChild::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::JSXEmptyExpr(_),
          ..
        }) => {
          should_merge = true;
        }
        JSXElementChild::JSXSpreadChild(_) => {
          unreachable!("JSXSpreadChild is not supported yet");
        }
      }

      if should_merge {
        if !current_chunk.is_empty() {
          let child = JSXElementChild::JSXElement(Box::new({
            let mut el = WRAPPER_NODE_2.clone();
            el.children = current_chunk.take();
            jsx_wrapped(INTERNAL_SLOT_STR, el)
          }));
          merged_children.push(child);
          self.dynamic_part_count += 1;
        }

        child.visit_mut_with(self);
        merged_children.push(child);
      } else {
        current_chunk.push(child);
      }
    }

    if !current_chunk.is_empty() {
      let child = JSXElementChild::JSXElement(Box::new({
        let mut el = WRAPPER_NODE_2.clone();
        el.children = current_chunk.take();
        jsx_wrapped(INTERNAL_SLOT_STR, el)
      }));
      merged_children.push(child);
      self.dynamic_part_count += 1;
    }

    *n = merged_children;
  }

  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    if jsx_is_custom(n) {
      // always ignore top level custom element
    } else {
      // let is_children_full_static = jsx_is_children_full_static(&n);
      // let is_list = jsx_is_list(&n) || !is_children_full_static;
      // let is_children_full_dynamic = is_list || jsx_is_children_full_dynamic(&n);

      let is_list = jsx_is_list(n);
      let is_children_full_dynamic = is_list || jsx_is_children_full_dynamic(n);
      let has_dynamic_key = jsx_has_dynamic_key(n);

      if (is_list || has_dynamic_key) && !n.children.is_empty() {
        n.children = vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(jsx_children_to_expr(n.children.take()))),
        })];
      }

      if is_children_full_dynamic {
        self.dynamic_part_count += 1;
        *n = jsx_wrapped(INTERNAL_SLOT_STR, n.take());
      }

      let pre_is_children_full_dynamic = self.current_is_children_full_dynamic;
      self.current_is_children_full_dynamic = is_children_full_dynamic;
      n.visit_mut_children_with(self);
      self.current_is_children_full_dynamic = pre_is_children_full_dynamic;
    }
  }
}

// ---------------------------------------------------------------------------
// Legacy dynamic parts
// ---------------------------------------------------------------------------

#[derive(Debug)]
pub enum DynamicPart {
  Attr(Expr, i32, AttrName),
  Spread(Expr, i32, bool),
  Slot(JSXElement, i32),
  Children(Expr, i32),
  ListChildren(Expr, i32),
}

impl DynamicPart {
  fn to_updater(&self, runtime_id: Expr, target: TransformTarget, exp_index: i32) -> Expr {
    match target {
      TransformTarget::LEPUS | TransformTarget::MIXED => match self {
        DynamicPart::Attr(_, element_index, attr_name) => match attr_name {
          AttrName::Attr(name) => quote!(
            "function (ctx) {
              if (ctx.__elements) {
                __SetAttribute(ctx.__elements[$element_index], $name, ctx.__values[$exp_index]);
              }
            }" as Expr,
            name: Expr = Expr::Lit(Lit::Str(name.clone().into())),
            element_index: Expr = i32_to_expr(element_index),
            exp_index: Expr = i32_to_expr(&exp_index),
          ),
          AttrName::TimingFlag => quote!(
            "function (ctx) {
              if (ctx.__elements) {
                __SetAttribute(ctx.__elements[$element_index], '__lynx_timing_flag', ctx.__values[$exp_index].__ltf);
              }
            }" as Expr,
            element_index: Expr = i32_to_expr(element_index),
            exp_index: Expr = i32_to_expr(&exp_index),
          ),
          AttrName::Dataset(name) => quote!(
            "function (ctx) {
              if (ctx.__elements) {
                __AddDataset(ctx.__elements[$element_index], $name, ctx.__values[$exp_index]);
              }
            }" as Expr,
            name: Expr = Expr::Lit(Lit::Str(name.clone().into())),
            element_index: Expr = i32_to_expr(element_index),
            exp_index: Expr = i32_to_expr(&exp_index),
          ),
          AttrName::Style => quote!(
            "function (ctx) {
              if (ctx.__elements) {
                __SetInlineStyles(ctx.__elements[$element_index], ctx.__values[$exp_index]);
              }
            }" as Expr,
            element_index: Expr = i32_to_expr(element_index),
            exp_index: Expr = i32_to_expr(&exp_index),
          ),
          AttrName::Class => quote!(
            "function (ctx) {
              if (ctx.__elements) {
                __SetClasses(ctx.__elements[$element_index], ctx.__values[$exp_index] || '');
              }
            }" as Expr,
            element_index: Expr = i32_to_expr(element_index),
            exp_index: Expr = i32_to_expr(&exp_index),
          ),
          AttrName::ID => quote!(
            "function (ctx) {
              if (ctx.__elements) {
                __SetID(ctx.__elements[$element_index], ctx.__values[$exp_index]);
              }
            }" as Expr,
            element_index: Expr = i32_to_expr(element_index),
            exp_index: Expr = i32_to_expr(&exp_index),
          ),
          AttrName::Event(event_type, event_name) => quote!(
            "(snapshot, index, oldValue) => $runtime_id.updateEvent(snapshot, index, oldValue, $element_index, $event_type, $event_name, '')" as Expr,
            runtime_id: Expr = runtime_id.clone(),
            event_type: Expr = Expr::Lit(Lit::Str(event_type.clone().into())),
            event_name: Expr = Expr::Lit(Lit::Str(event_name.clone().into())),
            element_index: Expr = i32_to_expr(element_index),
          ),
          AttrName::WorkletEvent(worklet_type, event_type, event_name) => quote!(
            "(snapshot, index, oldValue) => $runtime_id.updateWorkletEvent(snapshot, index, oldValue, $element_index, $worklet_type, $event_type, $event_name)" as Expr,
            runtime_id: Expr = runtime_id.clone(),
            worklet_type: Expr = Expr::Lit(Lit::Str(worklet_type.clone().into())),
            event_type: Expr = Expr::Lit(Lit::Str(event_type.clone().into())),
            event_name: Expr = Expr::Lit(Lit::Str(event_name.clone().into())),
            element_index: Expr = i32_to_expr(element_index),
          ),
          AttrName::Ref => quote!(
            "(snapshot, index, oldValue) => $runtime_id.updateRef(snapshot, index, oldValue, $element_index)" as Expr,
            runtime_id: Expr = runtime_id.clone(),
            element_index: Expr = i32_to_expr(element_index),
          ),
          AttrName::WorkletRef(worklet_type) => quote!(
            "(snapshot, index, oldValue) => $runtime_id.updateWorkletRef(snapshot, index, oldValue, $element_index, $worklet_type)" as Expr,
            runtime_id: Expr = runtime_id.clone(),
            element_index: Expr = i32_to_expr(element_index),
            worklet_type: Expr = Expr::Lit(Lit::Str(worklet_type.clone().into())),
          ),
          AttrName::ListItemPlatformInfo => quote!(
            "(snapshot, index, oldValue) => $runtime_id.updateListItemPlatformInfo(snapshot, index, oldValue, $element_index)" as Expr,
            runtime_id: Expr = runtime_id.clone(),
            element_index: Expr = i32_to_expr(element_index),
          ),
          AttrName::Gesture(ns) => quote!(
            "(snapshot, index, oldValue) => $runtime_id.updateGesture(snapshot, index, oldValue, $element_index, $ns)" as Expr,
            runtime_id: Expr = runtime_id.clone(),
            element_index: Expr = i32_to_expr(element_index),
            ns: Expr = Expr::Lit(Lit::Str(ns.clone().into())),
          ),
        },
        DynamicPart::Spread(_, element_index, is_list_item) => quote!(
          "(snapshot, index, oldValue) => $runtime_id.updateSpread(snapshot, index, oldValue, $element_index, $is_list_item)" as Expr,
          runtime_id: Expr = runtime_id.clone(),
          element_index: Expr = i32_to_expr(element_index),
          is_list_item: Expr = bool_to_expr(is_list_item)
        ),
        DynamicPart::Slot(_, _) => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
        DynamicPart::Children(_, _) => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
        DynamicPart::ListChildren(_, _) => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
      },
      TransformTarget::JS => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
    }
  }
}

pub struct DynamicPartExtractor<'a, V, F>
where
  V: VisitMut,
  F: Fn(Span) -> Expr,
{
  page_id: Lazy<Ident>,
  runtime_id: Expr,
  parent_element: Option<Ident>,
  element_index: i32,
  element_ids: HashMap<i32, Ident>,
  static_stmts: Vec<RefCell<Stmt>>,
  si_id: Lazy<Ident>,
  snapshot_creator: Option<Function>,
  dynamic_part_count: i32,
  dynamic_parts: Vec<DynamicPart>,
  dynamic_part_visitor: &'a mut V,
  key: Option<JSXAttrValue>,
  enable_ui_source_map: bool,
  node_index_fn: F,
}

impl<'a, V, F> DynamicPartExtractor<'a, V, F>
where
  V: VisitMut,
  F: Fn(Span) -> Expr,
{
  fn new(
    runtime_id: Expr,
    dynamic_part_count: i32,
    dynamic_part_visitor: &'a mut V,
    enable_ui_source_map: bool,
    node_index_fn: F,
  ) -> Self {
    DynamicPartExtractor {
      page_id: Lazy::new(|| private_ident!("pageId")),
      runtime_id,
      parent_element: None,
      element_index: 0,
      element_ids: HashMap::new(),
      static_stmts: vec![],
      si_id: Lazy::new(|| private_ident!("snapshotInstance")),
      snapshot_creator: None,
      dynamic_part_count,
      dynamic_parts: vec![],
      dynamic_part_visitor,
      key: None,
      enable_ui_source_map,
      node_index_fn,
    }
  }

  fn node_index_expr_from_span(&self, span: Span) -> Expr {
    (self.node_index_fn)(span)
  }

  fn node_index_config_expr(&self, span: Span) -> Expr {
    Expr::Object(ObjectLit {
      span: DUMMY_SP,
      props: vec![PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
        key: PropName::Ident(IdentName::new("nodeIndex".into(), DUMMY_SP)),
        value: Box::new(self.node_index_expr_from_span(span)),
      })))],
    })
  }

  fn static_stmt_from_create_call(
    &self,
    element: Ident,
    callee: &str,
    mut args: Vec<Expr>,
    span: Span,
  ) -> Stmt {
    if self.enable_ui_source_map {
      args.push(self.node_index_config_expr(span));
    }

    Stmt::Decl(Decl::Var(Box::new(VarDecl {
      ctxt: SyntaxContext::default(),
      span: DUMMY_SP,
      kind: VarDeclKind::Const,
      declare: false,
      decls: vec![VarDeclarator {
        span: DUMMY_SP,
        definite: false,
        name: Pat::Ident(element.into()),
        init: Some(Box::new(Expr::Call(CallExpr {
          ctxt: SyntaxContext::default(),
          span: DUMMY_SP,
          callee: Callee::Expr(Box::new(Expr::Ident(
            IdentName::new(callee.into(), DUMMY_SP).into(),
          ))),
          args: args
            .into_iter()
            .map(|expr| ExprOrSpread {
              spread: None,
              expr: Box::new(expr),
            })
            .collect(),
          type_args: None,
        }))),
      }],
    })))
  }

  fn static_stmt_from_jsx_element(&mut self, n: &JSXElement, el: Ident) -> Stmt {
    let mut static_stmt: Stmt = Stmt::Empty(EmptyStmt { span: DUMMY_SP });

    if let Expr::Lit(Lit::Str(str)) = *jsx_name(n.opening.name.clone()) {
      let tag = str.value.to_string_lossy();
      match tag.as_ref() {
        "view" => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateView",
            vec![Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
        "scroll-view" => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateScrollView",
            vec![Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
        "x-scroll-view" => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateScrollView",
            vec![Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
        "image" => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateImage",
            vec![Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
        "text" => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateText",
            vec![Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
        "wrapper" => {
          static_stmt = quote!(
            r#"const $element = __CreateWrapperElement($page_id)"# as Stmt,
            element = el.clone(),
            page_id = self.page_id.clone(),
          );
        }
        "list" => {
          static_stmt = quote!(
              r#"const $element = $runtime_id.snapshotCreateList($page_id, $si_id, $element_index)"#
                  as Stmt,
              element = el.clone(),
              runtime_id: Expr = self.runtime_id.clone(),
              page_id = self.page_id.clone(),
              si_id = self.si_id.clone(),
              element_index: Expr = Expr::Lit(Lit::Num(Number { span: DUMMY_SP, value: self.element_index as f64, raw: None })),
          );
        }
        "frame" => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateFrame",
            vec![Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
        _ => {
          static_stmt = self.static_stmt_from_create_call(
            el.clone(),
            "__CreateElement",
            vec![Expr::Lit(Lit::Str(str)), Expr::Ident(self.page_id.clone())],
            n.opening.span,
          );
        }
      };
    }

    static_stmt
  }
}

impl<V, F> VisitMut for DynamicPartExtractor<'_, V, F>
where
  V: VisitMut,
  F: Fn(Span) -> Expr,
{
  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    if jsx_is_internal_slot(n) {
      if self.dynamic_part_count > 1 {
        n.visit_mut_children_with(self.dynamic_part_visitor);
        self.dynamic_parts.push(DynamicPart::Slot(
          jsx_unwrap_internal_slot(n.take()),
          self.element_index,
        ));
        *n = WRAPPER_NODE_2.clone();
      } else {
        *n = jsx_unwrap_internal_slot(n.take());
      }
    }

    if !jsx_is_custom(n) {
      match Lazy::<Ident>::get(&self.page_id) {
        Some(_) => {}
        None => {
          self.static_stmts.push(RefCell::new(quote!(
            r#"const $page_id = $runtime_id.__pageId"# as Stmt,
            page_id = self.page_id.clone(),
            runtime_id: Expr = self.runtime_id.clone(),
          )));
        }
      }

      let el = private_ident!("el");
      self.element_ids.insert(self.element_index, el.clone());

      let static_stmt = self.static_stmt_from_jsx_element(n, el.clone());
      let static_stmt = RefCell::new(static_stmt);
      self.static_stmts.push(static_stmt.clone());

      {
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

      let has_spread_element = n
        .opening
        .attrs
        .iter()
        .any(|attr_or_spread| match attr_or_spread {
          JSXAttrOrSpread::SpreadElement(_) => true,
          JSXAttrOrSpread::JSXAttr(_) => false,
          #[cfg(swc_ast_unknown)]
          _ => panic!("unknown node"),
        });

      let is_list_item = jsx_is_list_item(n);
      if is_list_item {
        if has_spread_element {
        } else {
          let mut list_item_platform_info: Vec<JSXAttr> = vec![];
          n.opening.attrs.retain_mut(|attr_or_spread| {
            match attr_or_spread {
              JSXAttrOrSpread::JSXAttr(attr) => {
                if let JSXAttrName::Ident(id) = &attr.name {
                  match id.sym.to_string().as_str() {
                    "reuse-identifier"
                    | "full-span"
                    | "item-key"
                    | "sticky-top"
                    | "sticky-bottom"
                    | "estimated-height"
                    | "estimated-height-px"
                    | "estimated-main-axis-size-px"
                    | "recyclable" => {
                      list_item_platform_info.push(attr.clone());
                      return false;
                    }
                    &_ => {}
                  }
                }
              }
              JSXAttrOrSpread::SpreadElement(_spread) => {
                return false;
              }
              #[cfg(swc_ast_unknown)]
              _ => panic!("unknown node"),
            }

            true
          });
          if !list_item_platform_info.is_empty() {
            self.dynamic_parts.push(DynamicPart::Attr(
              Expr::Object(ObjectLit {
                span: DUMMY_SP,
                props: list_item_platform_info
                  .iter()
                  .map(jsx_attr_to_prop)
                  .collect(),
              }),
              self.element_index,
              AttrName::ListItemPlatformInfo,
            ));
          }
        }
      }

      // pick key from n.opening.attrs
      n.opening
        .attrs
        .retain_mut(|attr_or_spread| match attr_or_spread {
          JSXAttrOrSpread::SpreadElement(_) => true,
          JSXAttrOrSpread::JSXAttr(JSXAttr { name, value, .. }) => match name {
            JSXAttrName::Ident(ident_name) => match ident_name.sym.as_ref() {
              "key" => {
                if self.parent_element.is_none() {
                  self.key = value.take();
                }
                false
              }
              _ => true,
            },
            JSXAttrName::JSXNamespacedName(_) => true,
            #[cfg(swc_ast_unknown)]
            _ => panic!("unknown node"),
          },
          #[cfg(swc_ast_unknown)]
          _ => panic!("unknown node"),
        });

      if has_spread_element {
        // TODO: avoid clone
        let mut spread_obj = jsx_props_to_obj(n).unwrap();
        spread_obj.props.push(
          Prop::KeyValue(KeyValueProp {
            key: PropName::Ident(IdentName::new("__spread".into(), DUMMY_SP)),
            value: Expr::Lit(Lit::Bool(true.into())).into(),
          })
          .into(),
        );
        self.dynamic_parts.push(DynamicPart::Spread(
          Expr::Object(spread_obj),
          self.element_index,
          is_list_item,
        ));
      } else {
        let el = Expr::Ident(el.clone());

        n.opening
          .attrs
          .iter_mut()
          .for_each(|attr_or_spread| match attr_or_spread {
            JSXAttrOrSpread::SpreadElement(_) => todo!(),
            JSXAttrOrSpread::JSXAttr(JSXAttr { name, value, .. }) => {
              match name {
                JSXAttrName::Ident(ident_name) => {
                  let attr_name = AttrName::from(<IdentName as Into<Ident>>::into(ident_name.clone()));
                  match &attr_name {
                    AttrName::Attr(name) => {
                      match value {
                        None => {
                          let stmt = quote!(
                              r#"__SetAttribute($element, $name, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              name: Expr = name.clone().into(),
                              value: Expr = Expr::Lit(Lit::Bool(Bool {span: DUMMY_SP, value: true}))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::Str(s)) => {
                          let value = transform_jsx_attr_str(&s.value);
                          let stmt = quote!(
                              r#"__SetAttribute($element, $name, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              name: Expr =  name.clone().into(),
                              value: Expr = Expr::Lit(Lit::Str(Str { span: s.span, value: value.into(), raw: None }))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::Expr(expr),
                          ..
                        })) => {
                          // expr.map_with_mut(|value| {
                          //     value.fold_with(self.dynamic_part_visitor)
                          // });
                          match &**expr {
                            Expr::Lit(value) => {
                              let stmt = quote!(
                                  r#"__SetAttribute($element, $name, $value)"# as Stmt,
                                  element: Expr = el.clone(),
                                  name: Expr =  name.clone().into(),
                                  value: Expr = Expr::Lit(value.clone())
                              );
                              self.static_stmts.push(RefCell::new(stmt));
                            }
                            _ => {
                              self.dynamic_parts.push(DynamicPart::Attr(
                                *expr.clone(),
                                self.element_index,
                                attr_name.clone(),
                              ));
                            }
                          }
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::JSXEmptyExpr(_),
                          ..
                        })) => {}
                        Some(JSXAttrValue::JSXElement(_)) => unreachable!("Unexpected JSXElement in JSX attribute value - not supported"),
                        Some(JSXAttrValue::JSXFragment(_)) => unreachable!("Unexpected JSXFragment in JSX attribute value - not supported"),
                        #[cfg(swc_ast_unknown)]
                        _ => panic!("unknown node"),
                      };
                    }
                    AttrName::Dataset(name) => {
                      match value {
                        None => {
                          let stmt = quote!(
                              r#"__AddDataset($element, $name, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              name: Expr =  name.clone().into(),
                              value: Expr = Expr::Lit(Lit::Bool(Bool {span: DUMMY_SP, value: true}))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::Str(s)) => {
                          let value = transform_jsx_attr_str(&s.value);
                          let stmt = quote!(
                              r#"__AddDataset($element, $name, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              name: Expr =  name.clone().into(),
                              value: Expr = Expr::Lit(Lit::Str(Str { span: s.span, value: value.into(), raw: None }))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::Expr(expr),
                          ..
                        })) => {
                          self.dynamic_parts.push(DynamicPart::Attr(
                            *expr.clone(),
                            self.element_index,
                            attr_name.clone(),
                          ));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::JSXEmptyExpr(_),
                          ..
                        })) => {}
                        Some(JSXAttrValue::JSXElement(_)) => unreachable!("Unexpected JSXElement in JSX attribute value - not supported"),
                        Some(JSXAttrValue::JSXFragment(_)) => unreachable!("Unexpected JSXFragment in JSX attribute value - not supported"),
                        #[cfg(swc_ast_unknown)]
                        _ => panic!("unknown node"),
                      };
                    }
                    AttrName::Event(..) | AttrName::Ref => {
                      self.dynamic_parts.push(DynamicPart::Attr(
                        *jsx_attr_value((*value).clone()),
                        self.element_index,
                        attr_name.clone(),
                      ));
                    }
                    AttrName::TimingFlag => {
                      self.dynamic_parts.push(DynamicPart::Attr(
                        *quote_expr!("{__ltf: $flag}", flag: Expr = *jsx_attr_value((*value).clone())),
                        self.element_index,
                        attr_name.clone(),
                      ));
                    }
                    AttrName::Style => {
                      match value {
                        None => {}
                        Some(JSXAttrValue::Str(s)) => {
                          // <view style="width: 100rpx" />;
                          let value = transform_jsx_attr_str(&s.value);
                          let stmt = quote!(
                              r#"__SetInlineStyles($element, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              value: Expr = Expr::Lit(Lit::Str(Str { span: s.span, value: value.into(), raw: None }))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::Expr(expr),
                          span,
                          ..
                        })) => {
                          let expr = &**expr;
                          if is_literal(expr) {
                            if let Some(s) = get_string_inline_style_from_literal(expr, span) {
                              // <view style={{backgroundColor: "red"}} />;
                              // <view style={`background-color: red;`} />;
                              let s = Lit::Str(Str {
                                span: *span,
                                value: s.into(),
                                raw: None,
                              });
                              let stmt = quote!(
                                r#"__SetInlineStyles($element, $value)"# as Stmt,
                                element: Expr = el.clone(),
                                value: Expr = Expr::Lit(s)
                              );
                              self.static_stmts.push(RefCell::new(stmt));
                            }
                          } else {
                            self.dynamic_parts.push(DynamicPart::Attr(
                              expr.clone(),
                              self.element_index,
                              attr_name.clone(),
                            ));
                          }
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::JSXEmptyExpr(_),
                          ..
                        })) => {}
                        Some(JSXAttrValue::JSXElement(_)) => unreachable!("Unexpected JSXElement in JSX attribute value - not supported"),
                        Some(JSXAttrValue::JSXFragment(_)) => unreachable!("Unexpected JSXFragment in JSX attribute value - not supported"),
                        #[cfg(swc_ast_unknown)]
                        _ => panic!("unknown node"),
                      };
                    }
                    AttrName::Class => {
                      match value {
                        None => {}
                        Some(JSXAttrValue::Str(s)) => {
                          let value = transform_jsx_attr_str(&s.value);
                          let stmt = quote!(
                              r#"__SetClasses($element, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              value: Expr = Expr::Lit(Lit::Str(Str { span: s.span, value: value.into(), raw: None }))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::Expr(expr),
                          ..
                        })) => match &**expr {
                          Expr::Lit(value) => {
                            let stmt = quote!(
                                r#"__SetClasses($element, $value)"# as Stmt,
                                element: Expr = el.clone(),
                                value: Expr = Expr::Lit(value.clone())
                            );
                            self.static_stmts.push(RefCell::new(stmt));
                          }
                          _ => {
                            self.dynamic_parts.push(DynamicPart::Attr(
                              *expr.clone(),
                              self.element_index,
                              attr_name.clone(),
                            ));
                          }
                        },
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::JSXEmptyExpr(_),
                          ..
                        })) => {}
                        Some(JSXAttrValue::JSXElement(_)) => unreachable!("Unexpected JSXElement in JSX attribute value - not supported"),
                        Some(JSXAttrValue::JSXFragment(_)) => unreachable!("Unexpected JSXFragment in JSX attribute value - not supported"),
                        #[cfg(swc_ast_unknown)]
                        _ => panic!("unknown node"),
                      };
                    }
                    AttrName::ID => {
                      match value {
                        None => {}
                        Some(JSXAttrValue::Str(s)) => {
                          let value = transform_jsx_attr_str(&s.value);
                          let stmt = quote!(
                              r#"__SetID($element, $value)"# as Stmt,
                              element: Expr = el.clone(),
                              value: Expr = Expr::Lit(Lit::Str(Str { span: s.span, value: value.into(), raw: None }))
                          );
                          self.static_stmts.push(RefCell::new(stmt));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::Expr(expr),
                          ..
                        })) => {
                          self.dynamic_parts.push(DynamicPart::Attr(
                            *expr.clone(),
                            self.element_index,
                            attr_name,
                          ));
                        }
                        Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                          expr: JSXExpr::JSXEmptyExpr(_),
                          ..
                        })) => {}
                        Some(JSXAttrValue::JSXElement(_)) => unreachable!("Unexpected JSXElement in JSX attribute value - not supported"),
                        Some(JSXAttrValue::JSXFragment(_)) => unreachable!("Unexpected JSXFragment in JSX attribute value - not supported"),
                        #[cfg(swc_ast_unknown)]
                        _ => panic!("unknown node"),
                      };
                    }
                    AttrName::ListItemPlatformInfo => unreachable!("Unexpected ListItemPlatformInfo attribute in static JSX processing"),
                    AttrName::WorkletEvent(..) | AttrName::WorkletRef(..) => {
                      unreachable!("A worklet event should have an attribute namespace.")
                    }
                    AttrName::Gesture(..) => {
                      unreachable!("A gesture should have an attribute namespace.")
                    }
                  }
                }
                JSXAttrName::JSXNamespacedName(JSXNamespacedName { ns, name, .. }) => {
                  let attr_name: AttrName = AttrName::from_ns(ns.clone().into(), name.clone().into());
                  match attr_name {
                    AttrName::WorkletEvent(..) | AttrName::WorkletRef(..) => {
                      self.dynamic_parts.push(DynamicPart::Attr(
                        *jsx_attr_value((*value).clone()),
                        self.element_index,
                        attr_name.clone(),
                      ));
                    }
                    AttrName::Gesture(..) => {
                      self.dynamic_parts.push(DynamicPart::Attr(
                        *jsx_attr_value((*value).clone()),
                        self.element_index,
                        attr_name.clone(),
                      ));
                    }
                    _ => todo!(),
                  }
                }
                #[cfg(swc_ast_unknown)]
                _ => panic!("unknown node"),
              };
            }
            #[cfg(swc_ast_unknown)]
            _ => panic!("unknown node"),
          });
      }

      if let Some(parent_el) = &self.parent_element {
        self.static_stmts.push(RefCell::new(quote!(
            r#"__AppendElement($parent, $child)"# as Stmt,
            parent: Ident = parent_el.clone(),
            child: Ident = el.clone(),
        )));
      };

      let is_list = jsx_is_list(n);
      let is_children_full_dynamic = is_list || jsx_is_children_full_dynamic(n);

      if !is_children_full_dynamic {
        self.element_index += 1;

        let pre_parent_element = self.parent_element.take();
        self.parent_element = Some(el.clone());
        // n.children.iter_mut().for_each(|child| match child {
        //     JSXElementChild::JSXText(_) => {
        //         child.visit_mut_children_with(self);
        //     }
        //     JSXElementChild::JSXElement(_) => {
        //         child.visit_mut_children_with(self);
        //     }
        //     JSXElementChild::JSXFragment(_) => {
        //         child.visit_mut_children_with(self);
        //     }
        //     JSXElementChild::JSXExprContainer(JSXExprContainer {
        //         expr: JSXExpr::Expr(_expr),
        //         ..
        //     }) => {
        //         unreachable!("should be handled by WrapDynamicPart");
        //     }
        //     JSXElementChild::JSXExprContainer(JSXExprContainer {
        //         expr: JSXExpr::JSXEmptyExpr(_),
        //         ..
        //     }) => {
        //         // comment, just ignore
        //     }
        //     JSXElementChild::JSXSpreadChild(_) => {
        //         unreachable!("JSXSpreadChild is not supported yet");
        //     }
        // });

        n.visit_mut_children_with(self);

        self.parent_element = pre_parent_element;
      } else {
        if self.dynamic_part_count <= 1 {
          n.visit_mut_children_with(self.dynamic_part_visitor);
          let children_expr = jsx_children_to_expr(n.children.take());
          if is_list {
            self
              .dynamic_parts
              .push(DynamicPart::ListChildren(children_expr, self.element_index));
          } else {
            self
              .dynamic_parts
              .push(DynamicPart::Children(children_expr, self.element_index));
          }
        } else {
          // static_stmt.replace_with(|_| {
          //     let r = WRAPPER_NODE.clone();
          //     let (static_stmt, _) =
          //         self.static_stmt_from_jsx_element(&r, el.clone());
          //     static_stmt
          // });

          // n.map_with_mut(|value| value.fold_with(self.dynamic_part_visitor));
          // if is_list {
          //     // unreachable!()
          //     self.dynamic_parts
          //         .push(DynamicPart::Slot(n.take(), self.element_index));
          // } else {
          //     self.dynamic_parts
          //         .push(DynamicPart::Slot(n.take(), self.element_index));
          // }

          unreachable!("should be handled by WrapDynamicPart");
        }

        self.element_index += 1;
      }

      if self.parent_element.is_none() {
        let elements = Expr::Array(ArrayLit {
          span: DUMMY_SP,
          elems: (0..self.element_ids.len())
            .step_by(1)
            .map(|e| e as i32)
            .map(|e| {
              Some(ExprOrSpread {
                spread: None,
                expr: Box::new(Expr::Ident(self.element_ids[&e].clone())),
              })
            })
            .collect(),
        });

        self.static_stmts.push(RefCell::new(quote!(
          r#"return $elements;"# as Stmt,
          elements: Expr = elements,
        )));

        self.snapshot_creator = Some(Function {
          ctxt: SyntaxContext::default(),
          params: match Lazy::<Ident>::get(&self.si_id) {
            Some(_) => vec![Param {
              span: DUMMY_SP,
              decorators: vec![],
              pat: Pat::Ident(BindingIdent {
                id: self.si_id.take(),
                type_ann: None,
              }),
            }],
            None => vec![],
          },
          decorators: vec![],
          span: DUMMY_SP,
          body: Some(BlockStmt {
            ctxt: SyntaxContext::default(),
            span: DUMMY_SP,
            stmts: self
              .static_stmts
              .take()
              .into_iter()
              .map(|mut stmt| stmt.get_mut().take())
              .collect(),
          }),
          is_generator: false,
          is_async: false,
          type_params: None,
          return_type: None,
        });
      };
    } else {
      n.visit_mut_children_with(self.dynamic_part_visitor);

      if self.parent_element.is_some() {
        self.dynamic_parts.push(DynamicPart::Children(
          Expr::JSXElement(Box::new(n.take())),
          self.element_index,
        ));

        // self.element_index += 1;
        *n = WRAPPER_NODE.clone();
        n.visit_mut_with(self);
      }
    }
  }

  fn visit_mut_jsx_text(&mut self, n: &mut JSXText) {
    let t = jsx_text_to_str(&n.value);

    if !t.is_empty() {
      let el = private_ident!("el");
      self.element_ids.insert(self.element_index, el.clone());

      self.static_stmts.push(RefCell::new(quote!(
          r#"const $element = __CreateRawText($t)"# as Stmt,
          element = el.clone(),
          t: Expr = t.into(),
      )));

      if let Some(parent_el) = &self.parent_element {
        self.static_stmts.push(RefCell::new(quote!(
            r#"__AppendElement($parent, $child)"# as Stmt,
            parent: Ident = parent_el.clone(),
            child: Ident = el.clone(),
        )));
      };

      self.element_index += 1;
    }
  }
}

// ---------------------------------------------------------------------------
// Snapshot transformation entry (dispatched from JSXTransformer)
// ---------------------------------------------------------------------------

pub(crate) fn transform_jsx_element<C>(t: &mut JSXTransformer<C>, node: &mut JSXElement)
where
  C: Comments + Clone,
{
  t.snapshot_counter += 1;

  let snapshot_uid = format!(
    "__snapshot_{}_{}_{}",
    t.filename_hash, t.content_hash, t.snapshot_counter
  );
  let snapshot_id = Ident::new(
    // format!("__snapshot_{}", snapshot_uid).into(),
    snapshot_uid.clone().into(),
    DUMMY_SP,
    SyntaxContext::default().apply_mark(Mark::fresh(Mark::root())),
  );

  let mut wrap_dynamic_part = WrapperMarker {
    current_is_children_full_dynamic: false,
    dynamic_part_count: 0,
  };
  node.visit_mut_with(&mut wrap_dynamic_part);

  let target = t.cfg.target;
  let runtime_id = t.runtime_id.clone();
  // In dev the creator arrow is stringified for cross-thread HMR
  // (`DEV_ONLY_AddSnapshot`), so everything inside it references the runtime
  // through the arrow's own parameter; in production it keeps the
  // module-scope import binding (statically tree-shakeable).
  let creator_runtime_id = private_ident!("__runtime__");
  let creator_runtime_expr = if t.dev_creator_param {
    // `__runtime__` is passed by runtimes that pass `SnapshotCreator`'s
    // second argument; the inline `require` keeps the compiled output
    // working on older runtimes that still call creators with a single
    // argument (they load synchronously, so the pending-promise issue the
    // parameter solves cannot occur there).
    // TODO(compat): drop the `require` fallback once runtimes without
    // `snapshotCreatorRuntime` are out of support.
    quote!(
      "($creator_runtime || require($runtime_pkg))" as Expr,
      creator_runtime = creator_runtime_id.clone(),
      runtime_pkg: Expr = Expr::Lit(Lit::Str(t.cfg.runtime_pkg.clone().into())),
    )
  } else {
    t.runtime_id.clone()
  };
  let filename_hash = t.filename_hash.clone();
  let content_hash = t.content_hash.clone();
  let ui_source_map_records = t.ui_source_map_records.clone();
  let snapshot_uid_for_captured = snapshot_uid.clone();
  let source_map = t.source_map.clone();
  let node_index_fn = move |span: Span| {
    let ui_source_map =
      calc_hash_number(&format!("{}:{}:{}", filename_hash, content_hash, span.lo.0));

    // record ui source map entry
    let mut line_number = 0;
    let mut column_number = 0;
    if span.lo.0 > 0 {
      if let Some(cm) = &source_map {
        let loc = cm.lookup_char_pos(span.lo);
        line_number = loc.line as u32;
        column_number = loc.col.0 as u32 + 1;
      }
    }
    ui_source_map_records.borrow_mut().push(UISourceMapRecord {
      ui_source_map,
      line_number,
      column_number,
      snapshot_id: snapshot_uid_for_captured.clone(),
    });

    Expr::Lit(Lit::Num(Number {
      span: DUMMY_SP,
      value: ui_source_map as f64,
      raw: None,
    }))
  };

  let mut dynamic_part_extractor = DynamicPartExtractor::new(
    creator_runtime_expr.clone(),
    wrap_dynamic_part.dynamic_part_count,
    t,
    t.cfg.enable_ui_source_map,
    node_index_fn,
  );

  node.visit_mut_with(&mut dynamic_part_extractor);

  let mut snapshot_values: Vec<Option<ExprOrSpread>> = vec![];
  let mut snapshot_values_has_attr = false;
  let mut snapshot_attrs: Vec<JSXAttrOrSpread> = vec![];
  let mut snapshot_children: Vec<JSXElementChild> = vec![];
  let mut snapshot_dynamic_part_def: Vec<Option<ExprOrSpread>> = vec![];
  let mut snapshot_refs_and_spread_index: Vec<Option<ExprOrSpread>> = vec![];
  let mut snapshot_slot_def: Vec<Option<ExprOrSpread>> = vec![];
  let mut list_item_platform_info_index: Option<i32> = None;

  if let Some(key) = dynamic_part_extractor.key {
    snapshot_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
      span: DUMMY_SP,
      name: JSXAttrName::Ident(IdentName::new("key".into(), DUMMY_SP)),
      value: Some(key),
    }));
  }

  let (dynamic_part_attr, dynamic_part_children): (Vec<_>, Vec<_>) = dynamic_part_extractor
    .dynamic_parts
    .into_iter()
    .partition(|dynamic_part| match dynamic_part {
      DynamicPart::Attr(_, _, _) | DynamicPart::Spread(_, _, _) => true,
      DynamicPart::Slot(_, _) | DynamicPart::Children(_, _) | DynamicPart::ListChildren(_, _) => {
        false
      }
    });

  dynamic_part_attr.into_iter().for_each(|dynamic_part| {
    match &dynamic_part {
      DynamicPart::Attr(_, _, _) | DynamicPart::Spread(_, _, _) => {
        if let DynamicPart::Attr(_, _, AttrName::Ref) | DynamicPart::Spread(_, _, _) = dynamic_part
        {
          snapshot_refs_and_spread_index.push(Some(
            Expr::Lit(Lit::Num(snapshot_dynamic_part_def.len().into())).into(),
          ));
        }
        snapshot_dynamic_part_def.push(Some(ExprOrSpread {
          spread: None,
          expr: Box::new(dynamic_part.to_updater(
            creator_runtime_expr.clone(),
            target,
            snapshot_dynamic_part_def.len() as i32,
          )),
        }));
      }
      DynamicPart::Slot(_, _) => {}
      DynamicPart::Children(_, _) => {}
      DynamicPart::ListChildren(_, _) => {}
    }

    match dynamic_part {
      DynamicPart::Attr(value, _, attr_name) => {
        if matches!(attr_name, AttrName::ListItemPlatformInfo) {
          list_item_platform_info_index = Some(snapshot_values.len() as i32);
        }
        snapshot_values.push(Some(ExprOrSpread {
          spread: None,
          expr: Box::new(if let AttrName::Event(_, _) = attr_name {
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
          }),
        }));
        snapshot_values_has_attr = true;
      }
      DynamicPart::Spread(value, _, is_list_item) => {
        if is_list_item {
          list_item_platform_info_index = Some(snapshot_values.len() as i32);
        }
        snapshot_values.push(Some(ExprOrSpread {
          spread: None,
          expr: Box::new(value),
        }));
        snapshot_values_has_attr = true;
      }
      DynamicPart::Children(_, _) => {}
      DynamicPart::ListChildren(_, _) => {}
      DynamicPart::Slot(_, _) => {}
    }
  });

  let slot_expr = match (dynamic_part_children.len(), dynamic_part_children.first()) {
    (0, _) => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
    (1, Some(DynamicPart::Children(expr, 0))) => {
      let expr = expr.clone();
      snapshot_children.push(match expr {
        Expr::JSXElement(jsx) => JSXElementChild::JSXElement(jsx),
        _ => JSXElementChild::JSXExprContainer(JSXExprContainer {
          span: DUMMY_SP,
          expr: JSXExpr::Expr(Box::new(expr)),
        }),
      });

      quote!(
        "$runtime_id.__DynamicPartChildren_0" as Expr,
        runtime_id: Expr = creator_runtime_expr.clone(),
      )
    }
    _ => {
      dynamic_part_children.into_iter().for_each(|dynamic_part| {
        match dynamic_part {
          DynamicPart::Attr(_, _, _) => {}
          DynamicPart::Spread(_, _, _) => {}
          DynamicPart::ListChildren(expr, element_index) => {
            // snapshot_values.push(None);
            snapshot_children.push(match expr {
              Expr::JSXElement(jsx) => JSXElementChild::JSXElement(jsx),
              _ => JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(expr)),
              }),
            });
            snapshot_slot_def.push(Some(ExprOrSpread {
              spread: None,
              expr: Box::new(quote!(
                "[$runtime_id.__DynamicPartListChildren, $element_index]" as Expr,
                runtime_id: Expr = creator_runtime_expr.clone(),
                element_index: Expr = i32_to_expr(&element_index),
              )),
            }));
          }
          DynamicPart::Children(expr, element_index) => {
            // snapshot_values.push(None);
            snapshot_children.push(match expr {
              Expr::JSXElement(jsx) => JSXElementChild::JSXElement(jsx),
              _ => JSXElementChild::JSXExprContainer(JSXExprContainer {
                span: DUMMY_SP,
                expr: JSXExpr::Expr(Box::new(expr)),
              }),
            });
            snapshot_slot_def.push(Some(ExprOrSpread {
              spread: None,
              expr: Box::new(quote!(
                "[$runtime_id.__DynamicPartChildren, $element_index]" as Expr,
                runtime_id: Expr = creator_runtime_expr.clone(),
                element_index: Expr = i32_to_expr(&element_index),
              )),
            }));
          }
          DynamicPart::Slot(jsx, element_index) => {
            // snapshot_values.push(None);
            snapshot_children.push(JSXElementChild::JSXElement(Box::new(jsx)));
            snapshot_slot_def.push(Some(ExprOrSpread {
              spread: None,
              expr: Box::new(quote!(
                "[$runtime_id.__DynamicPartSlot, $element_index]" as Expr,
                runtime_id: Expr = creator_runtime_expr.clone(),
                element_index: Expr = i32_to_expr(&element_index),
              )),
            }));
          }
        }
      });

      Expr::Array(ArrayLit {
        span: DUMMY_SP,
        elems: snapshot_slot_def,
      })
    }
  };

  let snapshot_creator = if target == TransformTarget::JS {
    Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))
  } else {
    Expr::Fn(FnExpr {
      ident: None,
      function: Box::new(dynamic_part_extractor.snapshot_creator.unwrap()),
    })
  };

  // External bundles have no `globDynamicComponentEntry` in scope; use the
  // `__Card__` entry-name literal.
  let entry_name: Expr = if matches!(t.cfg.is_external_bundle, Some(true))
    && !matches!(t.cfg.is_dynamic_component, Some(true))
  {
    Expr::Lit(Lit::Str("__Card__".into()))
  } else {
    Expr::Ident("globDynamicComponentEntry".into())
  };

  let snapshot_dynamic_parts_def: Expr = match (target, snapshot_dynamic_part_def.len()) {
    (TransformTarget::JS, _) | (_, 0) => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
    _ => Expr::Array(ArrayLit {
      span: DUMMY_SP,
      elems: snapshot_dynamic_part_def,
    }),
  };
  let css_id: Expr = match &t.css_id_value {
    Some(css_id_expr) => css_id_expr.clone(),
    // We use `undefined` here since runtime will skip `__SetCSSId` when `cssId === undefined && entryName === undefined`
    None => Expr::Ident("undefined".into()),
  };
  let snapshot_refs_and_spread_index: Expr = match snapshot_refs_and_spread_index.len() {
    0 => Expr::Lit(Lit::Null(Null { span: DUMMY_SP })),
    _ => Expr::Array(ArrayLit {
      span: DUMMY_SP,
      elems: snapshot_refs_and_spread_index,
    }),
  };

  let snapshot_create_call = if t.dev_creator_param {
    quote!(
        r#"$runtime_id.snapshotCreatorMap[$snapshot_id] = ($snapshot_id, $creator_runtime) => $creator_runtime_ref.createSnapshot(
             $snapshot_id,
             $snapshot_creator,
             $snapshot_dynamic_parts_def,
             $slot,
             $css_id,
             $entry_name,
             $snapshot_refs_and_spread_index,
             true
        )"# as Expr,
        runtime_id: Expr = t.runtime_id.clone(),
        creator_runtime = creator_runtime_id.clone(),
        creator_runtime_ref: Expr = creator_runtime_expr.clone(),
        snapshot_id = snapshot_id.clone(),
        entry_name: Expr = entry_name,
        snapshot_creator: Expr = snapshot_creator,
        snapshot_dynamic_parts_def: Expr = snapshot_dynamic_parts_def,
        slot: Expr = slot_expr,
        css_id: Expr = css_id,
        snapshot_refs_and_spread_index: Expr = snapshot_refs_and_spread_index,
    )
  } else {
    quote!(
        r#"$runtime_id.snapshotCreatorMap[$snapshot_id] = ($snapshot_id) => $runtime_id.createSnapshot(
             $snapshot_id,
             $snapshot_creator,
             $snapshot_dynamic_parts_def,
             $slot,
             $css_id,
             $entry_name,
             $snapshot_refs_and_spread_index,
             true
        )"# as Expr,
        runtime_id: Expr = t.runtime_id.clone(),
        snapshot_id = snapshot_id.clone(),
        entry_name: Expr = entry_name,
        snapshot_creator: Expr = snapshot_creator,
        snapshot_dynamic_parts_def: Expr = snapshot_dynamic_parts_def,
        slot: Expr = slot_expr,
        css_id: Expr = css_id,
        snapshot_refs_and_spread_index: Expr = snapshot_refs_and_spread_index,
    )
  };

  let mut entry_snapshot_uid = quote!("$snapshot_uid" as Expr, snapshot_uid: Expr = Expr::Lit(Lit::Str(snapshot_uid.clone().into())));
  if matches!(t.cfg.is_dynamic_component, Some(true)) {
    entry_snapshot_uid = quote!("`${globDynamicComponentEntry}:${$snapshot_uid}`" as Expr, snapshot_uid: Expr = Expr::Lit(Lit::Str(snapshot_uid.clone().into())));
  }

  let entry_snapshot_uid_def = ModuleItem::Stmt(quote!(
      r#"const $snapshot_id = $entry_snapshot_uid"#
          as Stmt,
      snapshot_id = snapshot_id.clone(),
      entry_snapshot_uid: Expr = entry_snapshot_uid.clone(),
  ));
  let snapshot_def = ModuleItem::Stmt(quote!(
      r#"$snapshot_create_call"#
          as Stmt,
      snapshot_create_call: Expr = snapshot_create_call,
  ));

  t.current_snapshot_id = Some(snapshot_id.clone());
  if let Some(collector) = &t.main_thread_defs_collector {
    let mut collector = collector.borrow_mut();
    collector.push(entry_snapshot_uid_def.clone());
    collector.push(snapshot_def.clone());
  }
  t.current_snapshot_defs.push(entry_snapshot_uid_def);
  t.current_snapshot_defs.push(snapshot_def);

  *node = JSXElement {
    span: node.span(),
    opening: JSXOpeningElement {
      name: JSXElementName::Ident(snapshot_id.clone()),
      span: node.span,
      attrs: {
        if snapshot_values_has_attr {
          snapshot_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
            span: DUMMY_SP,
            name: JSXAttrName::Ident(IdentName::new("values".into(), DUMMY_SP)),
            value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
              span: DUMMY_SP,
              expr: JSXExpr::Expr(Box::new(Expr::Array(ArrayLit {
                span: DUMMY_SP,
                elems: snapshot_values,
              }))),
            })),
          }))
        };
        if let Some(index) = list_item_platform_info_index {
          snapshot_attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
            span: DUMMY_SP,
            name: JSXAttrName::Ident(IdentName::new(
              "__listItemPlatformInfoIndex".into(),
              DUMMY_SP,
            )),
            value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
              span: DUMMY_SP,
              expr: JSXExpr::Expr(Box::new(i32_to_expr(&index))),
            })),
          }))
        }
        snapshot_attrs
      },
      self_closing: wrap_dynamic_part.dynamic_part_count == 0,
      type_args: None,
    },
    children: snapshot_children,
    closing: if wrap_dynamic_part.dynamic_part_count == 0 {
      None
    } else {
      Some(JSXClosingElement {
        name: JSXElementName::Ident(snapshot_id.clone()),
        span: DUMMY_SP,
      })
    },
  };
}

#[cfg(test)]
mod tests {
  use swc_core::{
    common::{comments::SingleThreadedComments, Mark},
    ecma::parser::{EsSyntax, Syntax},
    ecma::transforms::{base::resolver, react, testing::test},
    ecma::visit::visit_mut_pass,
  };

  use crate::JSXTransformer;
  use swc_plugins_shared::{target::TransformTarget, transform_mode::TransformMode};

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(super::WrapperMarker {
          current_is_children_full_dynamic: false,
          dynamic_part_count: 0,
        }),
      )
    },
    should_wrap_dynamic_part,
    r#"
        <view/>; // should not handle top-level JSXElement
        <A/>; // should not handle top-level JSXElement
        <A><view></view></A>;
        <view><A/></view>; // children is full dynamic
        <view><A/><A/></view>; // children is full dynamic
        <view><A/><text/><A/></view>; // <A/> should be wrapped inside wrapper
        <view>{1}</view>;
        <view>{1}{2}</view>;
        <view>{1}2</view>;
        <list><list-item/><list-item/></list>;
        <list><list-item><A/>A</list-item><list-item/></list>;
        <view>{<view><A/><text/><A/></view>}</view>;
        <view><list><list-item/><list-item/></list>a<view><A/></view></view>;
        <view key={hello}>hello</view>;
        <view key={hello}>{hello}</view>;
        <view><text key={hello}>{hello}</text></view>;
        <view><text>Hello, ReactLynx, {hello}</text><text key={hello}>{hello}</text></view>;
<view>
  <text>!!!</text>
  <A/>
</view>;
<view>
  <text>!!!</text>
  {a}
</view>;
        "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(super::WrapperMarker {
          current_is_children_full_dynamic: false,
          dynamic_part_count: 0,
        }),
      )
    },
    should_not_wrap_dynamic_part,
    r#" 
<view className="parent">
  <view className="child"/>
  <view className="child"/>
</view>;
<view className="parent">
  <view className="child">
  </view>
  <view className="child">
  </view>
</view>;
<view className="parent">
  <view className="child">
    {/** foo */}
  </view>
  <view className="child">
    {/** bar */}
  </view>
</view>;
// TODO: fix the redundant <internal-slot> here
<view className="parent">
  <view className="child">{[].map(() => null)}</view>
  <view className="child">{[].map(() => null)}</view>
</view>;
<view style={{ color: "red", 'height': "100px", flexShrink: 1 }}>
</view>;
        "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(JSXTransformer::new(
          crate::JSXTransformerConfig {
            legacy_slot: Some(true),
            preserve_jsx: true,
            target: TransformTarget::MIXED,
            ..Default::default()
          },
          Some(t.comments.clone()),
          TransformMode::Test,
          Some(t.cm.clone()),
        )),
      )
    },
    should_emit_list_item_platform_info_marker_for_spread_props_legacy_slot,
    // Input codes
    r#"
    const node = (
      <list>
        <list-item {...getProps()} />
      </list>
    );
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(JSXTransformer::new(
          crate::JSXTransformerConfig {
            legacy_slot: Some(true),
            preserve_jsx: true,
            ..Default::default()
          },
          Some(t.comments.clone()),
          TransformMode::Test,
          Some(t.cm.clone()),
        )),
      )
    },
    full_static_children_map_jsx_legacy_slot,
    // Input codes
    r#"
    <view className="parent">
			<view className="child">{[].map(() => null)}</view>
			<view className="child">{[].map(() => null)}</view>
		</view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    basic_component_legacy_slot,
    // Input codes
    r#"
    <view>
      <A/>
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    page_component_legacy_slot,
    // Input codes
    r#"
    <Page custom-key-str="custom-value" custom-key-var={customVariable} class="classValue" data-attr={dataAttr}>
      <view>
        <Page/>
        <A/>
      </view>
    </Page>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Development,
      Some(t.cm.clone()),
    )),
    page_element_dev_legacy_slot,
    // Input codes
    r#"
    <page custom-key-str="custom-value" custom-key-var={customVariable} class="classValue" data-attr={dataAttr}>
      <view>
        <page />
        <A/>
      </view>
    </page>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    page_element_legacy_slot,
    // Input codes
    r#"
    <page custom-key-str="custom-value" custom-key-var={customVariable} class="classValue" data-attr={dataAttr}>
      <view>
        <page />
        <A/>
      </view>
    </page>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    basic_component_with_static_sibling_legacy_slot,
    // Input codes
    r#"
    <view>
      <text>!!!</text>
      <A/>
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| {
      let top_level_mark = Mark::new();
      let unresolved_mark = Mark::new();
      (
        visit_mut_pass(JSXTransformer::<&SingleThreadedComments>::new(
          crate::JSXTransformerConfig {
            legacy_slot: Some(true),
            preserve_jsx: false,
            ..Default::default()
          },
          None,
          TransformMode::Test,
          Some(t.cm.clone()),
        )),
        react::react::<&SingleThreadedComments>(
          t.cm.clone(),
          None,
          react::Options {
            next: Some(false),
            runtime: Some(react::Runtime::Automatic),
            import_source: Some("@lynx-js/react".into()),
            pragma: None,
            pragma_frag: None,
            throw_if_namespace: None,
            development: Some(false),
            refresh: None,
            ..Default::default()
          },
          top_level_mark,
          unresolved_mark,
        ),
      )
    },
    basic_component_with_static_sibling_jsx_legacy_slot,
    // Input codes
    r#"
    <view>
      <text>!!!</text>
      <A/>
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| {
      let top_level_mark = Mark::new();
      let unresolved_mark = Mark::new();
      (
        visit_mut_pass(JSXTransformer::<&SingleThreadedComments>::new(
          crate::JSXTransformerConfig {
            legacy_slot: Some(true),
            preserve_jsx: false,
            ..Default::default()
          },
          None,
          TransformMode::Test,
          Some(t.cm.clone()),
        )),
        react::react::<&SingleThreadedComments>(
          t.cm.clone(),
          None,
          react::Options {
            next: Some(false),
            runtime: Some(react::Runtime::Automatic),
            import_source: Some("@lynx-js/react".into()),
            pragma: None,
            pragma_frag: None,
            throw_if_namespace: None,
            development: Some(true),
            refresh: None,
            ..Default::default()
          },
          top_level_mark,
          unresolved_mark,
        ),
      )
    },
    basic_component_with_static_sibling_jsx_dev_legacy_slot,
    // Input codes
    r#"
    <view>
      <text>!!!</text>
      <A/>
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    basic_expr_container_legacy_slot,
    // Input codes
    r#"
    <view>
      {a}
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    basic_expr_container_with_static_sibling_legacy_slot,
    // Input codes
    r#"
    <view>
      <text>!!!</text>
      {a}
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    should_inject_implicit_flatten_legacy_slot,
    // Input codes
    r#"
    <view>
      <view className={'commdityV1Wrapper'}>
        <view id={id} className={'dotComm'} />
        <view className={'commdityV1TextWrapper'}>
          <view className={'commdityV1TextVerticalWrapper'}>
            <ItemTextWithTag/>
            {desc}
          </view>
          {unit}
        </view>
        {unit}
        {unit}
      </view>
    </view>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| {
      let top_level_mark = Mark::new();
      let unresolved_mark = Mark::new();
      (
        visit_mut_pass(JSXTransformer::<&SingleThreadedComments>::new(
          crate::JSXTransformerConfig {
            legacy_slot: Some(true),
            preserve_jsx: false,
            ..Default::default()
          },
          None,
          TransformMode::Test,
          Some(t.cm.clone()),
        )),
        react::react::<&SingleThreadedComments>(
          t.cm.clone(),
          None,
          react::Options {
            next: Some(false),
            runtime: Some(react::Runtime::Automatic),
            import_source: Some("@lynx-js/react".into()),
            pragma: None,
            pragma_frag: None,
            throw_if_namespace: None,
            development: Some(false),
            refresh: None,
            ..Default::default()
          },
          top_level_mark,
          unresolved_mark,
        ),
      )
    },
    basic_spread_list_item_legacy_slot,
    // Input codes
    r#"
    <list>
      <list-item key="hello" item-key="world" {...obj}>!!!</list-item>
    </list>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    should_wrap_dynamic_key_legacy_slot,
    // Input codes
    r#"
    <view>
      <text>Hello, ReactLynx, {hello}</text>
      <text key={hello}>{hello}</text>
      <text key="hello">{hello}</text>
    </view>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(JSXTransformer::new(
      crate::JSXTransformerConfig {
        legacy_slot: Some(true),
        preserve_jsx: true,
        ..Default::default()
      },
      Some(t.comments.clone()),
      TransformMode::Test,
      Some(t.cm.clone()),
    )),
    should_create_raw_text_node_for_text_node_legacy_slot,
    // Input codes
    r#"
    <view>
      <text>{hello}, ReactLynx 1</text>
      <text>{hello}</text>
      <text>
        Hello
        <text text="ReactLynx 2"></text>
      </text>
      <x-text>Hello, ReactLynx 3</x-text>
    </view>
    "#
  );
}
