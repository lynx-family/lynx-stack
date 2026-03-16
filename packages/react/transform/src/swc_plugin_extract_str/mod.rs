use napi_derive::napi;
use serde::{Deserialize, Serialize};
use std::vec;
use swc_core::{
  common::DUMMY_SP,
  ecma::ast::*,
  ecma::visit::{VisitMut, VisitMutWith},
  quote,
};

/// {@inheritdoc PluginReactLynxOptions.extractStr}
/// @public
#[derive(PartialEq, Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
#[napi(object)]
pub struct ExtractStrConfig {
  /// @public
  /// The minimum length of string literals to be extracted.
  ///
  /// @remarks
  /// Default value: `20`.
  ///
  /// @example
  ///
  /// ```js
  /// import { defineConfig } from '@lynx-js/rspeedy'
  /// import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
  ///
  /// export default defineConfig({
  ///   plugins: [
  ///     pluginReactLynx({
  ///       extractStr: {
  ///         strLength: 10,
  ///       },
  ///     })
  ///   ],
  /// })
  /// ```
  pub str_length: u32,
  /// @internal
  pub extracted_str_arr: Option<Vec<String>>,
}

impl Default for ExtractStrConfig {
  fn default() -> Self {
    ExtractStrConfig {
      str_length: 20,
      extracted_str_arr: None,
    }
  }
}

pub struct ExtractStrVisitor {
  opts: ExtractStrConfig,
  pub select_str_vec: Vec<String>,
  extracted_str_arr: Option<Vec<String>>,
  arr_name: Ident,
  is_found_str_flag: bool,
}

impl Default for ExtractStrVisitor {
  fn default() -> Self {
    ExtractStrVisitor::new(Default::default())
  }
}

impl ExtractStrVisitor {
  pub fn new(opts: ExtractStrConfig) -> Self {
    ExtractStrVisitor {
      opts: opts.clone(),
      select_str_vec: vec![],
      extracted_str_arr: opts.extracted_str_arr,
      arr_name: IdentName::new("_EXTRACT_STR".into(), DUMMY_SP).into(),
      is_found_str_flag: false,
    }
  }

  // Returns the string table index for an extractable string
  fn get_str_index(&mut self, str_value: &str) -> Option<f64> {
    if str_value.len() < self.opts.str_length as usize {
      return None;
    }

    match &self.extracted_str_arr {
      // for js: get index in extracted_str_arr
      Some(arr) => arr.iter().position(|x| x == str_value).map(|i| i as f64),
      // for lepus: get index in select_str_vec
      None => {
        let position = self.select_str_vec.iter().position(|x| x == str_value);
        Some(match position {
          Some(i) => i as f64,
          None => {
            let i = self.select_str_vec.len();
            self.select_str_vec.push(str_value.to_string());
            i as f64
          }
        })
      }
    }
  }

  // Builds the member expression that reads a value from the extracted string table.
  fn get_extracted_str_expr(&self, index: f64) -> Expr {
    Expr::Member(MemberExpr {
      span: DUMMY_SP,
      obj: Box::new(Expr::Ident(self.arr_name.clone())),
      prop: MemberProp::Computed(ComputedPropName {
        span: DUMMY_SP,
        expr: Box::new(Expr::Lit(Lit::Num(Number {
          value: index,
          span: DUMMY_SP,
          raw: None,
        }))),
      }),
    })
  }

  // Creates a template literal quasi element with the provided text content.
  fn create_tpl_element(value: &str, tail: bool) -> TplElement {
    TplElement {
      span: DUMMY_SP,
      tail,
      cooked: Some(value.into()),
      raw: value.into(),
    }
  }

  // Splits a template quasi into leading whitespace, core text, and trailing whitespace.
  fn split_tpl_quasi(value: &str) -> (&str, &str, &str) {
    let prefix_len = value
      .char_indices()
      .find(|(_, ch)| !ch.is_whitespace())
      .map_or(value.len(), |(idx, _)| idx);
    let suffix_start = value
      .char_indices()
      .rev()
      .find(|(_, ch)| !ch.is_whitespace())
      .map_or(0, |(idx, ch)| idx + ch.len_utf8());

    if prefix_len >= suffix_start {
      return (value, "", "");
    }

    (
      &value[..prefix_len],
      &value[prefix_len..suffix_start],
      &value[suffix_start..],
    )
  }
}

impl VisitMut for ExtractStrVisitor {
  fn visit_mut_module(&mut self, n: &mut Module) {
    n.visit_mut_children_with(self);
    if self.opts.extracted_str_arr.is_some() {
      return;
    }
    let str_arr = self
      .select_str_vec
      .iter()
      .map(|s| {
        let lit = Lit::Str(Str {
          span: DUMMY_SP,
          value: (**s).into(),
          raw: None,
        });
        Some(ExprOrSpread {
          spread: None,
          expr: Box::new(Expr::Lit(lit)),
        })
      })
      .collect::<Vec<Option<ExprOrSpread>>>();
    let stmt = quote!(
        r#"var $name = $arr;"# as Stmt,
        name = self.arr_name.clone(),
        arr: Expr = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: str_arr
        })
    );
    n.body.insert(0, ModuleItem::Stmt(stmt));
  }
  fn visit_mut_ident(&mut self, i: &mut Ident) {
    if i.sym.as_ref() == "__EXTRACT_STR_IDENT_FLAG__" {
      *i = self.arr_name.clone();
    }
  }
  fn visit_mut_expr(&mut self, expr: &mut Expr) {
    if self.extracted_str_arr.is_some() && !self.is_found_str_flag {
      match expr {
        Expr::Call(CallExpr {
          callee: Callee::Expr(callee_expr),
          args,
          ..
        }) => {
          if let Expr::Ident(ident) = &**callee_expr {
            if ident.sym.as_ref() == "__EXTRACT_STR_FLAG__" {
              self.is_found_str_flag = true;

              if let Some(second_arg) = args.get(1) {
                if let Expr::Ident(arg_ident) = &*second_arg.expr {
                  self.arr_name = arg_ident.clone();
                }
              }

              if let Some(first_arg) = args.first() {
                *expr = (*first_arg.expr).clone();
              } else {
                *expr = Expr::Ident(IdentName::new("__EXTRACT_STR_FLAG__".into(), DUMMY_SP).into());
              }
            } else {
              expr.visit_mut_children_with(self)
            }
          } else {
            expr.visit_mut_children_with(self)
          }
        }
        _ => expr.visit_mut_children_with(self),
      }
    } else {
      match expr {
        Expr::Lit(Lit::Str(str)) => {
          let str_value = str.value.to_string_lossy();
          let Some(index) = self.get_str_index(str_value.as_ref()) else {
            return;
          };
          *expr = self.get_extracted_str_expr(index);
        }
        Expr::Tpl(tpl) => {
          tpl.exprs.visit_mut_with(self);

          let mut next_quasis = Vec::with_capacity(tpl.quasis.len());
          let mut next_exprs = Vec::with_capacity(tpl.exprs.len() * 2);

          for (idx, quasi) in tpl.quasis.iter().enumerate() {
            let quasi_value = quasi
              .cooked
              .as_ref()
              .map(|value| value.to_string_lossy().into_owned())
              .unwrap_or_else(|| quasi.raw.to_string());
            let (prefix, core, suffix) = Self::split_tpl_quasi(&quasi_value);

            if let Some(index) = self.get_str_index(core) {
              next_quasis.push(Self::create_tpl_element(prefix, false));
              next_exprs.push(Box::new(self.get_extracted_str_expr(index)));
              next_quasis.push(Self::create_tpl_element(suffix, false));
            } else {
              next_quasis.push(Self::create_tpl_element(&quasi_value, false));
            }

            if let Some(inner_expr) = tpl.exprs.get(idx) {
              next_exprs.push(inner_expr.clone());
            }
          }

          if let Some(last_quasi) = next_quasis.last_mut() {
            last_quasi.tail = true;
          }

          tpl.quasis = next_quasis;
          tpl.exprs = next_exprs;
        }
        _ => {
          expr.visit_mut_children_with(self);
        }
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use swc_core::{
    common::Mark,
    ecma::{
      parser::{EsSyntax, Syntax},
      transforms::{
        base::{hygiene::hygiene_with_config, resolver},
        testing::test,
      },
      visit::visit_mut_pass,
    },
  };

  use crate::swc_plugin_extract_str::ExtractStrConfig;
  use crate::swc_plugin_extract_str::ExtractStrVisitor;
  test!(
    module,
    Syntax::Es(EsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ExtractStrVisitor::new(ExtractStrConfig {
        str_length: 1,
        extracted_str_arr: None
      })),
      hygiene_with_config(Default::default()),
    ),
    should_extract_str,
    r#"
    const qq = {
      a: '123',
      b: false ? '456' : '789'
    };
    console.log('!@#@#$!!@#!#!3sasdega!!23!#$!@#%%');
    globalThis.abc = ()=>{
      return {
        _EXTRACT_STR: __EXTRACT_STR_IDENT_FLAG__
      }
    }
    console.log('123');
    let q = fun('456');
    let a = '789';
    const b = '123' + '000';
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ExtractStrVisitor::new(ExtractStrConfig {
        str_length: 1,
        extracted_str_arr: Some(vec![
          "123".to_string(),
          "789".to_string(),
          "111".to_string(),
          "asdasdasd".to_string()
        ])
      })),
      hygiene_with_config(Default::default()),
    ),
    should_extract_str_with_arr,
    r#"
    function aaa() {
      var tt = lynxCoreInject.tt;
      // for __EXTRACT_STR_FLAG__
      tt.__sourcemap__release__ = "123";
      tt.define("app-service.js", function(){
        __EXTRACT_STR_FLAG__(z=lynxCoreInject.tt._params.updateData._EXTRACT_STR,z);
        const qq = {
          a: '123',
          b: false ? '456' : '789'
        };
        function ffff(z) {
          console.log(z);
          return "asdasdasd"
        }
        console.log('!@#@#$!!@#!#!3sasdega!!23!#$!@#%%');
        let q = fun('456');
        let a = '789';
        const b = '111' + '000';
      });
    }
  "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(ExtractStrVisitor::new(ExtractStrConfig {
        str_length: 1,
        extracted_str_arr: None
      })),
      hygiene_with_config(Default::default()),
    ),
    should_extract_tpl_str,
    r#"
    const greeting = `Hello ${name}`;
    const suffix = `${value} world`;
    const wrapped = `${left} middle ${right}`;
    const spaces = ` ${content} `;
  "#
  );
}
