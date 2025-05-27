use regex::Regex;

use swc_core::ecma::ast::*;

#[derive(Debug, Clone)]
pub enum AttrName {
  Attr(String),
  Dataset(String),
  Event(String, String),
  WorkletEvent(
    /* worklet_type */ String,
    /* event_type */ String,
    /* event_name */ String,
  ),
  Style,
  Class,
  ID,
  Ref,
  TimingFlag,
  WorkletRef(/* worklet_type */ String),
  ListItemPlatformInfo,
  Gesture(String),
}

impl From<String> for AttrName {
  fn from(name: String) -> Self {
    if name.starts_with("data-") {
      AttrName::Dataset(name[5..].to_string())
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
    } else if let Some((event_type, event_name)) = get_event_type_and_name(name.as_str()) {
      AttrName::Event(event_type, event_name)
    } else {
      AttrName::Attr(name)
    }
  }
}

impl From<Str> for AttrName {
  fn from(name: Str) -> Self {
    let name = name.value.as_ref().to_string();
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
    let ns_str = ns.sym.as_ref().to_string();
    let name_str = name.sym.as_ref().to_string();
    if name_str == "ref" {
      AttrName::WorkletRef(ns_str)
    } else if let Some((event_type, event_name)) = get_event_type_and_name(name_str.as_str()) {
      AttrName::WorkletEvent(ns_str, event_type, event_name)
    } else if name_str == "gesture" {
      AttrName::Gesture(ns_str)
    } else {
      todo!()
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
