use swc_core::{
  common::{util::take::Take, DUMMY_SP},
  ecma::{
    ast::{JSXExpr, *},
    visit::{VisitMut, VisitMutWith},
  },
};

use super::{
  jsx_helpers::{
    jsx_children_to_expr, jsx_has_dynamic_key, jsx_is_children_full_dynamic, jsx_is_custom,
    jsx_is_list, jsx_name, jsx_text_to_str,
  },
  WRAPPER_NODE_2,
};

pub static INTERNAL_SLOT_STR: &str = "internal-slot";

pub fn jsx_is_internal_slot(jsx: &JSXElement) -> bool {
  match *jsx_name(jsx.opening.name.clone()) {
    Expr::Lit(Lit::Str(s)) => s.value.as_ref() == INTERNAL_SLOT_STR,
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

    if n.len() == 0 {
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
            if current_chunk.len() == 0 {
              should_merge = true;
            } else {
              should_merge = false;
            }
          } else {
            should_merge = true;
          }
        }
        JSXElementChild::JSXElement(ref element) => {
          if jsx_is_custom(element) || jsx_has_dynamic_key(element) {
            should_merge = false;
          } else {
            should_merge = true;
          }
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
        if current_chunk.len() > 0 {
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

    if current_chunk.len() > 0 {
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
    if jsx_is_custom(&n) {
      // always ignore top level custom element
    } else {
      // let is_children_full_static = jsx_is_children_full_static(&n);
      // let is_list = jsx_is_list(&n) || !is_children_full_static;
      // let is_children_full_dynamic = is_list || jsx_is_children_full_dynamic(&n);

      let is_list = jsx_is_list(&n);
      let is_children_full_dynamic = is_list || jsx_is_children_full_dynamic(&n);

      if is_list {
        if n.children.len() > 0 {
          n.children = vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(jsx_children_to_expr(n.children.take()))),
          })];
        }
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

#[cfg(test)]
mod tests {
  use swc_core::{
    common::Mark,
    ecma::parser::Syntax,
    ecma::{parser::EsSyntax, transforms::testing::test},
    ecma::{transforms::base::resolver, visit::visit_mut_pass},
  };

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
        "#
  );
}
