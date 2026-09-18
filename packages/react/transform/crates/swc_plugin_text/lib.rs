use swc_core::{
  common::DUMMY_SP,
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};

use swc_plugins_shared::jsx_helpers::{jsx_is_single_text, jsx_text_to_str};

pub struct TextVisitor {}

impl VisitMut for TextVisitor {
  // transform
  // <text>
  //   Hello World
  // </text>
  // to
  // <text
  //   text="Hello World"
  // />
  fn visit_mut_jsx_element(&mut self, n: &mut JSXElement) {
    n.visit_mut_children_with(self);
    if !jsx_is_single_text(n) {
      return;
    }

    let value = match &n.children[0] {
      JSXElementChild::JSXText(text) => JSXAttrValue::Str(Str {
        span: DUMMY_SP,
        raw: None,
        value: jsx_text_to_str(&text.value).into(),
      }),
      // Keep expressions as expressions: JSX attribute strings normalize
      // whitespace differently from JavaScript strings and template literals.
      JSXElementChild::JSXExprContainer(expr) => JSXAttrValue::JSXExprContainer(expr.clone()),
      _ => unreachable!(),
    };
    n.opening.attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
      span: DUMMY_SP,
      name: JSXAttrName::Ident(IdentName::new("text".into(), DUMMY_SP)),
      value: Some(value),
    }));
    n.children.clear();
  }
}

#[cfg(test)]
mod tests {
  use swc_core::ecma::{
    parser::{EsSyntax, Syntax},
    transforms::testing::test,
    visit::visit_mut_pass,
  };

  use super::TextVisitor;

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(TextVisitor {}),
    should_transform_string_expressions_to_text_attr,
    r#"
    <>
      <text>{'Hello'}</text>
      <text>{''}</text>
      <text>{'  Hello\n\tWorld &amp;  '}</text>
      <text>{`Hello`}</text>
      <text>{`Hello ${name}`}</text>
      <text>{`Hello ${getName()} ${count}`}</text>
      <text>{`  Hello
        ${name}\tWorld  `}</text>
      <text class="hello">{'Hello'}</text>
      <text {...attrs}>{`Hello ${name}`}</text>
      <text text="old">{'Hello'}</text>
    </>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(TextVisitor {}),
    should_transform_single_static_text_to_text_attr,
    r#"
    <>
      <text>Hello World</text>
      <text> </text>
      <text></text>
      <text class="hello">Hello World</text>
      <text {...attrs}>Hello World</text>
      <text text="Hello Lynx">Hello World</text>
    </>
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_t| visit_mut_pass(TextVisitor {}),
    should_keep_children_for_dynamic_or_multiple_text,
    r#"
    <>
      <text>{hello}, ReactLynx</text>
      <text>{hello}</text>
      <text>
        Hello
        <text>ReactLynx</text>
      </text>
      <x-text>Hello, ReactLynx</x-text>
      <x-text>{'Hello'}</x-text>
      <x-text>{`Hello ${name}`}</x-text>
      <text>{42}</text>
      <text>{null}</text>
      <text>{false}</text>
      <text>{['Hello']}</text>
      <text>{tag`Hello ${name}`}</text>
      <text>{'Hello'}{name}</text>
      <text>Hello {`World ${name}`}</text>
      <text>{'Hello'}<text>{name}</text></text>
      <text>{'Hello'}{/* comment */}</text>
      </>
    "#
  );
}
