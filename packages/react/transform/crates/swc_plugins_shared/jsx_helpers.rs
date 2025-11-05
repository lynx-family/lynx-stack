use regex::Regex;
use std::borrow::Cow;

use once_cell::sync::Lazy;
use swc_core::{
  common::{errors::HANDLER, iter::IdentifyLast, Spanned, DUMMY_SP},
  ecma::{
    ast::{JSXExpr, *},
    atoms::{atom, Atom},
  },
};

pub fn jsx_name(name: JSXElementName) -> Box<Expr> {
  let span = name.span();
  match name {
    JSXElementName::Ident(i) => {
      if i.sym == atom!("this") {
        return Box::new(Expr::This(ThisExpr { span }));
      }
      // If it starts with lowercase
      if i.as_ref().starts_with(|c: char| c.is_ascii_lowercase()) {
        Box::new(Expr::Lit(Lit::Str(Str {
          span,
          raw: None,
          value: i.sym.into(),
        })))
      } else {
        Box::new(Expr::Ident(i))
      }
    }
    JSXElementName::JSXNamespacedName(JSXNamespacedName {
      ref ns, ref name, ..
    }) => {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(span, "JSX Namespace is disabled")
          .emit()
      });
      let value = format!("{}:{}", ns.sym, name.sym);

      Box::new(Expr::Lit(Lit::Str(Str {
        span,
        raw: None,
        value: value.into(),
      })))
    }
    JSXElementName::JSXMemberExpr(JSXMemberExpr { obj, prop, .. }) => {
      fn convert_obj(obj: JSXObject) -> Box<Expr> {
        let span = obj.span();

        (match obj {
          JSXObject::Ident(i) => {
            if i.sym == atom!("this") {
              Expr::This(ThisExpr { span })
            } else {
              Expr::Ident(i)
            }
          }
          JSXObject::JSXMemberExpr(e) => Expr::Member(MemberExpr {
            span,
            obj: convert_obj(e.obj),
            prop: MemberProp::Ident(e.prop),
          }),
        })
        .into()
      }
      Box::new(Expr::Member(MemberExpr {
        span,
        obj: convert_obj(obj),
        prop: MemberProp::Ident(prop),
      }))
    }
  }
}

pub fn jsx_attr_name(name: &JSXAttrName) -> Atom {
  match name {
    JSXAttrName::Ident(ref id) => id.sym.clone(),
    JSXAttrName::JSXNamespacedName(ref name) => format!("{}:{}", name.ns.sym, name.name.sym).into(),
  }
}

pub fn jsx_attr_value(value: Option<JSXAttrValue>) -> Box<Expr> {
  match value {
    Some(JSXAttrValue::Str(s)) => Box::new(Expr::Lit(Lit::Str(s))),
    Some(JSXAttrValue::JSXExprContainer(JSXExprContainer { expr, .. })) => match expr {
      JSXExpr::Expr(expr) => expr,
      JSXExpr::JSXEmptyExpr(_) => Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))),
    },
    Some(JSXAttrValue::JSXElement(jsx)) => Box::new(Expr::JSXElement(jsx)),
    Some(JSXAttrValue::JSXFragment(jsx)) => Box::new(Expr::JSXFragment(jsx)),
    None => Box::new(Expr::Lit(Lit::Bool(Bool {
      span: DUMMY_SP,
      value: true,
    }))),
  }
}

pub fn jsx_attr_to_prop(attr: &JSXAttr) -> PropOrSpread {
  let id = jsx_attr_name(&attr.name);

  PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
    key: PropName::Str(Str {
      span: attr.span,
      raw: None,
      value: id.into(),
    }),
    value: jsx_attr_value(attr.value.clone()),
  })))
}

pub fn jsx_props_to_obj(jsx: &JSXElement) -> Option<ObjectLit> {
  let mut obj = ObjectLit {
    span: DUMMY_SP,
    props: vec![],
  };
  for attr in &jsx.opening.attrs {
    match attr {
      JSXAttrOrSpread::JSXAttr(attr) => {
        obj.props.push(jsx_attr_to_prop(attr));
      }
      JSXAttrOrSpread::SpreadElement(v) => {
        obj.props.push(PropOrSpread::Spread(v.clone()));
      }
    }
  }
  Some(obj)
}

pub fn jsx_text_to_str(t: &Atom) -> Atom {
  static SPACE_START: Lazy<Regex> = Lazy::new(|| Regex::new("^[ ]+").unwrap());
  static SPACE_END: Lazy<Regex> = Lazy::new(|| Regex::new("[ ]+$").unwrap());
  let mut buf = String::new();
  let replaced = t.replace('\t', " ");

  for (is_last, (i, line)) in replaced.lines().enumerate().identify_last() {
    if line.is_empty() {
      continue;
    }
    let line = Cow::from(line);
    let line = if i != 0 {
      SPACE_START.replace_all(&line, "")
    } else {
      line
    };
    let line = if is_last {
      line
    } else {
      SPACE_END.replace_all(&line, "")
    };
    if line.is_empty() {
      continue;
    }
    if i != 0 && !buf.is_empty() {
      buf.push(' ')
    }
    buf.push_str(&line);
  }
  buf.into()
}

pub fn jsx_children_to_expr(children: Vec<JSXElementChild>) -> Expr {
  let children: Vec<_> = children
    .into_iter()
    .map(|child| match child {
      JSXElementChild::JSXText(t) => {
        let s = jsx_text_to_str(&t.value);
        if s.is_empty() {
          None
        } else {
          Some(Expr::Lit(Lit::Str(Str {
            span: DUMMY_SP,
            value: s.into(),
            raw: None,
          })))
        }
      }
      JSXElementChild::JSXExprContainer(JSXExprContainer { expr, .. }) => match expr {
        JSXExpr::Expr(expr) => Some(*expr),
        JSXExpr::JSXEmptyExpr(_) => None,
      },
      JSXElementChild::JSXElement(jsx) => Some(Expr::JSXElement(jsx)),
      JSXElementChild::JSXFragment(jsx) => Some(Expr::JSXFragment(jsx)),
      JSXElementChild::JSXSpreadChild(_) => None,
    })
    .filter(|x| x.is_some())
    .collect();

  if children.len() == 1 {
    return children.into_iter().next().unwrap().unwrap();
  }

  Expr::Array(ArrayLit {
    span: DUMMY_SP,
    elems: children
      .into_iter()
      .map(|child| {
        Some(ExprOrSpread {
          spread: None,
          expr: Box::new(child.unwrap()),
        })
      })
      .collect(),
  })
}

pub fn jsx_is_custom(jsx: &JSXElement) -> bool {
  match *jsx_name(jsx.opening.name.clone()) {
    Expr::Lit(Lit::Str(s)) => {
      if s.value.to_string_lossy().as_ref() == "page" {
        return true;
      }
      false
    }
    _ => true,
  }
}

pub fn jsx_has_dynamic_key(jsx: &JSXElement) -> bool {
  jsx.opening.attrs.iter().any(|attr| {
    if let JSXAttrOrSpread::JSXAttr(JSXAttr {
      name: JSXAttrName::Ident(ident),
      value,
      ..
    }) = attr
    {
      if ident.sym == atom!("key") {
        if let Some(JSXAttrValue::JSXExprContainer(JSXExprContainer {
          expr: JSXExpr::Expr(_),
          ..
        })) = value
        {
          return true;
        }
      }
    }
    false
  })
}

pub fn jsx_is_list(jsx: &JSXElement) -> bool {
  match *jsx_name(jsx.opening.name.clone()) {
    Expr::Lit(Lit::Str(s)) => s.value.to_string_lossy().as_ref() == "list",
    _ => false,
  }
}

pub fn jsx_is_list_item(jsx: &JSXElement) -> bool {
  match *jsx_name(jsx.opening.name.clone()) {
    Expr::Lit(Lit::Str(s)) => s.value.to_string_lossy().as_ref() == "list-item",
    _ => false,
  }
}

// SDK >= 3.1 optimization: For <text>static content</text>, set text as an attribute
// instead of creating a separate raw text child node. This reduces element count
// and improves performance for simple static text elements.
pub fn jsx_is_single_static_text(n: &JSXElement) -> bool {
  match &n.opening.name {
    JSXElementName::Ident(ident) => {
      ident.sym == "text"
        && n.children.len() == 1
        && match &n.children[0] {
          JSXElementChild::JSXText(text) => !jsx_text_to_str(&text.value).is_empty(),
          _ => false,
        }
    }
    _ => false,
  }
}

pub fn jsx_is_children_full_dynamic(n: &JSXElement) -> bool {
  if n.children.is_empty() {
    return false;
  }

  // A text node is considered empty if normalized string is empty (whitespace-only)
  let is_text_empty = |text: &JSXText| jsx_text_to_str(&text.value).is_empty();

  // Filter out:
  // - Empty expression containers (JSXEmptyExpr)
  // - Whitespace-only text
  // - Spread children (unsupported)
  // Keep:
  // - JSXElement
  // - JSXFragment
  // - Expr containers with a real Expr
  // - Non-empty text (will be treated as non-dynamic later)
  let mut filtered = n.children.iter().filter(|child| match child {
    JSXElementChild::JSXExprContainer(JSXExprContainer {
      expr: JSXExpr::JSXEmptyExpr(_),
      ..
    }) => false,
    JSXElementChild::JSXText(text) => !is_text_empty(text),
    JSXElementChild::JSXSpreadChild(_) => {
      unreachable!("Unexpected JSXSpreadChild in jsx_is_children_full_dynamic - not supported")
    }
    _ => true,
  });

  // Define “dynamic”:
  // - Custom JSX elements => depends on jsx_is_custom
  // - Expression containers with Expr(_) => true
  // - Fragments => false
  // - Non-empty text => false
  let is_dynamic = |child: &JSXElementChild| -> bool {
    match child {
      JSXElementChild::JSXElement(element) => jsx_is_custom(element),
      JSXElementChild::JSXExprContainer(JSXExprContainer {
        expr: JSXExpr::Expr(_),
        ..
      }) => true,
      JSXElementChild::JSXFragment(_) => false,
      JSXElementChild::JSXText(_) => false,
      // Any other cases we decided to drop earlier or are not dynamic
      _ => false,
    }
  };

  // No substantive children after filtering
  let Some(first) = filtered.next() else {
    return false;
  };

  let first_ok = is_dynamic(first);
  if !first_ok {
    return false;
  }

  filtered.all(is_dynamic)
}

// Copied from https://github.com/swc-project/swc/blob/main/crates/swc_ecma_transforms_react/src/jsx/mod.rs#L1423
pub fn transform_jsx_attr_str(v: &str) -> String {
  let single_quote = false;
  let mut buf = String::with_capacity(v.len());
  let mut iter = v.chars().peekable();

  while let Some(c) = iter.next() {
    match c {
      '\u{0008}' => buf.push_str("\\b"),
      '\u{000c}' => buf.push_str("\\f"),
      ' ' => buf.push(' '),

      '\n' | '\r' | '\t' => {
        buf.push(' ');

        while let Some(' ') = iter.peek() {
          iter.next();
        }
      }
      '\u{000b}' => buf.push_str("\\v"),
      '\0' => buf.push_str("\\x00"),

      '\'' if single_quote => buf.push_str("\\'"),
      '"' if !single_quote => buf.push('\"'),

      '\x01'..='\x0f' | '\x10'..='\x1f' => {
        buf.push(c);
      }

      '\x20'..='\x7e' => {
        //
        buf.push(c);
      }
      '\u{7f}'..='\u{ff}' => {
        buf.push(c);
      }

      _ => {
        buf.push(c);
      }
    }
  }

  buf
}

// pub fn jsx_is_children_full_static(n: &JSXElement) -> bool {
//   if n.children.len() == 0 {
//     true
//   } else {
//     n.children
//       .iter()
//       .filter(|child| {
//         // don't handle comment
//         if let JSXElementChild::JSXExprContainer(JSXExprContainer {
//           expr: JSXExpr::JSXEmptyExpr(_),
//           ..
//         }) = child
//         {
//           false
//         } else {
//           true
//         }
//       })
//       .all(|child| match child {
//         JSXElementChild::JSXText(_text) => true,
//         JSXElementChild::JSXElement(element) => {
//           if jsx_is_custom(&element) {
//             false
//           } else {
//             true
//           }
//         }
//         JSXElementChild::JSXFragment(_) => false,
//         JSXElementChild::JSXExprContainer(JSXExprContainer {
//           expr: JSXExpr::Expr(_),
//           ..
//         }) => false,
//         JSXElementChild::JSXExprContainer(JSXExprContainer {
//           expr: JSXExpr::JSXEmptyExpr(_),
//           ..
//         }) => unreachable!(),
//         JSXElementChild::JSXSpreadChild(_) => unreachable!("Unexpected JSXSpreadChild in jsx_is_children_full_dynamic - not supported"),
//       })
//   }
// }
