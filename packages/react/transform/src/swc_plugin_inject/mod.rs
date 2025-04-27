use std::{collections::HashMap, fmt::Debug};

use napi_derive::napi;
use swc_core::{
  common::{errors::HANDLER, sync::Lrc, util::take::Take, FileName, Mark, SourceMap, DUMMY_SP},
  ecma::{
    ast::*,
    parser::{lexer::Lexer, PResult, Parser, StringInput},
    transforms::base::resolver,
    utils::{prepend_stmt, private_ident},
    visit::{VisitMut, VisitMutWith},
  },
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

pub struct InjectVisitor {
  opts: InjectVisitorConfig,
  unresolved_mark: Mark,
  top_level_mark: Mark,
  inject_exprs: HashMap<String, Box<Expr>>,
  imports: Vec<(String, ImportSpecifier)>,
}

impl InjectVisitor {
  pub fn new(opts: InjectVisitorConfig, unresolved_mark: Mark, top_level_mark: Mark) -> Self {
    InjectVisitor {
      opts,
      unresolved_mark,
      top_level_mark,
      inject_exprs: HashMap::new(),
      imports: vec![],
    }
  }
}

impl VisitMut for InjectVisitor {
  fn visit_mut_expr(&mut self, n: &mut Expr) {
    if let Expr::Ident(i) = n {
      if i.to_id().1.has_mark(self.unresolved_mark) {
        if !self.inject_exprs.contains_key(&i.sym.to_string()) {
          // if we can't find the inject_expr, we need to parse / create it
          if let Some(inject) = self.opts.inject.get(&i.sym.to_string()) {
            match &inject {
              InjectAs::Expr(inject) => {
                let expr = parse_define(inject);
                match expr {
                  Ok(expr) => {
                    self.inject_exprs.insert(i.sym.to_string(), expr);
                  }
                  Err(e) => {
                    HANDLER.with(|handler| {
                      handler
                        .struct_span_err(
                          i.span,
                          format!("parse define failed: {}", e.kind().msg()).as_str(),
                        )
                        .emit();
                    });
                    return;
                  }
                }
              }
              InjectAs::ImportDefault(pkg_name) => {
                let ii = private_ident!(i.sym.clone());
                self
                  .inject_exprs
                  .insert(i.sym.to_string(), Box::new(Expr::Ident(ii.clone())));
                self.imports.push((
                  pkg_name.to_string(),
                  ImportSpecifier::Default(ImportDefaultSpecifier {
                    span: DUMMY_SP,
                    local: ii.clone(),
                  }),
                ))
              }
              InjectAs::ImportStarAs(pkg_name) => {
                let ii = private_ident!(i.sym.clone());
                self
                  .inject_exprs
                  .insert(i.sym.to_string(), Box::new(Expr::Ident(ii.clone())));
                self.imports.push((
                  pkg_name.to_string(),
                  ImportSpecifier::Namespace(ImportStarAsSpecifier {
                    span: DUMMY_SP,
                    local: ii.clone(),
                  }),
                ))
              }
              InjectAs::ImportNamed(pkg_name, imported) => {
                let ii = private_ident!(i.sym.clone());
                self
                  .inject_exprs
                  .insert(i.sym.to_string(), Box::new(Expr::Ident(ii.clone())));
                self.imports.push((
                  pkg_name.to_string(),
                  ImportSpecifier::Named(ImportNamedSpecifier {
                    span: DUMMY_SP,
                    local: ii.clone(),
                    imported: Some(ModuleExportName::Ident(private_ident!(imported.as_str()))),
                    is_type_only: Default::default(),
                  }),
                ))
              }
            }
          }
        }

        if let Some(expr) = self.inject_exprs.get(&i.sym.to_string()) {
          *n = *expr.to_owned();

          let mut resolver = resolver(self.unresolved_mark, self.top_level_mark, false);
          n.visit_mut_with(&mut resolver);
        }
      }
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    n.visit_mut_children_with(self);

    // TODO(hongzhiyuan.hzy): groupBy `src`
    if self.imports.len() > 0 {
      self.imports.take().into_iter().rev().for_each(|import| {
        prepend_stmt(
          &mut n.body,
          ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            phase: ImportPhase::Evaluation,
            specifiers: vec![import.1],
            src: Box::new(Str {
              span: DUMMY_SP,
              raw: None,
              value: import.0.into(),
            }),
            type_only: Default::default(),
            with: Default::default(),
          })),
        );
      });
    }
  }
}

// code from swc_ecma_quote_macros
fn parse_define(define: &str) -> PResult<Box<Expr>> {
  let cm = Lrc::new(SourceMap::default());
  let fm = cm.new_source_file(FileName::Anon.into(), define.to_string());

  let lexer = Lexer::new(
    Default::default(),
    EsVersion::Es2020,
    StringInput::from(&*fm),
    None,
  );
  let mut parser = Parser::new_from(lexer);

  return parser.parse_expr();
}

#[cfg(test)]
mod tests {
  use std::collections::HashMap;
  use swc_core::{
    common::Mark,
    ecma::parser::Syntax,
    ecma::{parser::EsSyntax, transforms::testing::test},
    ecma::{transforms::base::resolver, visit::visit_mut_pass},
  };

  use crate::swc_plugin_inject::{InjectAs, InjectVisitor, InjectVisitorConfig};

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(InjectVisitor::new(
          InjectVisitorConfig {
            inject: HashMap::from([
              (
                "__SOME__".into(),
                InjectAs::Expr("__globalProps.xxx ?? __globalProps.yyy ?? 'zzz'".into()),
              ),
              (
                "__SOME_2__".into(),
                InjectAs::Expr("__globalProps.xxx ?? __globalProps.yyy ?? zzz".into()),
              ),
              (
                "__SOME_3__".into(),
                InjectAs::Expr("__globalProps.xxx ?? __globalProps.yyy ?? __SOME__".into()),
              ),
              ("zzz".into(), InjectAs::ImportDefault("@lynx-js/zzz".into())),
              (
                "FiberElementApi".into(),
                InjectAs::ImportStarAs("@lynx-js/react".into()),
              ),
              (
                "__SetClasses".into(),
                InjectAs::ImportNamed("@lynx-js/react".into(), "__SetClassesDarkMode".into()),
              ),
            ]),
          },
          unresolved_mark,
          top_level_mark,
        )),
      )
    },
    should_inject,
    r#"
    console.log(__SOME__);
    console.log(__SOME_2__);
    console.log(__SOME_3__);
    console.log(FiberElementApi.CreatePage);
    console.log(__SetClasses);
    "#
  );
  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();

      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(InjectVisitor::new(
          InjectVisitorConfig {
            inject: HashMap::from([(
              "__DARK_MODE_THEME__".into(),
              InjectAs::Expr("__globalProps.xxx ?? __globalProps.yyy ?? 'zzz'".into()),
            )]),
          },
          unresolved_mark,
          top_level_mark,
        )),
      )
    },
    should_inject_callee,
    r#"
    __DARK_MODE_THEME__.toString()
    "#
  );
}
