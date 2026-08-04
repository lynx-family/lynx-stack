use std::{
  borrow::Cow,
  collections::{HashMap, HashSet},
};

use napi_derive::napi;
use swc_core::ecma::{
  ast::{JSXAttr, JSXAttrName, JSXAttrOrSpread, JSXElement, JSXElementName},
  visit::{VisitMut, VisitMutWith},
};
use swc_plugins_shared::lynx_event::{
  is_lynx_event_attribute_name, transform_react_event_attribute_name,
};

#[derive(Clone, Copy, Debug, Default)]
pub enum TransformBuiltinAttributeNamesMode {
  #[default]
  DashCase,
  MappingOnly,
}

impl napi::bindgen_prelude::FromNapiValue for TransformBuiltinAttributeNamesMode {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let value = <&str>::from_napi_value(env, napi_val).map_err(|error| {
      napi::bindgen_prelude::error!(
        error.status,
        "Failed to convert napi value into enum `{}`. {}",
        "TransformBuiltinAttributeNamesMode",
        error,
      )
    })?;

    match value {
      "dash-case" => Ok(Self::DashCase),
      "mapping-only" => Ok(Self::MappingOnly),
      _ => Err(napi::bindgen_prelude::error!(
        napi::bindgen_prelude::Status::InvalidArg,
        "value `{}` does not match any variant of enum `{}`",
        value,
        "TransformBuiltinAttributeNamesMode"
      )),
    }
  }
}

impl napi::bindgen_prelude::ToNapiValue for TransformBuiltinAttributeNamesMode {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    value: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    match value {
      Self::DashCase => <&str>::to_napi_value(env, "dash-case"),
      Self::MappingOnly => <&str>::to_napi_value(env, "mapping-only"),
    }
  }
}

/**
 * Serializable rules for transforming builtin element attribute names.
 *
 * Exact entries in `rename` take precedence over `preserve`, followed by the
 * fallback behavior selected by `mode`.
 *
 * @public
 */
#[napi(object)]
#[derive(Clone, Debug, Default)]
pub struct TransformBuiltinAttributeNamesOptions {
  /**
   * The fallback behavior for attribute names not listed in `rename` or
   * `preserve`.
   *
   * `'dash-case'` also applies the default React-style event mappings.
   * `'mapping-only'` leaves all remaining names unchanged.
   *
   * @defaultValue `'dash-case'`
   */
  #[napi(ts_type = "'dash-case' | 'mapping-only'")]
  pub mode: Option<TransformBuiltinAttributeNamesMode>,
  /**
   * Attribute names that should remain unchanged unless an exact `rename`
   * entry is also present.
   */
  #[napi(ts_type = "ReadonlyArray<string>")]
  pub preserve: Option<Vec<String>>,
  /**
   * Exact mappings from source attribute names to transformed attribute names.
   */
  #[napi(ts_type = "Readonly<Record<string, string>>")]
  pub rename: Option<HashMap<String, String>>,
}

pub struct TransformBuiltinAttributeNamesVisitor {
  mode: TransformBuiltinAttributeNamesMode,
  preserve: HashSet<String>,
  rename: HashMap<String, String>,
}

impl Default for TransformBuiltinAttributeNamesVisitor {
  fn default() -> Self {
    Self::new(Default::default())
  }
}

impl TransformBuiltinAttributeNamesVisitor {
  pub fn new(options: TransformBuiltinAttributeNamesOptions) -> Self {
    Self {
      mode: options.mode.unwrap_or_default(),
      preserve: options.preserve.unwrap_or_default().into_iter().collect(),
      rename: options.rename.unwrap_or_default(),
    }
  }

  fn transform_attribute_name<'a>(&self, name: &'a str) -> Cow<'a, str> {
    if let Some(transformed) = self.rename.get(name) {
      return Cow::Owned(transformed.clone());
    }

    if self.preserve.contains(name)
      || matches!(self.mode, TransformBuiltinAttributeNamesMode::MappingOnly)
    {
      return Cow::Borrowed(name);
    }

    default_attribute_name_transform(name)
  }
}

impl VisitMut for TransformBuiltinAttributeNamesVisitor {
  fn visit_mut_jsx_element(&mut self, node: &mut JSXElement) {
    let JSXElementName::Ident(tag_name) = &node.opening.name else {
      node.visit_mut_children_with(self);
      return;
    };

    if !tag_name
      .sym
      .starts_with(|character: char| character.is_ascii_lowercase())
    {
      node.visit_mut_children_with(self);
      return;
    }

    for attribute in &mut node.opening.attrs {
      let JSXAttrOrSpread::JSXAttr(JSXAttr {
        name: JSXAttrName::Ident(name),
        ..
      }) = attribute
      else {
        continue;
      };

      if let Cow::Owned(transformed) = self.transform_attribute_name(name.sym.as_ref()) {
        name.sym = transformed.into();
      }
    }

    node.visit_mut_children_with(self);
  }
}

fn default_attribute_name_transform(name: &str) -> Cow<'_, str> {
  if name == "className" || is_lynx_event_attribute_name(name) {
    return Cow::Borrowed(name);
  }

  if let Some(transformed) = transform_react_event_attribute_name(name) {
    return Cow::Owned(transformed);
  }

  if !name.bytes().any(|byte| byte.is_ascii_uppercase()) {
    return Cow::Borrowed(name);
  }

  let mut transformed = String::with_capacity(name.len() + 4);
  for (index, character) in name.chars().enumerate() {
    if character.is_ascii_uppercase() {
      if index != 0 {
        transformed.push('-');
      }
      transformed.push(character.to_ascii_lowercase());
    } else {
      transformed.push(character);
    }
  }
  Cow::Owned(transformed)
}

#[cfg(test)]
mod tests {
  use std::collections::HashMap;

  use super::{
    default_attribute_name_transform, TransformBuiltinAttributeNamesMode,
    TransformBuiltinAttributeNamesOptions, TransformBuiltinAttributeNamesVisitor,
  };

  #[test]
  fn transforms_camel_case_names_to_dash_case() {
    assert_eq!(
      default_attribute_name_transform("textMaxline"),
      "text-maxline"
    );
    assert_eq!(
      default_attribute_name_transform("tailColorConvert"),
      "tail-color-convert"
    );
    assert_eq!(default_attribute_name_transform("XMLValue"), "x-m-l-value");
  }

  #[test]
  fn preserves_framework_and_lynx_event_attribute_names() {
    for name in [
      "className",
      "bindTap",
      "catchTap",
      "capture-bindTap",
      "capture-catchTap",
      "global-bindTap",
    ] {
      assert_eq!(default_attribute_name_transform(name), name);
    }
  }

  #[test]
  fn transforms_react_event_attribute_names() {
    assert_eq!(default_attribute_name_transform("onClick"), "bindtap");
    assert_eq!(default_attribute_name_transform("onCatchTap"), "catchtap");
    assert_eq!(default_attribute_name_transform("onReady"), "bindready");
    assert_eq!(
      default_attribute_name_transform("onTouchStart"),
      "bindtouchstart"
    );
  }

  #[test]
  fn applies_serializable_custom_rules_in_precedence_order() {
    let visitor =
      TransformBuiltinAttributeNamesVisitor::new(TransformBuiltinAttributeNamesOptions {
        mode: Some(TransformBuiltinAttributeNamesMode::DashCase),
        preserve: Some(vec!["tailColorConvert".into(), "textMaxline".into()]),
        rename: Some(HashMap::from([(
          "textMaxline".into(),
          "custom-maxline".into(),
        )])),
      });

    assert_eq!(
      visitor.transform_attribute_name("textMaxline"),
      "custom-maxline"
    );
    assert_eq!(
      visitor.transform_attribute_name("tailColorConvert"),
      "tailColorConvert"
    );
    assert_eq!(
      visitor.transform_attribute_name("accessibilityLabel"),
      "accessibility-label"
    );
  }

  #[test]
  fn mapping_only_preserves_unmapped_attribute_names() {
    let visitor =
      TransformBuiltinAttributeNamesVisitor::new(TransformBuiltinAttributeNamesOptions {
        mode: Some(TransformBuiltinAttributeNamesMode::MappingOnly),
        rename: Some(HashMap::from([(
          "textMaxline".into(),
          "custom-maxline".into(),
        )])),
        ..Default::default()
      });

    assert_eq!(
      visitor.transform_attribute_name("textMaxline"),
      "custom-maxline"
    );
    assert_eq!(
      visitor.transform_attribute_name("tailColorConvert"),
      "tailColorConvert"
    );
  }
}
