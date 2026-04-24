use regex::Regex;

use swc_core::ecma::ast::*;

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
  WorkletRef,
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
    } else if get_event_type_and_name(name.as_str()).is_some() {
      AttrName::Event
    } else {
      AttrName::Attr
    }
  }
}

impl From<Str> for AttrName {
  fn from(name: Str) -> Self {
    let name = name.value.to_string_lossy().into_owned();
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
    let name_str = name.sym.as_ref().to_string();
    if ns_str == "main-thread" && name_str == "ref" {
      AttrName::WorkletRef
    } else if ns_str == "main-thread" && get_event_type_and_name(name_str.as_str()).is_some() {
      AttrName::WorkletEvent
    } else if ns_str == "main-thread" && name_str == "gesture" {
      AttrName::Gesture
    } else {
      AttrName::Attr
    }
  }
}

fn get_event_type_and_name(props_key: &str) -> Option<(String, String)> {
  let re = Regex::new(r"^(global-bind|bind|catch|capture-bind|capture-catch)([A-Za-z]+)$").unwrap();
  if let Some(captures) = re.captures(props_key) {
    let event_type = if captures.get(1).unwrap().as_str().contains("capture") {
      captures.get(1).unwrap().as_str().to_string()
    } else {
      format!("{}Event", captures.get(1).unwrap().as_str())
    };
    let event_name = captures.get(2).unwrap().as_str().to_string();
    return Some((event_type, event_name));
  }
  None
}
