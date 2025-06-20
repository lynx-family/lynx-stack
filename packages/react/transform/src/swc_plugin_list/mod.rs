use swc_core::{
  common::{comments::Comments, util::take::Take, DUMMY_SP},
  ecma::{
    ast::*,
    utils::private_ident,
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

use crate::swc_plugin_snapshot::jsx_helpers::jsx_is_list_item;

pub struct ListVisitor<C>
where
  C: Comments,
{
  runtime_components_ident: Ident,
  runtime_components_module_item: Option<ModuleItem>,
  _comments: Option<C>,
}

impl<C> ListVisitor<C>
where
  C: Comments,
{
  pub fn new(comments: Option<C>) -> Self {
    ListVisitor {
      runtime_components_ident: private_ident!("ReactLynxRuntimeComponents"),
      runtime_components_module_item: None,
      _comments: comments,
    }
  }
}

fn jsx_list_item_deferred(n: &JSXElement) -> bool {
  if !jsx_is_list_item(n) {
    return false;
  }

  return n.opening.attrs.iter().any(|attr| {
    if let JSXAttrOrSpread::JSXAttr(attr) = attr {
      if let JSXAttrName::Ident(ident) = &attr.name {
        ident.sym == "deferred"
      } else {
        false
      }
    } else {
      false
    }
  });
}

impl<C> VisitMut for ListVisitor<C>
where
  C: Comments,
{
  // transform
  // <list-item ... deferred key={...}>
  //   ...
  // </list-item>
  // to
  // <DeferredListItem
  //   key={...}
  //   renderListItem={(spread, children) => <list-item ... {...spread}>{children}</list-item>}
  //   renderChildren={() => <>...</>}
  // />
  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    n.visit_mut_children_with(self);

    if jsx_list_item_deferred(&n) {
      let mut key: Option<JSXAttrOrSpread> = None;
      let mut deferred: Option<JSXAttrOrSpread> = None;

      n.opening.attrs.retain_mut(|attr_or_spread| {
        if let JSXAttrOrSpread::JSXAttr(attr) = attr_or_spread {
          if let JSXAttrName::Ident(ident) = &attr.name {
            if ident.sym == "key" {
              key = Some(attr_or_spread.clone());
              return false;
            } else if ident.sym == "deferred" {
              deferred = Some(attr_or_spread.clone());
              return false;
            }
          }
        }
        true
      });

      let children = n.children.take();
      let children_ident = Ident::from("__c");

      n.children = vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
        expr: JSXExpr::Expr(Box::new(Expr::Ident(children_ident.clone()))),
        span: DUMMY_SP,
      })];

      let render_list_item = quote!(
        "($children) => $list_item_jsx" as Expr,
        children: Ident = children_ident,
        list_item_jsx: Expr = Expr::JSXElement(Box::new(n.clone())),
      );

      let render_children = quote!(
        "() => $children" as Expr,
        children: Expr = Expr::JSXFragment(JSXFragment {
          span: DUMMY_SP,
          opening: JSXOpeningFragment { span: DUMMY_SP },
          closing: JSXClosingFragment { span: DUMMY_SP },
          children,
        }),
      );

      if self.runtime_components_module_item.is_none() {
        self.runtime_components_module_item = Some(quote!(
          r#"import * as $runtime_components_ident from '@lynx-js/react/runtime-components';"#
            as ModuleItem,
          runtime_components_ident = self.runtime_components_ident.clone(),
        ));
      }

      let name = JSXElementName::JSXMemberExpr(JSXMemberExpr {
        obj: JSXObject::Ident(self.runtime_components_ident.clone()),
        prop: private_ident!("DeferredListItem").into(),
        span: DUMMY_SP,
      });

      let list_item_deferred_jsx = JSXElement {
        span: n.span,
        opening: JSXOpeningElement {
          span: n.opening.span,
          name: name.clone(),
          attrs: vec![
            JSXAttrOrSpread::JSXAttr(JSXAttr {
              span: DUMMY_SP,
              name: JSXAttrName::Ident(IdentName::new("renderListItem".into(), DUMMY_SP)),
              value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                expr: JSXExpr::Expr(Box::new(render_list_item)),
                span: DUMMY_SP,
              })),
            }),
            JSXAttrOrSpread::JSXAttr(JSXAttr {
              span: DUMMY_SP,
              name: JSXAttrName::Ident(IdentName::new("renderChildren".into(), DUMMY_SP)),
              value: Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
                expr: JSXExpr::Expr(Box::new(render_children)),
                span: DUMMY_SP,
              })),
            }),
          ]
          .into_iter()
          .chain(key)
          .chain(deferred)
          .collect(),
          type_args: None,
          self_closing: true,
        },
        children: vec![],
        closing: None,
      };

      *n = list_item_deferred_jsx;
    }
  }

  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    let mut new_items: Vec<ModuleItem> = vec![];
    for (_i, item) in n.iter_mut().enumerate() {
      item.visit_mut_with(self);
      new_items.push(item.take());
    }

    match &self.runtime_components_module_item {
      Some(module_item) => {
        new_items.insert(0, module_item.clone());
      }
      None => {}
    }

    *n = new_items;
  }
}

#[cfg(test)]
mod tests {
  use swc_core::{
    common::{comments::SingleThreadedComments, Mark},
    ecma::{
      parser::{EsSyntax, Syntax},
      transforms::testing::test,
      visit::visit_mut_pass,
    },
  };

  use super::ListVisitor;
  use crate::{
    swc_plugin_snapshot::{JSXTransformer, JSXTransformerConfig},
    target::TransformTarget,
    TransformMode,
  };

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(ListVisitor::new(Some(t.comments.clone()))),
    should_transform_list_item_deferred_basic,
    r#"
    <list-item deferred key="1"></list-item>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(ListVisitor::new(Some(t.comments.clone()))),
    should_transform_list_item_deferred_in_list,
    r#"
    <list>
      <list-item deferred key="1"></list-item>
      <list-item deferred key="2"></list-item>
    </list>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(ListVisitor::new(Some(t.comments.clone()))),
    should_transform_list_item_not_deferred,
    r#"
    <list-item key="1"></list-item>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(ListVisitor::new(Some(t.comments.clone()))),
    should_transform_list_item_with_spread_deferred,
    r#"
    <list-item deferred key="1" {...spread}></list-item>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(ListVisitor::new(Some(t.comments.clone()))),
    should_transform_list_item_deferred_with_children,
    r#"
    <list-item deferred key="1" style="color: red; width: 100rpx;" className="x" bindtap={noop}>
      <view/>
      <text/>
      <image/>
    </list-item>;
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
        visit_mut_pass(ListVisitor::new(Some(t.comments.clone()))),
        visit_mut_pass(JSXTransformer::<&SingleThreadedComments>::new(
          JSXTransformerConfig {
            preserve_jsx: false,
            target: TransformTarget::MIXED,
            ..Default::default()
          },
          t.cm.clone(),
          None,
          top_level_mark,
          unresolved_mark,
          TransformMode::Development,
        )),
      )
    },
    should_transform_list_item_deferred_with_children_with_snapshot,
    r#"
    <list-item deferred key="1" style="color: red; width: 100rpx;" className="x" bindtap={noop}>
      <view/>
      <text/>
      <image/>
    </list-item>;
    "#
  );
}
