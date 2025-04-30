use crate::swc_plugin_worklet::extract_ident::ExtractingIdentsCollector;
use crate::swc_plugin_worklet::worklet_type::WorkletType;
use crate::target::TransformTarget;
use crate::TransformMode;
use std::collections::HashSet;
use std::vec;
use swc_core::common::DUMMY_SP;
use swc_core::ecma::ast::*;
use swc_core::{quote, quote_expr};

pub struct StmtGen {}

impl StmtGen {
  pub fn transform_worklet(
    mode: TransformMode,
    worklet_type: WorkletType,
    hash: String,
    target: TransformTarget,
    function_name: Ident,
    function: Box<Function>,
    ident_collector: &mut ExtractingIdentsCollector,
    is_class_member: bool,
    named_imports: &mut HashSet<String>,
  ) -> (Box<Expr>, Stmt) {
    let hash = Expr::Lit(hash.into());
    let extracted_value = ident_collector.take_values();
    let extracted_idents = ident_collector.take_idents();
    let extracted_js_fns = ident_collector.take_js_fns();

    (
      StmtGen::gen_transformed_worklet_expr(
        if target == TransformTarget::MIXED {
          TransformTarget::JS
        } else {
          target
        },
        extracted_value,
        ident_collector.take_this_expr(),
        extracted_js_fns.clone(),
        hash.clone(),
        named_imports,
      ),
      StmtGen::gen_register_worklet_stmt(
        mode,
        if target == TransformTarget::MIXED {
          TransformTarget::LEPUS
        } else {
          target
        },
        worklet_type,
        function_name,
        function,
        extracted_idents,
        extracted_js_fns,
        hash,
        is_class_member,
        named_imports,
      ),
    )
  }

  /*
   * { _c: $closure_obj, _wkltId: $hash, _jsFn: $js_fn_obj, ...$this_c_obj}
   */
  fn gen_transformed_worklet_expr(
    target: TransformTarget,
    extracted_value: Box<Expr>,
    extracted_this_expr: Box<Expr>,
    extracted_js_fns: Vec<(IdentName, Box<Expr>)>,
    hash: Expr,
    named_imports: &mut HashSet<String>,
  ) -> Box<Expr> {
    if target == TransformTarget::JS && !extracted_js_fns.is_empty() {
      named_imports.insert("transformToWorklet".into());
    }

    let mut props: Vec<PropOrSpread> = vec![];

    if !extracted_value.as_object().unwrap().props.is_empty() {
      props.push(
        Prop::KeyValue(KeyValueProp {
          key: Ident::from("_c").into(),
          value: extracted_value,
        })
        .into(),
      );
    }

    let hash_name = if target == TransformTarget::JS {
      "_wkltId"
    } else {
      "_lepusWorkletHash"
    };
    props.push(
      Prop::KeyValue(KeyValueProp {
        key: Ident::from(hash_name).into(),
        value: hash.into(),
      })
      .into(),
    );

    if target == TransformTarget::JS && !extracted_js_fns.is_empty() {
      let value: Box<Expr> = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: extracted_js_fns
          .into_iter()
          .map(|(key, value)| {
            {
              match target {
                TransformTarget::JS => Prop::KeyValue(KeyValueProp {
                  key: key.into(),
                  value: CallExpr {
                    ctxt: Default::default(),
                    span: DUMMY_SP,
                    args: vec![value.into()],
                    callee: Callee::Expr(quote_expr!("transformToWorklet")),
                    type_args: None,
                  }
                  .into(),
                }),
                _ => unreachable!(),
              }
            }
            .into()
          })
          .collect(),
      })
      .into();
      props.push(
        Prop::KeyValue(KeyValueProp {
          key: Ident::from("_jsFn").into(),
          value: value,
        })
        .into(),
      );
    }

    let worklet_props = extracted_this_expr.expect_object().props;
    if target == TransformTarget::JS && !worklet_props.is_empty() {
      props.push(
        SpreadElement {
          dot3_token: DUMMY_SP,
          expr: ObjectLit {
            span: DUMMY_SP,
            props: worklet_props,
          }
          .into(),
        }
        .into(),
      );
    }

    ObjectLit {
      span: DUMMY_SP,
      props,
    }
    .into()
  }

  /*
   * registerWorklet($type, $hash, $function);
   */
  fn gen_register_worklet_stmt(
    mode: TransformMode,
    target: TransformTarget,
    worklet_type: WorkletType,
    function_name: Ident,
    function: Box<Function>,
    extracted_idents: Vec<Ident>,
    extracted_js_fns: Vec<(IdentName, Box<Expr>)>,
    hash: Expr,
    is_class_member: bool,
    named_imports: &mut HashSet<String>,
  ) -> Stmt {
    let function_to_register = Box::new(StmtGen::gen_function_to_register(
      function,
      function_name,
      extracted_idents,
      extracted_js_fns,
      hash.clone(),
      is_class_member,
    ));

    if target == TransformTarget::LEPUS {
      named_imports.insert("loadWorkletRuntime".into());
      quote!("loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry) && registerWorkletInternal($type_, $hash, $fn_)" as Stmt,
        type_: Expr = Expr::Lit(worklet_type.type_str().into()).into(),
        hash: Expr = hash,
        fn_: Expr = Expr::Fn(FnExpr {
              ident: None,
              function: function_to_register,
            }).into(),
      )
    } else if mode == TransformMode::Development {
      named_imports.insert("registerWorkletOnBackground".into());
      quote!("registerWorkletOnBackground($type_, $hash, $fn_)" as Stmt,
        type_: Expr = Expr::Lit(worklet_type.type_str().into()).into(),
        hash: Expr = hash,
        fn_: Expr = Expr::Fn(FnExpr {
              ident: None,
              function: function_to_register,
            }).into(),
      )
    } else {
      EmptyStmt { span: DUMMY_SP }.into()
    }
  }

  fn gen_function_to_register(
    function: Box<Function>,
    function_name: Ident,
    extracted_idents: Vec<Ident>,
    extracted_js_fns: Vec<(IdentName, Box<Expr>)>,
    hash: Expr,
    is_class_member: bool,
  ) -> Function {
    let mut stmts = vec![];

    // const onTapElement = _workletMap["9c7ea991"].bind(this);
    if !function_name.is_dummy() {
      // allow the worklet to call itself recursively
      if is_class_member {
        stmts.push(quote!("this[$f] = lynxWorkletImpl._workletMap[$hash].bind(this)" as Stmt, f: Expr = Expr::Lit(Lit::Str(function_name.sym.into())), hash: Expr = hash));
      } else {
        stmts.push(quote!("const $f = lynxWorkletImpl._workletMap[$hash].bind(this)" as Stmt, f = function_name, hash: Expr = hash));
      }
    }

    // let { _jsFn1, _jsFn2 } = this._jsFn;
    if !extracted_js_fns.is_empty() {
      let fn_ids = extracted_js_fns
        .iter()
        .map(|(k, _)| Ident::from(k.clone()))
        .collect();
      stmts.push(StmtGen::gen_destructure_stmt(
        Ident::new("_jsFn".into(), DUMMY_SP, Default::default()).into(),
        fn_ids,
      ));
    }

    // let { y1, y2, y3, y4, y8, y5, y6, y7 } = this["_c"];
    if !extracted_idents.is_empty() {
      stmts.push(StmtGen::gen_destructure_stmt(
        Ident::new("_c".into(), DUMMY_SP, Default::default()).into(),
        extracted_idents,
      ));
    }

    stmts.append(&mut function.body.unwrap().stmts);

    Function {
      body: BlockStmt {
        ctxt: Default::default(),
        span: DUMMY_SP,
        stmts,
      }
      .into(),
      ..*function
    }
  }

  fn gen_destructure_stmt(obj_ident: Ident, extracted_idents: Vec<Ident>) -> Stmt {
    let mut s = HashSet::new();
    quote!("let $pat = this[$obj_ident]" as Stmt,
      obj_ident: Expr = Expr::Lit(Lit::Str(obj_ident.sym.into())),
      pat: Pat = Pat::Object(ObjectPat {
        span: DUMMY_SP,
        props: extracted_idents
          .into_iter()
          .filter_map(|ident| {
              if s.contains(&ident.sym) {
                None
              } else {
                s.insert(ident.sym.clone());
                Some(ObjectPatProp::Assign(AssignPatProp {
                  span: DUMMY_SP,
                  key: BindingIdent{ id: ident.clone(), type_ann: None },
                  value: None,
                }))
              }
            })
          .collect(),
        type_ann: None,
        optional: false,
      })
    )
  }
}
