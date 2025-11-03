use swc_core::{
  common::DUMMY_SP,
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};

use swc_plugins_shared::jsx_helpers::{jsx_is_single_static_text, jsx_text_to_str};

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
    let is_single_static_text = jsx_is_single_static_text(n);
    if is_single_static_text {
      if let JSXElementChild::JSXText(text) = &n.children[0] {
        let text_content = jsx_text_to_str(&text.value);
        n.opening.attrs.push(JSXAttrOrSpread::JSXAttr(JSXAttr {
          span: DUMMY_SP,
          name: JSXAttrName::Ident(IdentName::new("text".into(), DUMMY_SP)),
          value: Some(JSXAttrValue::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            raw: None,
            value: text_content,
          }))),
        }));
        n.children = vec![];
      }
    }
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
      </>
    "#
  );
}
