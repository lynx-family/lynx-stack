use std::{collections::HashMap, fmt::Debug};

use napi_derive::napi;
use swc_core::{
  common::Mark,
  ecma::{ast::*, visit::VisitMut},
};

use crate::{
  InjectAs as CoreInjectAs, InjectVisitor as CoreVisitor, InjectVisitorConfig as CoreConfig,
};

#[derive(Debug, PartialEq, Clone)]
pub enum InjectAs {
  Expr(String),
  ImportDefault(String),
  ImportStarAs(String),
  ImportNamed(String, String),
}

impl napi::bindgen_prelude::FromNapiValue for InjectAs {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    // let bool_val = <bool>::from_napi_value(env, napi_val);
    // if bool_val.is_ok() {
    //   return Ok(IsModuleConfig(IsModule::Bool(bool_val.unwrap())));
    // }

    let array_val = <Vec<String>>::from_napi_value(env, napi_val);
    if array_val.is_ok() {
      let v = array_val.unwrap();

      return match v[0].as_str() {
        "expr" => Ok(InjectAs::Expr(v[1].clone())),
        "importDefault" => Ok(InjectAs::ImportDefault(v[1].clone())),
        "importStarAs" => Ok(InjectAs::ImportStarAs(v[1].clone())),
        "importNamed" => Ok(InjectAs::ImportNamed(v[1].clone(), v[2].clone())),

        _ => Err(napi::bindgen_prelude::error!(
          napi::bindgen_prelude::Status::InvalidArg,
          "value does not match any variant of enum `{}`",
          "InjectAs"
        )),
      };
    }

    Err(napi::bindgen_prelude::error!(
      napi::bindgen_prelude::Status::InvalidArg,
      "value does not match any variant of enum `{}`",
      "IsModuleConfig"
    ))
  }
}

impl napi::bindgen_prelude::ToNapiValue for InjectAs {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    match val {
      InjectAs::Expr(expr) => <Vec<String>>::to_napi_value(env, vec!["expr".into(), expr]),

      InjectAs::ImportDefault(pkg_name) => {
        <Vec<String>>::to_napi_value(env, vec!["importDefault".into(), pkg_name])
      }
      InjectAs::ImportStarAs(pkg_name) => {
        <Vec<String>>::to_napi_value(env, vec!["importStarAs".into(), pkg_name])
      }
      InjectAs::ImportNamed(pkg_name, imported) => {
        <Vec<String>>::to_napi_value(env, vec!["importNamed".into(), pkg_name, imported])
      }
    }
  }
}

impl From<InjectAs> for CoreInjectAs {
  fn from(val: InjectAs) -> Self {
    match val {
      InjectAs::Expr(expr) => CoreInjectAs::Expr(expr),
      InjectAs::ImportDefault(pkg_name) => CoreInjectAs::ImportDefault(pkg_name),
      InjectAs::ImportStarAs(pkg_name) => CoreInjectAs::ImportStarAs(pkg_name),
      InjectAs::ImportNamed(pkg_name, imported) => CoreInjectAs::ImportNamed(pkg_name, imported),
    }
  }
}

impl From<CoreInjectAs> for InjectAs {
  fn from(val: CoreInjectAs) -> Self {
    match val {
      CoreInjectAs::Expr(expr) => InjectAs::Expr(expr),
      CoreInjectAs::ImportDefault(pkg_name) => InjectAs::ImportDefault(pkg_name),
      CoreInjectAs::ImportStarAs(pkg_name) => InjectAs::ImportStarAs(pkg_name),
      CoreInjectAs::ImportNamed(pkg_name, imported) => InjectAs::ImportNamed(pkg_name, imported),
    }
  }
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct InjectVisitorConfig {
  #[napi(
    ts_type = "Record<string, ['expr', string] | ['importDefault', string] | ['importStarAs', string] | ['importNamed', string, string]>"
  )]
  pub inject: HashMap<String, InjectAs>,
}

impl Default for InjectVisitorConfig {
  fn default() -> Self {
    InjectVisitorConfig {
      inject: HashMap::from([]),
    }
  }
}

impl From<CoreConfig> for InjectVisitorConfig {
  fn from(val: CoreConfig) -> Self {
    InjectVisitorConfig {
      inject: val.inject.into_iter().map(|(k, v)| (k, v.into())).collect(),
    }
  }
}

impl From<InjectVisitorConfig> for CoreConfig {
  fn from(val: InjectVisitorConfig) -> Self {
    CoreConfig {
      inject: val.inject.into_iter().map(|(k, v)| (k, v.into())).collect(),
    }
  }
}
pub struct InjectVisitor {
  inner: CoreVisitor,
}

impl InjectVisitor {
  pub fn new(cfg: InjectVisitorConfig, unresolved_mark: Mark, top_level_mark: Mark) -> Self {
    InjectVisitor {
      inner: CoreVisitor::new(cfg.into(), unresolved_mark, top_level_mark),
    }
  }
}

impl VisitMut for InjectVisitor {
  fn visit_mut_expr(&mut self, n: &mut Expr) {
    self.inner.visit_mut_expr(n);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    self.inner.visit_mut_module(n);
  }
}
