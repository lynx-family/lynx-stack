use swc_core::{
  common::{errors::HANDLER, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};

use swc_plugins_shared::jsx_helpers::jsx_text_to_str;

/// Expands `portal-container` so the snapshot plugin emits a BSI with a
/// single empty slot at element_index 0, the shape `createPortal` requires.
///
/// `<view portal-container … />` → `{<view …>{null}</view>}` (the outer
/// `{…}` forces extraction into its own snapshot; the `{null}` body makes
/// children "full dynamic", producing the slot at index 0).
///
/// Only statically-truthy values transform: shorthand, `={true}`, or a
/// string. `={false}` and dynamic values leave the slot out (the attribute
/// is always stripped — it has no runtime meaning).
pub struct PortalContainerVisitor {}

impl VisitMut for PortalContainerVisitor {
  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    // Wrap portal-container children BEFORE recursing; step 2 below strips
    // the marker on the way down so it's not detectable afterwards.
    for child in n.children.iter_mut() {
      if let JSXElementChild::JSXElement(element) = child {
        if should_transform(element) {
          let taken = std::mem::replace(
            element,
            Box::new(JSXElement {
              span: DUMMY_SP,
              opening: JSXOpeningElement {
                span: DUMMY_SP,
                name: JSXElementName::Ident(Ident::new_no_ctxt("wrapper".into(), DUMMY_SP)),
                attrs: vec![],
                self_closing: true,
                type_args: None,
              },
              closing: None,
              children: vec![],
            }),
          );
          *child = JSXElementChild::JSXExprContainer(JSXExprContainer {
            span: DUMMY_SP,
            expr: JSXExpr::Expr(Box::new(Expr::JSXElement(taken))),
          });
        }
      }
    }

    n.visit_mut_children_with(self);

    let compile_time_enabled = should_transform(n);
    let had_attribute = has_portal_container_attr(n);

    if compile_time_enabled {
      let has_children = n.children.iter().any(is_meaningful_child);
      if has_children {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              n.opening.span,
              "An element with the `portal-container` attribute must not have any children. \
               `createPortal` will render into it as its slot contents.",
            )
            .emit()
        });
      }
      n.children = vec![JSXElementChild::JSXExprContainer(JSXExprContainer {
        span: DUMMY_SP,
        expr: JSXExpr::Expr(Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP })))),
      })];
      // Self-closing elements drop children in codegen; open/close it.
      if n.closing.is_none() {
        n.opening.self_closing = false;
        n.closing = Some(JSXClosingElement {
          span: DUMMY_SP,
          name: n.opening.name.clone(),
        });
      }
    }

    if had_attribute {
      strip_portal_container_attr(n);
    }
  }
}

fn has_portal_container_attr(jsx: &JSXElement) -> bool {
  jsx.opening.attrs.iter().any(|attr| {
    if let JSXAttrOrSpread::JSXAttr(JSXAttr {
      name: JSXAttrName::Ident(ident),
      ..
    }) = attr
    {
      ident.sym.as_ref() == "portal-container"
    } else {
      false
    }
  })
}

/// True iff `portal-container` is statically truthy: shorthand, `={true}`,
/// or a string value. `={false}` and dynamic exprs return false.
fn should_transform(jsx: &JSXElement) -> bool {
  jsx.opening.attrs.iter().any(|attr| {
    let JSXAttrOrSpread::JSXAttr(JSXAttr {
      name: JSXAttrName::Ident(ident),
      value,
      ..
    }) = attr
    else {
      return false;
    };
    if ident.sym.as_ref() != "portal-container" {
      return false;
    }
    match value {
      None => true,
      Some(JSXAttrValue::Str(_)) => true,
      Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
        expr: JSXExpr::Expr(expr),
        ..
      })) => match &**expr {
        Expr::Lit(Lit::Bool(b)) => b.value,
        _ => false,
      },
      _ => false,
    }
  })
}

fn strip_portal_container_attr(jsx: &mut JSXElement) {
  jsx.opening.attrs.retain(|attr| match attr {
    JSXAttrOrSpread::JSXAttr(JSXAttr {
      name: JSXAttrName::Ident(ident),
      ..
    }) => ident.sym.as_ref() != "portal-container",
    _ => true,
  });
}

fn is_meaningful_child(child: &JSXElementChild) -> bool {
  match child {
    JSXElementChild::JSXText(t) => !jsx_text_to_str(&t.value).is_empty(),
    JSXElementChild::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::JSXEmptyExpr(_),
      ..
    }) => false,
    _ => true,
  }
}

#[cfg(test)]
mod tests {
  use swc_core::ecma::{
    parser::{EsSyntax, Syntax},
    transforms::testing::test,
    visit::visit_mut_pass,
  };

  use super::PortalContainerVisitor;

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(PortalContainerVisitor {}),
    shorthand_attribute_on_standalone_element,
    r#"
    <view portal-container ref={hostRef} />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(PortalContainerVisitor {}),
    shorthand_attribute_wraps_child_in_expr_container,
    r#"
    <view>
      <text>sibling</text>
      <view portal-container ref={hostRef} />
    </view>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(PortalContainerVisitor {}),
    literal_true_is_transformed,
    r#"
    <view portal-container={true} ref={hostRef} />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(PortalContainerVisitor {}),
    literal_false_is_stripped_but_not_transformed,
    r#"
    <view portal-container={false} ref={hostRef} />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(PortalContainerVisitor {}),
    dynamic_value_is_stripped_but_not_transformed,
    r#"
    <view portal-container={isPortal} ref={hostRef} />;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(PortalContainerVisitor {}),
    without_attribute_is_untouched,
    r#"
    <view>
      <view ref={hostRef} />
    </view>;
    "#
  );

  // Composed with the snapshot plugin: pins the emitted snapshot shape.
  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      visit_mut_pass(PortalContainerVisitor {}),
      visit_mut_pass(swc_plugin_snapshot::JSXTransformer::new(
        swc_plugin_snapshot::JSXTransformerConfig {
          preserve_jsx: true,
          ..Default::default()
        },
        Some(t.comments.clone()),
        swc_plugins_shared::transform_mode::TransformMode::Test,
        Some(t.cm.clone()),
      )),
    ),
    composed_nested_portal_container_extracts_separate_snapshot,
    r#"
    <view>
      <text>sibling</text>
      <view portal-container ref={hostRef} />
    </view>;
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| (
      visit_mut_pass(PortalContainerVisitor {}),
      visit_mut_pass(swc_plugin_snapshot::JSXTransformer::new(
        swc_plugin_snapshot::JSXTransformerConfig {
          preserve_jsx: true,
          ..Default::default()
        },
        Some(t.comments.clone()),
        swc_plugins_shared::transform_mode::TransformMode::Test,
        Some(t.cm.clone()),
      )),
    ),
    composed_standalone_portal_container_emits_slot_at_index_0,
    r#"
    <view portal-container ref={hostRef} />;
    "#
  );
}
