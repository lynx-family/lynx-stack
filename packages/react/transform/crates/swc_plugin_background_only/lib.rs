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
          JSXAttrName::Ident(ident) if ident.sym.as_ref() == "fallback" => {}
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

fn children_to_expr(children: Vec<JSXElementChild>, span: Span) -> Expr {
  if children.is_empty() {
    return Expr::Lit(Lit::Null(Null { span }));
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
