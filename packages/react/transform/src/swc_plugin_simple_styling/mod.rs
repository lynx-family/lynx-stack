use std::collections::{HashMap, HashSet};

use convert_case::{Case, Casing};
use swc_core::common::util::take::Take;
use swc_core::common::Span;
use swc_core::common::{errors::HANDLER, Spanned, DUMMY_SP};
use swc_core::ecma::ast::{
  ArrayLit, BlockStmtOrExpr, Callee, ComputedPropName, MemberProp, Null, Number, ObjectLit,
};
use swc_core::ecma::utils::quote_str;
use swc_core::{
  ecma::{
    ast::{
      CallExpr, Expr, ExprOrSpread, Ident, ImportDecl, ImportSpecifier, KeyValueProp, Lit,
      ModuleExportName, Pat, Prop, PropName, PropOrSpread, Stmt, VarDecl,
    },
    visit::{VisitMut, VisitMutWith},
  },
  quote,
};

use crate::css_property::{CSS_PROPERTY_MAP, LONGHAND_CSS_PROPERTIES};
use crate::utils::calc_hash_with_len;

#[derive(Clone, Debug)]
#[napi(object)]
pub struct SimpleStylingVisitorConfig {
  /// @public
  pub runtime_pkg: String,
  /// @internal
  pub filename: String,
}

impl Default for SimpleStylingVisitorConfig {
  fn default() -> Self {
    SimpleStylingVisitorConfig {
      runtime_pkg: "@lynx-js/react".into(),
      filename: "index.js".into(),
    }
  }
}

pub struct SimpleStylingVisitor {
  cfg: SimpleStylingVisitorConfig,
  // import { SimpleStyleSheet as css } from '@lynx-js/react'
  // will add `css` to `simple_stylesheet_import_set
  simple_stylesheet_imported_exprs: HashSet<Expr>,
  inject_stmts: Vec<Stmt>,
  should_keep_current_stmt: bool,
  current_stylesheet_ident: Option<Ident>,
  // `styles.main` will be compiled to a set of style object hashes
  // for example:
  // sheet_style_to_hash_set: {
  //   styles: {
  //     main: ["90ad962", "90ad963", "90ad964"]
  //   }
  // }
  sheet_style_to_hash_set: HashMap<String, HashMap<String, Vec<String>>>,
  // hash to css key value
  // for example:
  // hash_to_css_key_value: {
  //   "90ad962": ("background-color", "red")
  // }
  hash_to_css_key_value: HashMap<String, (String, String)>,
  sheet_style_to_is_dynamic: HashMap<String, HashMap<String, bool>>,
}

impl Default for SimpleStylingVisitor {
  fn default() -> Self {
    SimpleStylingVisitor::new(SimpleStylingVisitorConfig::default())
  }
}
impl SimpleStylingVisitor {
  pub fn new(cfg: SimpleStylingVisitorConfig) -> Self {
    SimpleStylingVisitor {
      cfg,
      simple_stylesheet_imported_exprs: HashSet::new(),
      inject_stmts: vec![],
      should_keep_current_stmt: true,
      current_stylesheet_ident: None,
      sheet_style_to_hash_set: HashMap::new(),
      hash_to_css_key_value: HashMap::new(),
      sheet_style_to_is_dynamic: HashMap::new(),
    }
  }

  fn remember_style_obj(
    &mut self,
    stylesheet_ident: &Ident,
    style_key: &str,
    style_obj: &mut ObjectLit,
    is_dynamic: bool,
  ) {
    self
      .sheet_style_to_is_dynamic
      .entry(stylesheet_ident.sym.to_string())
      .or_insert_with(HashMap::new)
      .insert(style_key.to_string(), is_dynamic);

    style_obj.props = style_obj.props.iter_mut().filter_map(|prop_or_spread| {
      let mut hash_set = HashSet::new();
      if let PropOrSpread::Prop(prop) = prop_or_spread {
        if let Prop::KeyValue(KeyValueProp { key, value }) = &mut **prop {
          let css_key = match key {
            PropName::Ident(ident) => ident.sym.to_string(),
            PropName::Str(str) => str.value.to_string(),
            _ => {
              HANDLER.with(|handler| {
                handler
                  .struct_span_err(
                    key.span(),
                    format!(
                      "Cannot statically evaluate the css property key of SimpleStyleSheet `{}.{}`",
                      stylesheet_ident.sym, style_key
                    )
                    .as_str(),
                  )
                  .emit()
              });
              return None;
            }
          };

          let camel_case_key = css_key.clone();
          let css_key = css_key.from_case(Case::Camel).to_case(Case::Kebab);
          if !CSS_PROPERTY_MAP.contains_key(&css_key) {
            HANDLER.with(|handler| {
              handler
               .struct_span_err(
                  key.span(),
                  format!(
                    "Unknown css property key `{}` in SimpleSheet `{}.{}`",
                    camel_case_key, stylesheet_ident.sym, style_key
                  )
                 .as_str(),
                )
               .emit()
            });
            return None;
          }
          if !LONGHAND_CSS_PROPERTIES.contains(&css_key.as_str()) {
            HANDLER.with(|handler| {
              handler
              .struct_span_err(
                  key.span(),
                  format!(
                    "Only longhand css properties are supported in Simple Styling, check SimpleStyleSheet `{}.{}` with css key `{}`",
                    stylesheet_ident.sym, style_key, camel_case_key
                  )
                .as_str(),
                )
              .emit()
            });
            return None;
          }
          *key = PropName::Num(Number {
            span: DUMMY_SP,
            value: CSS_PROPERTY_MAP.get(&css_key).unwrap().clone() as f64,
            raw: None,
          });
          let css_value;
          if let Expr::Lit(Lit::Str(str)) = &**value {
            css_value = str.value.to_string();
          } else if let Expr::Lit(Lit::Num(num)) = &**value {
            css_value = num.value.to_string();
          } else {
            if !is_dynamic {
              HANDLER.with(|handler| {
                handler
                  .struct_span_err(
                    value.span(),
                    format!(
                      "Static CSS property value must be a string or number, check SimpleStyleSheet `{}.{}` with css key `{}`",
                      stylesheet_ident.sym,
                      style_key,
                      camel_case_key
                    )
                    .as_str(),
                  )
                  .emit()
              });
              return None;
            } else {
              return Some(prop_or_spread.take());
            }
          }

          // calculate hash based on css_key and value
          let string_to_hash = format!("{}:{}", css_key, css_value);
          let hash = calc_hash_with_len(string_to_hash.as_str(), 7);

          hash_set.insert(hash.clone());
          self
            .hash_to_css_key_value
            .insert(hash.clone(), (css_key.clone(), css_value.clone()));

        }
      }

      self
        .sheet_style_to_hash_set
        .entry(stylesheet_ident.sym.to_string())
        .or_insert_with(HashMap::new)
        .entry(style_key.to_string())
        .or_insert_with(Vec::new)
        .extend(hash_set);

      // remove static css in dynamic style object
      if is_dynamic {
        return None;
      }
      return Some(prop_or_spread.take());
    }).collect();
  }

  fn visit_mut_simple_stylesheet_create(&mut self, call_expr: &mut CallExpr) -> Option<Expr> {
    if let Some(stylesheet_ident) = &self.current_stylesheet_ident.clone() {
      if call_expr.args.len() != 1 {
        HANDLER.with(|handler| {
          handler
            .struct_span_err(
              call_expr.span,
              format!(
                "SimpleStyleSheet.create() should have exactly 1 argument, but got {}",
                call_expr.args.len()
              )
              .as_str(),
            )
            .emit()
        });
        return None;
      }

      if let Some(ExprOrSpread { expr: obj_expr, .. }) = call_expr.args.get_mut(0) {
        if let Expr::Object(obj) = &mut **obj_expr {
          obj.props = obj
            .props
            .iter_mut()
            .filter_map(|prop| {
              if let PropOrSpread::Prop(prop) = prop {
                if let Prop::KeyValue(KeyValueProp {
                  key: style_key,
                  value: style_value,
                }) = &mut **prop
                {
                  let style_key = match style_key {
                    PropName::Ident(ident) => ident.sym.clone(),
                    PropName::Str(str) => str.value.clone(),
                    _ => {
                      HANDLER.with(|handler| {
                        handler
                          .struct_span_err(
                            style_key.span(),
                            format!(
                              "Cannot statically evaluate the style key of SimpleStyleSheet `{}`",
                              stylesheet_ident.sym
                            )
                            .as_str(),
                          )
                          .emit()
                      });
                      return None;
                    }
                  };

                  let mut is_valid_style_object = false;
                  if let Expr::Object(style_obj) = &mut **style_value {
                    is_valid_style_object = true;
                    self.remember_style_obj(stylesheet_ident, style_key.as_str(), style_obj, false);
                  } else if let Expr::Arrow(arrow_expr) = &mut **style_value {
                    is_valid_style_object = true;
                    let mut is_valid_dynamic_style_object = false;
                    if let BlockStmtOrExpr::Expr(expr) = &mut *arrow_expr.body {
                      if let Expr::Paren(paren_expr) = &mut **expr {
                        if let Expr::Object(dynamic_style_obj) = &mut *paren_expr.expr {
                          is_valid_dynamic_style_object = true;
                          self.remember_style_obj(
                            stylesheet_ident,
                            style_key.as_str(),
                            dynamic_style_obj,
                            true,
                          );
                        }
                      }
                    }
                    if !is_valid_dynamic_style_object {
                      HANDLER.with(|handler| {
                        handler
                          .struct_span_err(
                            style_value.span(),
                            format!(
                              "SimpleStyleSheet.create() call with arrow function should return an object, check SimpleStyleSheet `{}.{}`",
                              stylesheet_ident.sym,
                              style_key.as_str()
                            )
                            .as_str(),
                          )
                          .emit()
                      });
                      return None;
                    }
                  }
                  if !is_valid_style_object {
                    HANDLER.with(|handler| {
                      handler
                       .struct_span_err(
                          style_value.span(),
                          format!(
                            "Cannot statically evaluate the style value of SimpleStyleSheet `{}.{}`, should be an object literal or arrow function return an object literal",
                            stylesheet_ident.sym,
                            style_key.as_str()
                          )
                         .as_str(),
                        )
                       .emit()
                    });
                    return None;
                  }
                }
              }

              Some(prop.take())
            })
            .collect();

          // remove the `SimpleStyleSheet.create` call
          // keep only the object
          return Some(Expr::Object(obj.take()));
        } else {
          HANDLER.with(|handler| {
            handler
              .struct_span_err(
                call_expr.span,
                format!(
                  "SimpleStyleSheet.create() should have an object argument, check SimpleStyleSheet `{}`",
                  stylesheet_ident.sym
                )
                .as_str(),
              )
              .emit()
          })
        }
      }
    }
    None
  }

  fn get_sheet_name_and_style_key(
    &self,
    expr: &mut Expr,
    is_accepted_usage: &mut bool,
  ) -> Option<(String, String)> {
    if let Expr::Member(expr_member) = expr {
      if let Expr::Ident(obj_ident) = &*expr_member.obj {
        *is_accepted_usage = true;

        let sheet_name = obj_ident.sym.to_string();

        if !self.sheet_style_to_hash_set.contains_key(&sheet_name) {
          return None;
        }
        let style_key = match &expr_member.prop {
          MemberProp::Ident(ident) => Some(ident.sym.to_string()),
          MemberProp::Computed(ComputedPropName { expr, .. }) => {
            if let Expr::Lit(Lit::Str(str)) = &**expr {
              Some(str.value.to_string().clone())
            } else {
              HANDLER.with(|handler| {
                handler
                  .struct_span_err(
                    expr.span(),
                    format!(
                      "Cannot statically evaluate the style key of SimpleStyleSheet `{}`",
                      obj_ident.sym
                    )
                    .as_str(),
                  )
                  .emit()
              });
              None
            }
          }
          _ => None,
        };
        if let Some(style_key) = style_key {
          return Some((sheet_name, style_key));
        }
      }
    }
    None
  }

  fn get_hash_set(&self, sheet_name: &str, style_key: &str) -> Vec<String> {
    let hash_set = self
      .sheet_style_to_hash_set
      .get(sheet_name)
      .and_then(|fields| fields.get(style_key))
      .unwrap_or(&Vec::new())
      .clone();
    hash_set
  }

  fn get_css_key_set(&self, sheet_name: &str, style_key: &str) -> Vec<String> {
    let hash_set = self.get_hash_set(sheet_name, style_key);
    let css_key_set = hash_set
      .iter()
      .map(|hash| {
        self
          .hash_to_css_key_value
          .get(hash)
          .unwrap_or(&(String::new(), String::new()))
          .clone()
          .0
          .clone()
      })
      .collect::<Vec<_>>();
    css_key_set
  }

  fn get_init_object_lit(&self, css_key_set: &Vec<String>) -> ObjectLit {
    ObjectLit {
      span: DUMMY_SP,
      props: css_key_set
        .iter()
        .map(|css_key| {
          PropOrSpread::Prop(Box::new(Prop::KeyValue(KeyValueProp {
            key: PropName::Num(Number {
              span: DUMMY_SP,
              value: CSS_PROPERTY_MAP.get(css_key).unwrap().clone() as f64,
              raw: None,
            }),
            value: Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP }))),
          })))
        })
        .collect(),
    }
  }

  fn check_duplicate_css_key(
    &self,
    span: Span,
    sheet_name: &str,
    style_key: &str,
    css_key_set: &Vec<String>,
    css_key_to_sheet_name_and_style_key: &mut HashMap<String, (String, String)>,
  ) {
    css_key_set.iter().for_each(|css_key| {
      if css_key_to_sheet_name_and_style_key.contains_key(css_key) {
        let (sheet_name_prev, style_key_prev) = css_key_to_sheet_name_and_style_key.get(css_key).unwrap().clone();
        HANDLER.with(|handler| {
          handler
          .struct_span_err(
              span,
              format!(
                "Duplicate css property is not supported in Simple Styling, found `{}` in SimpleStyleSheet `{}.{}` and `{}.{}`",
                css_key.from_case(Case::Kebab).to_case(Case::Camel),
                sheet_name_prev,
                style_key_prev,
                sheet_name,
                style_key
              )
            .as_str(),
          )
          .emit();
        })
      }
      css_key_to_sheet_name_and_style_key.insert(css_key.clone(), (sheet_name.into(), style_key.into()));
    });
  }

  fn visit_mut_style_object_usage(
    &mut self,
    expr: &mut Expr,
    css_key_to_sheet_name_and_style_key: &mut HashMap<String, (String, String)>,
  ) {
    let mut is_accepted_usage = false;

    // static style such as `styles.static`
    if let Some((sheet_name, style_key)) =
      self.get_sheet_name_and_style_key(expr, &mut is_accepted_usage)
    {
      let is_dynamic = self
        .sheet_style_to_is_dynamic
        .get(&sheet_name)
        .and_then(|fields| fields.get(&style_key))
        .unwrap_or(&false)
        .clone();

      if is_dynamic {
        return;
      }

      // static style such as `styles.static`
      if let Some(fields) = self.sheet_style_to_hash_set.get(&sheet_name) {
        if let Some(hashes) = fields.get(&style_key) {
          is_accepted_usage = true;
          let css_key_set = self.get_css_key_set(&sheet_name, &style_key);
          self.check_duplicate_css_key(
            expr.span(),
            &sheet_name,
            &style_key,
            &css_key_set,
            css_key_to_sheet_name_and_style_key,
          );
          *expr = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: hashes
              .iter()
              .map(|hash| {
                Some(ExprOrSpread {
                  spread: None,
                  expr: Expr::Lit(Lit::Str(quote_str!(*hash.clone()))).into(),
                })
              })
              .collect(),
          });
        }
      }
    }
    // conditional style using `&&`, such as `isActive && styles.active`
    else if let Expr::Bin(bin_expr) = expr {
      if let Some((sheet_name, style_key)) =
        self.get_sheet_name_and_style_key(&mut *bin_expr.right, &mut is_accepted_usage)
      {
        is_accepted_usage = true;

        let css_key_set = self.get_css_key_set(&sheet_name, &style_key);
        self.check_duplicate_css_key(
          expr.span(),
          &sheet_name,
          &style_key,
          &css_key_set,
          css_key_to_sheet_name_and_style_key,
        );

        *expr = quote!(
          "[$object]" as Expr,
          object: Expr = Expr::Object(self.get_init_object_lit(&css_key_set))
        )
      }
    }
    // conditional style using `?`, such as `isDisabled ? styles.disabled : styles.enabled`
    else if let Expr::Cond(cond_expr) = expr {
      if let Some((sheet_name_left, style_key_left)) =
        self.get_sheet_name_and_style_key(&mut *cond_expr.cons, &mut is_accepted_usage)
      {
        let css_key_set_left = self.get_css_key_set(&sheet_name_left, &style_key_left);
        self.check_duplicate_css_key(
          cond_expr.cons.span(),
          &sheet_name_left,
          &style_key_left,
          &css_key_set_left,
          css_key_to_sheet_name_and_style_key,
        );
        if let Some((sheet_name_right, style_key_right)) =
          self.get_sheet_name_and_style_key(&mut *cond_expr.alt, &mut is_accepted_usage)
        {
          let css_key_set_right = self.get_css_key_set(&sheet_name_right, &style_key_right);
          self.check_duplicate_css_key(
            cond_expr.alt.span(),
            &sheet_name_right,
            &style_key_right,
            &css_key_set_right,
            css_key_to_sheet_name_and_style_key,
          );
          let css_key_set = css_key_set_left
            .iter()
            .chain(&css_key_set_right)
            .cloned()
            .collect::<Vec<_>>();
          is_accepted_usage = true;
          *expr = quote!(
            "[$object]" as Expr,
            object: Expr = Expr::Object(self.get_init_object_lit(&css_key_set))
          )
        }
      }
    }
    // dynamic style, such as `styles.withColor(color)`
    else if let Expr::Call(call_expr) = expr {
      if let Callee::Expr(callee_expr) = &mut call_expr.callee {
        if let Some((sheet_name, style_key)) =
          self.get_sheet_name_and_style_key(callee_expr, &mut is_accepted_usage)
        {
          is_accepted_usage = true;
          let mut elements = vec![];
          let hash_set = self.get_hash_set(&sheet_name, &style_key);
          let css_key_set = self.get_css_key_set(&sheet_name, &style_key);
          self.check_duplicate_css_key(
            expr.span(),
            &sheet_name,
            &style_key,
            &css_key_set,
            css_key_to_sheet_name_and_style_key,
          );

          hash_set.iter().for_each(|hash| {
            elements.push(Some(ExprOrSpread {
              spread: None,
              expr: Expr::Lit(Lit::Str(quote_str!(hash.clone()))).into(),
            }));
          });

          elements.push(Some(ExprOrSpread {
            spread: None,
            expr: Expr::Object(self.get_init_object_lit(&css_key_set)).into(),
          }));

          *expr = Expr::Array(ArrayLit {
            span: DUMMY_SP,
            elems: elements,
          });
        }
      }
    }

    if !is_accepted_usage {
      HANDLER.with(|handler| {
        handler
          .struct_span_err(
            expr.span(),
            format!("The usage of SimpleStyleSheet is not supported, please check",).as_str(),
          )
          .emit()
      });
    }
  }
}

impl VisitMut for SimpleStylingVisitor {
  /**
   * Find the import of `SimpleStyleSheet` and remember it
   *
   * import { SimpleStyleSheet } from '@lynx-js/react'
   * will get simple_stylesheet_imported_exprs: {"SimpleStyleSheet"}
   *
   * import { SimpleStyleSheet as css } from '@lynx-js/react'
   * will get simple_stylesheet_imported_exprs: {"css"}
   */
  fn visit_mut_import_decl(&mut self, decl: &mut ImportDecl) {
    if self.cfg.runtime_pkg == decl.src.value.to_string() {
      for specifier in &decl.specifiers {
        if let ImportSpecifier::Named(named_specifier) = specifier {
          let original = named_specifier
            .imported
            .as_ref()
            .map(|i| match i {
              ModuleExportName::Ident(ident) => ident.sym.to_string(),
              ModuleExportName::Str(str) => str.value.to_string(),
            })
            .unwrap_or_else(|| named_specifier.local.sym.to_string());
          if original == "SimpleStyleSheet" {
            self
              .simple_stylesheet_imported_exprs
              .insert(Expr::Ident(named_specifier.local.clone()));
          }
        }
      }
    }
    decl.visit_mut_children_with(self);
  }
  /**
   * Allow add new statements via pushing to `inject_stmts`.
   * Allow remove current statement via setting `should_keep_current_stmt` to false.
   */
  fn visit_mut_stmts(&mut self, node: &mut Vec<Stmt>) {
    let mut new_stmts = vec![];

    for stmt in node.iter_mut() {
      self.inject_stmts = vec![];
      self.should_keep_current_stmt = true;

      stmt.visit_mut_children_with(self);

      if self.should_keep_current_stmt {
        new_stmts.push(stmt.clone());
      }
      new_stmts.extend(self.inject_stmts.drain(..));
    }

    *node = new_stmts;
  }

  /**
   * Save the current style sheet ident to `current_stylesheet_ident`
   *
   * input:
   *
   * ```js
   * import { SimpleStyleSheet } from '@lynx-dev/react'
   * const styles = SimpleStyleSheet.create({
   *   red: {
   *     color: 'red'
   *     textAlign: 'center',
   *   }
   * });
   * SimpleStyleSheet.use(styles.red);
   * ```
   *
   * will save `styles` to `current_stylesheet_ident`
   */
  fn visit_mut_var_decl(&mut self, decl: &mut VarDecl) {
    // Only support single style sheet declaration per `VarDecl`
    if decl.decls.len() == 1 {
      for decl in &mut decl.decls {
        if let Pat::Ident(ident) = &decl.name {
          self.current_stylesheet_ident = Some(ident.id.clone());
        }
        decl.visit_mut_children_with(self);
      }
    } else {
      decl.visit_mut_children_with(self);
    }
  }

  fn visit_mut_expr(&mut self, expr: &mut Expr) {
    expr.visit_mut_children_with(self);

    if let Expr::Call(call_expr) = expr {
      match &call_expr.callee {
        Callee::Expr(callee_expr) => {
          if let Expr::Member(expr_member) = &**callee_expr {
            if let Expr::Ident(obj_ident) = &*expr_member.obj {
              let is_simple_stylesheet = self.simple_stylesheet_imported_exprs.iter().any(|expr| {
                if let Expr::Ident(import_ident) = expr {
                  return import_ident.sym == obj_ident.sym;
                }
                false
              });
              if !is_simple_stylesheet {
                return;
              }
              if let MemberProp::Ident(prop_ident) = &expr_member.prop {
                let is_create = prop_ident.sym.as_str() == "create";
                if !is_create {
                  return;
                }

                if let Some(expr_new) = self.visit_mut_simple_stylesheet_create(call_expr) {
                  *expr = expr_new;
                }
              }
            }
          } else if let Expr::Ident(ident) = &**callee_expr {
            if ident.sym == "__DefineSimpleStyle" {
              if call_expr.args.len() >= 2 {
                let (first, rest) = call_expr.args.split_at_mut(1);
                let arg0 = &mut first[0];
                let (arg1, rest) = rest.split_at_mut(1);
                let arg1 = &mut arg1[0];
                let arg2 = &mut rest[0];

                if let Expr::Ident(si_ident) = &*arg0.expr {
                  if let Expr::Ident(element_ident) = &*arg1.expr {
                    if let Expr::Array(array_lit) = &mut *arg2.expr {
                      let mut css_key_to_sheet_name_and_style_key: HashMap<
                        String,
                        (String, String),
                      > = HashMap::new();

                      array_lit.elems.iter_mut().for_each(|elem| {
                        if let Some(ExprOrSpread { expr, .. }) = elem {
                          self.visit_mut_style_object_usage(
                            expr,
                            &mut css_key_to_sheet_name_and_style_key,
                          );
                        }
                      });

                      let mut static_hash_list = vec![];
                      let mut dynamic_object_list = vec![];

                      array_lit.elems.iter_mut().for_each(|elem| {
                        if let Some(ExprOrSpread { expr, .. }) = elem {
                          if let Expr::Array(array_lit) = &mut **expr {
                            array_lit.elems.iter_mut().for_each(|elem| {
                              if let Some(ExprOrSpread { expr, .. }) = elem {
                                if let Expr::Lit(Lit::Str(str)) = &mut **expr {
                                  static_hash_list.push(str.value.to_string());
                                } else if let Expr::Object(obj) = &mut **expr {
                                  dynamic_object_list.push(obj.clone());
                                }
                              }
                            });
                          }
                        }
                      });

                      let mut elements = vec![];
                      let mut style_objects_dynamic_init_array = vec![];
                      static_hash_list.iter().for_each(|hash| {
                        let (css_key, value) = self
                          .hash_to_css_key_value
                          .get(hash)
                          .unwrap_or(&(String::new(), String::new()))
                          .clone();
                        self.inject_stmts.push(
                          quote!("__SimpleStyleInject($hash, $css_key, $value)" as Stmt,
                            hash: Expr = Expr::Lit(
                              hash.as_str().into()
                            ).into(),
                            css_key: Expr = Expr::Lit(
                              css_key.as_str().into()
                            ).into(),
                            value: Expr = Expr::Lit(
                              value.as_str().into()
                            ).into(),
                          )
                          .into(),
                        );

                        elements.push(Some(ExprOrSpread {
                          spread: None,
                          expr: Expr::Lit(Lit::Str(quote_str!(hash.clone()))).into(),
                        }));
                      });
                      dynamic_object_list
                        .iter()
                        .enumerate()
                        .for_each(|(_idx, obj)| {
                          style_objects_dynamic_init_array.push(Some(ExprOrSpread {
                            spread: None,
                            expr: Expr::Object(obj.clone()).into(),
                          }));
                        });
                      // insert `[...snapshotInstance.__dy_styles]`
                      elements.push(Some(ExprOrSpread {
                        spread: Some(Span::default()),
                        expr: Box::new(quote!("$si.__dy_styles" as Expr, si = si_ident.clone(),)),
                      }));

                      array_lit.elems = elements;

                      // change to Simple Styling PAPIs
                      // mark expr as removed
                      self.should_keep_current_stmt = false;
                      self.inject_stmts.push(quote!(
                        "$si.__dy_init = $style_objects_dynamic_init_array"
                          as Stmt,
                        si = si_ident.clone(),
                        style_objects_dynamic_init_array: Expr = Expr::Array(ArrayLit {
                          span: DUMMY_SP,
                          elems: style_objects_dynamic_init_array,
                        })
                      ));
                      self.inject_stmts.push(quote!(
                        "$si.__dy_styles = $si.__dy_init.map(__CreateStyleObject)" as Stmt,
                        si = si_ident.clone(),
                      ));
                      self.inject_stmts.push(quote!(
                        "__SetStyleObject($el, $obj)" as Stmt,
                        el: Expr = Expr::Ident(element_ident.clone()),
                        obj: Expr = Expr::Array(array_lit.clone())
                      ));
                    }
                  }
                }
              }
            }
          }
        }
        _ => {}
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use crate::swc_plugin_simple_styling::{SimpleStylingVisitor, SimpleStylingVisitorConfig};
  use swc_core::common::Mark;
  use swc_core::ecma::transforms::base::hygiene::hygiene;
  use swc_core::ecma::transforms::base::resolver;
  use swc_core::{
    ecma::parser::EsSyntax, ecma::parser::Syntax, ecma::transforms::testing::test,
    ecma::visit::visit_mut_pass,
  };

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(SimpleStylingVisitor::new(SimpleStylingVisitorConfig {
        ..Default::default()
      })),
      hygiene()
    ),
    basic_simple_style,
    r#"
    import * as ReactLynx from "@lynx-js/react";
    import { SimpleStyleSheet } from '@lynx-js/react';
    const styles = SimpleStyleSheet.create({
        static1: {
            width: '100px',
            height: '100px'
        },
        static2: {
            backgroundColor: 'blue',
            color: 'green'
        },
        static3: {
            textAlign: 'center',
            display: 'flex'
        },
        conditional1: {
            borderBottomWidth: '1px',
            borderBottomColor: 'red',
            borderBottomStyle: 'solid'
        },
        conditional2: {
            borderTopWidth: '1px',
            borderTopColor: 'red',
            borderTopStyle: 'solid'
        },
        dynamic: (color, size)=>({
                borderLeftColor: color,
                borderLeftWidth: '1px',
                borderLeftStyle: 'solid',
                paddingTop: size
            })
    });
    const __snapshot_da39a_test_1 = ReactLynx.createSnapshot("__snapshot_da39a_test_1", function(snapshotInstance) {
        const pageId = ReactLynx.__pageId;
        const el = __CreateView(pageId);
        __DefineSimpleStyle(snapshotInstance, el, [
            styles.static1,
            styles.static2,
            styles.static3,
            condition1 && styles.conditional1,
            styles.dynamic(...dynamicStyleArgs),
            condition2 && styles.conditional2
        ]);
        return [
            el
        ];
    }, [
        function(ctx) {
            if (ctx.__elements) {
                ReactLynx.updateSimpleStyle(ctx, ctx.__values[0]);
            }
        }
    ], null, undefined, globDynamicComponentEntry);
    function ComponentWithSimpleStyle({ condition1, condition2, dynamicStyleArgs }) {
        return <__snapshot_da39a_test_1 values={[
            [
                condition1 && styles.conditional1,
                styles.dynamic(...dynamicStyleArgs),
                condition2 && styles.conditional2
            ]
        ]}/>;
    }

    "#
  );
}
