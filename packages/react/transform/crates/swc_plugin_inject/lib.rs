use serde::{Deserialize, Deserializer};
use std::{collections::HashMap, fmt::Debug};
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

pub mod napi;

#[derive(Debug, PartialEq, Clone)]
pub enum InjectAs {
  Expr(String),
  ImportDefault(String),
  ImportStarAs(String),
  ImportNamed(String, String),
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct InjectVisitorConfig {
  pub inject: HashMap<String, InjectAs>,
}

impl<'de> Deserialize<'de> for InjectAs {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let value: Vec<serde_json::Value> = Vec::deserialize(deserializer)?;

    if value.is_empty() {
      return Err(serde::de::Error::custom(
        "Expected at least one element in InjectAs array",
      ));
    }
    let variant = value[0]
      .as_str()
      .ok_or_else(|| serde::de::Error::custom("First element of InjectAs must be a string"))?;
    match variant {
      "expr" => {
        if value.len() != 2 {
          return Err(serde::de::Error::custom(
            "`expr` variant expects 1 argument",
          ));
        }
        let expr = value[1]
          .as_str()
          .ok_or_else(|| serde::de::Error::custom("Second element of `expr` must be a string"))?;
        Ok(InjectAs::Expr(expr.to_string()))
      }
      "importDefault" => {
        if value.len() != 2 {
          return Err(serde::de::Error::custom(
            "`importDefault` variant expects 1 argument",
          ));
        }
        let import = value[1].as_str().ok_or_else(|| {
          serde::de::Error::custom("Second element of `importDefault` must be a string")
        })?;
        Ok(InjectAs::ImportDefault(import.to_string()))
      }
      "importStarAs" => {
        if value.len() != 2 {
          return Err(serde::de::Error::custom(
            "`importStarAs` variant expects 1 argument",
          ));
        }
        let import = value[1].as_str().ok_or_else(|| {
          serde::de::Error::custom("Second element of `importStarAs` must be a string")
        })?;
        Ok(InjectAs::ImportStarAs(import.to_string()))
      }
      "importNamed" => {
        if value.len() != 3 {
          return Err(serde::de::Error::custom(
            "`importNamed` variant expects 2 arguments",
          ));
        }
        let module = value[1].as_str().ok_or_else(|| {
          serde::de::Error::custom("Second element of `importNamed` must be a string")
        })?;
        let alias = value[2].as_str().ok_or_else(|| {
          serde::de::Error::custom("Third element of `importNamed` must be a string")
        })?;
        Ok(InjectAs::ImportNamed(module.to_string(), alias.to_string()))
      }
      _ => Err(serde::de::Error::custom(format!(
        "value `{variant}` does not match any variant of InjectAs"
      ))),
    }
  }
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
        if let std::collections::hash_map::Entry::Vacant(e) =
          self.inject_exprs.entry(i.sym.to_string())
        {
          // if we can't find the inject_expr, we need to parse / create it
          if let Some(inject) = self.opts.inject.get(&i.sym.to_string()) {
            match &inject {
              InjectAs::Expr(inject) => {
                let expr = parse_define(inject);
                match expr {
                  Ok(expr) => {
                    e.insert(expr);
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
                e.insert(Box::new(Expr::Ident(ii.clone())));
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
                e.insert(Box::new(Expr::Ident(ii.clone())));
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
                e.insert(Box::new(Expr::Ident(ii.clone())));
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
    if !self.imports.is_empty() {
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

  parser.parse_expr()
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

  use crate::{InjectAs, InjectVisitor, InjectVisitorConfig};

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
