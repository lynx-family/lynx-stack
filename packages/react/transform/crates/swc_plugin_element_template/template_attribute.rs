use swc_core::ecma::ast::*;

#[derive(Debug, Clone)]
pub(super) enum TemplateAttributeSlot {
  Attr { key: String, slot_index: i32 },
  Spread { slot_index: i32 },
}

pub(super) fn template_attribute_key(key: &str) -> &str {
  if key == "className" {
    "class"
  } else {
    key
  }
}

pub(super) fn template_attribute_descriptor_key(name: &JSXAttrName) -> String {
  match name {
    JSXAttrName::Ident(name) => template_attribute_key(name.sym.as_ref()).to_string(),
    JSXAttrName::JSXNamespacedName(JSXNamespacedName { ns, name, .. }) => {
      template_namespaced_attribute_descriptor_key(ns, name)
    }
  }
}

pub(super) fn template_namespaced_attribute_descriptor_key(
  ns: &IdentName,
  name: &IdentName,
) -> String {
  format!("{}:{}", ns.sym, name.sym)
}
