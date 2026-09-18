use swc_core::ecma::ast::*;
use swc_plugins_shared::lynx_event::is_lynx_event_attribute_name;

#[derive(Debug, Clone)]
pub enum AttrName {
  Attr,
  Dataset,
  Event,
  WorkletEvent,
  Style,
  Class,
  ID,
  Ref,
  TimingFlag,
  UnsupportedNamespacedRef,
  MTRef,
  Gesture,
}

impl From<String> for AttrName {
  fn from(name: String) -> Self {
    if name.strip_prefix("data-").is_some() {
      AttrName::Dataset
    } else if name == "class" || name == "className" {
      AttrName::Class
    } else if name == "style" {
      AttrName::Style
    } else if name == "id" {
      AttrName::ID
    } else if name == "ref" {
      AttrName::Ref
    } else if name == "__lynx_timing_flag" {
      AttrName::TimingFlag
    } else if is_lynx_event_attribute_name(name.as_str()) {
      AttrName::Event
    } else {
      AttrName::Attr
    }
  }
}

impl From<Str> for AttrName {
  fn from(name: Str) -> Self {
    let name = name.value.as_str().unwrap_or("").to_string();
    Self::from(name)
  }
}

impl From<Ident> for AttrName {
  fn from(name: Ident) -> Self {
    let name = name.sym.as_ref().to_string();
    Self::from(name)
  }
}

impl AttrName {
  pub fn from_ns(ns: Ident, name: Ident) -> Self {
    let ns_str = ns.sym.as_ref();
    let name_str = name.sym.as_ref();
    if ns_str == "main-thread" && name_str == "ref" {
      return AttrName::MTRef;
    }
    if name_str == "ref" {
      return AttrName::UnsupportedNamespacedRef;
    }

    if ns_str != "main-thread" {
      return AttrName::Attr;
    }

    match name_str {
      "gesture" => AttrName::Gesture,
      _ if is_lynx_event_attribute_name(name_str) => AttrName::WorkletEvent,
      _ => AttrName::Attr,
    }
  }
}
