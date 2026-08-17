use swc_core::{
  common::{errors::HANDLER, Span},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};

#[derive(Default)]
pub struct BackgroundOnlyVisitor {}

impl BackgroundOnlyVisitor {
  pub fn new() -> Self {
    BackgroundOnlyVisitor {}
  }
}

fn is_background_only(el: &JSXElement) -> bool {
  matches!(&el.opening.name, JSXElementName::Ident(ident) if ident.sym.as_ref() == "background-only")
}

fn take_fallback(el: &mut JSXElement) -> Option<Box<Expr>> {
  let mut fallback = None;
  let mut seen_fallback = false;
  for attr in el.opening.attrs.drain(..) {
    match attr {
      JSXAttrOrSpread::SpreadElement(spread) => {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              spread.dot3_token,
              "spread attributes on <background-only> are not supported",
            )
            .emit()
        });
      }
      JSXAttrOrSpread::JSXAttr(attr) => {
        match &attr.name {
          JSXAttrName::Ident(ident) if ident.sym.as_ref() == "fallback" => {
            // Taking the last one silently would pick a first screen the
            // author did not write.
            if seen_fallback {
              HANDLER.with(|handler| {
                handler
                  .struct_span_err(
                    attr.span,
                    "<background-only> accepts only one `fallback` attribute",
                  )
                  .emit()
              });
              continue;
            }
            seen_fallback = true;
          }
          _ => {
            HANDLER.with(|handler| {
              handler
                .struct_span_err(
                  attr.span,
                  "<background-only> only supports the `fallback` attribute",
                )
                .emit()
            });
            continue;
          }
        }
        match attr.value {
          Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
            expr: JSXExpr::Expr(expr),
            ..
          })) => {
            fallback = Some(expr);
          }
          Some(JSXAttrValue::JSXElement(el)) => {
            fallback = Some(Box::new(Expr::JSXElement(el)));
          }
          Some(JSXAttrValue::JSXFragment(fragment)) => {
            fallback = Some(Box::new(Expr::JSXFragment(fragment)));
          }
          _ => {
            HANDLER.with(|handler| {
              handler
                .struct_span_err(
                  attr.span,
                  "the `fallback` attribute of <background-only> expects a JSX expression",
                )
                .emit()
            });
          }
        }
      }
    }
  }
  fallback
}

/// Whether a child is only there to lay the source out: JSX drops
/// whitespace that spans a line break, and drops `{/* comments */}` outright,
/// so neither counts towards how many children there really are.
fn is_layout_only(child: &JSXElementChild) -> bool {
  match child {
    JSXElementChild::JSXText(text) => {
      text.value.contains('\n') && text.value.chars().all(char::is_whitespace)
    }
    JSXElementChild::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::JSXEmptyExpr(..),
      ..
    }) => true,
    _ => false,
  }
}

fn children_to_expr(mut children: Vec<JSXElementChild>, span: Span) -> Expr {
  let mut content = children
    .iter()
    .enumerate()
    .filter(|(_, child)| !is_layout_only(child));
  let first = content.next().map(|(index, _)| index);
  let has_more = content.next().is_some();

  let Some(index) = first else {
    return Expr::Lit(Lit::Null(Null { span }));
  };

  // A lone child is already a valid branch expression. Wrapping it in a
  // fragment would cost a vnode per boundary on every background render and
  // buy nothing.
  if !has_more {
    match children.remove(index) {
      JSXElementChild::JSXElement(el) => return Expr::JSXElement(el),
      JSXElementChild::JSXFragment(fragment) => return Expr::JSXFragment(fragment),
      JSXElementChild::JSXExprContainer(JSXExprContainer {
        expr: JSXExpr::Expr(expr),
        ..
      }) => return *expr,
      // Text or a spread child: it still needs the fragment to become one.
      other => children.insert(index, other),
    }
  }

  Expr::JSXFragment(JSXFragment {
    span,
    opening: JSXOpeningFragment { span },
    children,
    closing: JSXClosingFragment { span },
  })
}

fn desugar(el: &mut JSXElement) -> Expr {
  let span = el.span;
  let fallback = take_fallback(el).unwrap_or_else(|| Box::new(Expr::Lit(Lit::Null(Null { span }))));
  let children = std::mem::take(&mut el.children);
  Expr::Cond(CondExpr {
    span,
    test: Box::new(Expr::Ident(Ident::new_no_ctxt(
      "__MAIN_THREAD__".into(),
      span,
    ))),
    cons: fallback,
    alt: Box::new(children_to_expr(children, span)),
  })
}

impl VisitMut for BackgroundOnlyVisitor {
  fn visit_mut_expr(&mut self, n: &mut Expr) {
    if let Expr::JSXElement(el) = n {
      if is_background_only(el) {
        *n = desugar(el);
      }
    }
    n.visit_mut_children_with(self);
  }

  fn visit_mut_jsx_element_childs(&mut self, n: &mut Vec<JSXElementChild>) {
    for child in n.iter_mut() {
      if let JSXElementChild::JSXElement(el) = child {
        if is_background_only(el) {
          let span = el.span;
          let expr = desugar(el);
          *child = JSXElementChild::JSXExprContainer(JSXExprContainer {
            span,
            expr: JSXExpr::Expr(Box::new(expr)),
          });
        }
      }
    }
    n.visit_mut_children_with(self);
  }
}

#[cfg(test)]
mod tests {
  use swc_core::{
    ecma::parser::{EsSyntax, Syntax},
    ecma::transforms::testing::test,
    ecma::visit::visit_mut_pass,
  };

  use crate::BackgroundOnlyVisitor;

  fn syntax() -> Syntax {
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    })
  }

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    desugars_to_thread_conditional_in_child_position,
    r#"
    function App() {
      return (
        <view>
          <background-only fallback={<Skeleton />}>
            <Feed />
            <Comments />
          </background-only>
        </view>
      );
    }
    "#
  );

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    desugars_to_thread_conditional_in_expression_position,
    r#"
    function Deferred({ children }) {
      return <background-only fallback={<A />}><B>{children}</B></background-only>;
    }
    "#
  );

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    defaults_to_null_without_fallback,
    r#"
    function App() {
      return (
        <view>
          <background-only>
            <Feed />
          </background-only>
        </view>
      );
    }
    "#
  );

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    desugars_nested_background_only,
    r#"
    function App() {
      return (
        <view>
          <background-only fallback={<background-only fallback={<A />}><B /></background-only>}>
            <Feed />
          </background-only>
        </view>
      );
    }
    "#
  );

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    unwraps_a_lone_child_past_layout_and_comments,
    r#"
    function App() {
      return (
        <background-only fallback={<Skeleton />}>
          {/* the feed is background-only */}
          <Feed />
        </background-only>
      );
    }
    "#
  );

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    keeps_the_fragment_for_a_lone_text_child,
    r#"
    function App() {
      return <background-only fallback={<Skeleton />}>plain text</background-only>;
    }
    "#
  );

  test!(
    module,
    syntax(),
    |_| visit_mut_pass(BackgroundOnlyVisitor::new()),
    renders_nothing_for_empty_children,
    r#"
    function App() {
      return (
        <view>
          <background-only fallback={<Skeleton />} />
        </view>
      );
    }
    "#
  );
}
