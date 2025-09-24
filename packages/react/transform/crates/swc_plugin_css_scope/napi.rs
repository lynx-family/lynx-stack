use crate::{
  CSSScope as CoreCSSScope, CSSScopeVisitor as CoreVisitor, CSSScopeVisitorConfig as CoreConfig,
};
use napi_derive::napi;
use swc_core::{
  common::comments::Comments,
  ecma::{ast::*, visit::VisitMut},
};

#[derive(Clone, Copy, Debug)]
pub enum CSSScope {
  All,
  None,
  Modules,
}

impl napi::bindgen_prelude::FromNapiValue for CSSScope {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let val = <&str>::from_napi_value(env, napi_val).map_err(|e| {
      napi::bindgen_prelude::error!(
        e.status,
        "Failed to convert napi value into enum `{}`. {}",
        "CSSScope",
        e,
      )
    })?;
    match val {
      "all" => Ok(CSSScope::All),
      "none" => Ok(CSSScope::None),
      "modules" => Ok(CSSScope::Modules),
      _ => Err(napi::bindgen_prelude::error!(
        napi::bindgen_prelude::Status::InvalidArg,
        "value `{}` does not match any variant of enum `{}`",
        val,
        "CSSScope"
      )),
    }
  }
}

impl napi::bindgen_prelude::ToNapiValue for CSSScope {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    match val {
      CSSScope::All => <&str>::to_napi_value(env, "all"),
      CSSScope::None => <&str>::to_napi_value(env, "none"),
      CSSScope::Modules => <&str>::to_napi_value(env, "modules"),
    }
  }
}

impl From<CSSScope> for CoreCSSScope {
  fn from(val: CSSScope) -> Self {
    match val {
      CSSScope::All => CoreCSSScope::All,
      CSSScope::None => CoreCSSScope::None,
      CSSScope::Modules => CoreCSSScope::Modules,
    }
  }
}

impl From<CoreCSSScope> for CSSScope {
  fn from(val: CoreCSSScope) -> Self {
    match val {
      CoreCSSScope::All => CSSScope::All,
      CoreCSSScope::None => CSSScope::None,
      CoreCSSScope::Modules => CSSScope::Modules,
    }
  }
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct CSSScopeVisitorConfig {
  #[napi(ts_type = "'all' | 'none' | 'modules'")]
  /// @public
  pub mode: CSSScope,

  /// @public
  pub filename: String,
}

impl Default for CSSScopeVisitorConfig {
  fn default() -> Self {
    CSSScopeVisitorConfig {
      mode: CSSScope::None,
      filename: "index.jsx".into(),
    }
  }
}

impl From<CSSScopeVisitorConfig> for CoreConfig {
  fn from(val: CSSScopeVisitorConfig) -> Self {
    CoreConfig {
      mode: val.mode.into(),
      filename: val.filename,
    }
  }
}

impl From<CoreConfig> for CSSScopeVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    CSSScopeVisitorConfig {
      mode: val.mode.into(),
      filename: val.filename,
    }
  }
}

pub struct CSSScopeVisitor<C>
where
  C: Comments,
{
  inner: CoreVisitor<C>,
}

impl<C> CSSScopeVisitor<C>
where
  C: Comments,
{
  pub fn new(cfg: CSSScopeVisitorConfig, comments: Option<C>) -> Self {
    Self {
      inner: CoreVisitor::new(cfg.into(), comments),
    }
  }
}

impl<C> VisitMut for CSSScopeVisitor<C>
where
  C: Comments,
{
  fn visit_mut_expr(&mut self, n: &mut Expr) {
    self.inner.visit_mut_expr(n);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n);
  }
}
