#![allow(clippy::boxed_local)]
use crate::extract_ident::ExtractingIdentsCollector;
use crate::worklet_type::WorkletType;
use crate::TransformMode;
use std::collections::HashSet;
use std::vec;
use swc_core::common::{EqIgnoreSpan, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::utils::private_ident;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut, VisitMutWith};
use swc_core::{quote, quote_expr};
use swc_plugins_shared::target::TransformTarget;

pub struct StmtGen {}

#[derive(Clone, Copy)]
enum CaptureRoot {
  Ident,
  ThisMember,
}

struct CaptureRootReplacer {
  source: Expr,
  replacement: Ident,
}

impl VisitMut for CaptureRootReplacer {
  noop_visit_mut_type!();

  fn visit_mut_expr(&mut self, expr: &mut Expr) {
    if expr.eq_ignore_span(&self.source) {
      *expr = Expr::Ident(self.replacement.clone());
      return;
    }
    expr.visit_mut_children_with(self);
  }
}

struct RegisterWorkletParams<'a> {
  mode: TransformMode,
  target: TransformTarget,
  worklet_type: WorkletType,
  function_name: Ident,
  function: Box<Function>,
  extracted_idents: Vec<Ident>,
  extracted_js_fns: Vec<(IdentName, Box<Expr>)>,
  hash: Expr,
  is_class_member: bool,
  named_imports: &'a mut HashSet<String>,
  worklet_runtime_loaded_ident: Ident,
}

impl StmtGen {
  #[allow(clippy::too_many_arguments)]
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
    worklet_runtime_loaded_ident: Ident,
    collect_main_thread: bool,
  ) -> (Box<Expr>, Stmt, Option<Stmt>) {
    let hash = Expr::Lit(hash.into());
    let mut extracted_value = ident_collector.take_values();
    let mut extracted_this_expr = ident_collector.take_this_expr();
    if StmtGen::wrap_main_thread_object_candidates(&mut extracted_value, CaptureRoot::Ident)
      | StmtGen::wrap_main_thread_object_candidates(
        &mut extracted_this_expr,
        CaptureRoot::ThisMember,
      )
    {
      named_imports.insert("captureMainThreadObject".into());
    }
    let extracted_idents = ident_collector.take_idents();
    let extracted_js_fns = ident_collector.take_js_fns();

    let main_thread_stmt = collect_main_thread.then(|| {
      let mut collected_imports = HashSet::new();
      StmtGen::gen_register_worklet_stmt(RegisterWorkletParams {
        mode,
        target: TransformTarget::LEPUS,
        worklet_type: worklet_type.clone(),
        function_name: function_name.clone(),
        function: function.clone(),
        extracted_idents: extracted_idents.clone(),
        extracted_js_fns: extracted_js_fns.clone(),
        hash: hash.clone(),
        is_class_member,
        named_imports: &mut collected_imports,
        worklet_runtime_loaded_ident: worklet_runtime_loaded_ident.clone(),
      })
    });

    (
      StmtGen::gen_transformed_worklet_expr(
        if target == TransformTarget::MIXED {
          TransformTarget::JS
        } else {
          target
        },
        extracted_value,
        extracted_this_expr,
        extracted_js_fns.clone(),
        hash.clone(),
        named_imports,
      ),
      StmtGen::gen_register_worklet_stmt(RegisterWorkletParams {
        mode,
        target: if target == TransformTarget::MIXED {
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
        worklet_runtime_loaded_ident,
      }),
      main_thread_stmt,
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

    let hash_name = "_wkltId";
    props.push(
      Prop::KeyValue(KeyValueProp {
        key: Ident::from(hash_name).into(),
        value: hash.into(),
      })
      .into(),
    );

    if !extracted_js_fns.is_empty() {
      let value: Box<Expr> = Expr::Object(ObjectLit {
        span: DUMMY_SP,
        props: extracted_js_fns
          .into_iter()
          .map(|(key, value)| {
            {
              match target {
                TransformTarget::LEPUS => Prop::KeyValue(KeyValueProp {
                  key: key.clone().into(),
                  value: quote_expr!("{_isFirstScreen: true}"),
                }),
                TransformTarget::JS | TransformTarget::MIXED => Prop::KeyValue(KeyValueProp {
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
          value,
        })
        .into(),
      );
    }

    let worklet_props = extracted_this_expr.expect_object().props;
    if !worklet_props.is_empty() {
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

  fn wrap_main_thread_object_candidates(
    extracted_value: &mut Box<Expr>,
    capture_root: CaptureRoot,
  ) -> bool {
    let mut wrapped = false;
    let Some(object) = extracted_value.as_mut_object() else {
      return false;
    };

    for prop in &mut object.props {
      let Some(prop) = prop.as_mut_prop() else {
        continue;
      };
      let Prop::KeyValue(key_value) = prop.as_mut() else {
        continue;
      };
      if !key_value.value.is_object() {
        continue;
      }
      let source = match capture_root {
        CaptureRoot::Ident => StmtGen::find_root_ident(&key_value.value).map(Expr::Ident),
        CaptureRoot::ThisMember => StmtGen::find_root_this_member(&key_value.value),
      };
      let Some(source) = source else {
        continue;
      };
      wrapped |= StmtGen::wrap_main_thread_object_candidate(&mut key_value.value, source);
    }

    wrapped
  }

  fn wrap_main_thread_object_candidate(value: &mut Box<Expr>, source: Expr) -> bool {
    let Some(object) = value.as_mut_object() else {
      return false;
    };

    for prop in &mut object.props {
      let Some(prop) = prop.as_mut_prop() else {
        continue;
      };
      let Prop::KeyValue(key_value) = prop.as_mut() else {
        continue;
      };
      if !key_value.value.is_object() {
        continue;
      }
      let child_source = StmtGen::append_member(source.clone(), &key_value.key);
      StmtGen::wrap_main_thread_object_candidate(&mut key_value.value, child_source);
    }

    let mut fallback = value.clone();
    let source_argument = source.clone();
    let capture_argument = if source.is_ident() {
      source
    } else {
      let capture_source = private_ident!("__mainThreadObjectSource");
      fallback.visit_mut_with(&mut CaptureRootReplacer {
        source,
        replacement: capture_source.clone(),
      });
      Expr::Ident(capture_source)
    };
    let captured = CallExpr {
      ctxt: Default::default(),
      span: DUMMY_SP,
      args: vec![capture_argument.clone().into()],
      callee: Callee::Expr(quote_expr!("captureMainThreadObject")),
      type_args: None,
    }
    .into();
    let captured_or_fallback: Expr = BinExpr {
      span: DUMMY_SP,
      op: BinaryOp::NullishCoalescing,
      left: captured,
      right: fallback,
    }
    .into();
    *value = if source_argument.is_ident() {
      captured_or_fallback.into()
    } else {
      CallExpr {
        ctxt: Default::default(),
        span: DUMMY_SP,
        callee: Callee::Expr(
          ArrowExpr {
            ctxt: Default::default(),
            span: DUMMY_SP,
            params: vec![Pat::Ident(capture_argument.expect_ident().into())],
            body: Box::new(BlockStmtOrExpr::Expr(captured_or_fallback.into())),
            is_async: false,
            is_generator: false,
            type_params: None,
            return_type: None,
          }
          .into(),
        ),
        args: vec![source_argument.into()],
        type_args: None,
      }
      .into()
    };
    true
  }

  fn append_member(source: Expr, property: &PropName) -> Expr {
    let property = match property {
      PropName::Ident(ident) => MemberProp::Ident(ident.clone()),
      PropName::Str(value) => MemberProp::Computed(ComputedPropName {
        span: DUMMY_SP,
        expr: Expr::Lit(Lit::Str(value.clone())).into(),
      }),
      PropName::Num(value) => MemberProp::Computed(ComputedPropName {
        span: DUMMY_SP,
        expr: Expr::Lit(Lit::Num(value.clone())).into(),
      }),
      PropName::BigInt(value) => MemberProp::Computed(ComputedPropName {
        span: DUMMY_SP,
        expr: Expr::Lit(Lit::BigInt(value.clone())).into(),
      }),
      PropName::Computed(value) => MemberProp::Computed(value.clone()),
    };
    MemberExpr {
      span: DUMMY_SP,
      obj: source.into(),
      prop: property,
    }
    .into()
  }

  fn find_root_ident(expr: &Expr) -> Option<Ident> {
    match expr {
      Expr::Ident(ident) => Some(ident.clone()),
      Expr::Member(member) => StmtGen::find_root_ident(&member.obj),
      Expr::Object(object) => object.props.iter().find_map(|prop| {
        let prop = prop.as_prop()?;
        match prop.as_ref() {
          Prop::Shorthand(ident) => Some(ident.clone()),
          Prop::KeyValue(key_value) => StmtGen::find_root_ident(&key_value.value),
          _ => None,
        }
      }),
      _ => None,
    }
  }

  fn find_root_this_member(expr: &Expr) -> Option<Expr> {
    match expr {
      Expr::Member(member) if member.obj.is_this() => Some(Expr::Member(member.clone())),
      Expr::Member(member) => StmtGen::find_root_this_member(&member.obj),
      Expr::Object(object) => object.props.iter().find_map(|prop| {
        let prop = prop.as_prop()?;
        match prop.as_ref() {
          Prop::KeyValue(key_value) => StmtGen::find_root_this_member(&key_value.value),
          _ => None,
        }
      }),
      _ => None,
    }
  }

  /*
   * registerWorklet($type, $hash, $function);
   */
  fn gen_register_worklet_stmt(params: RegisterWorkletParams) -> Stmt {
    let RegisterWorkletParams {
      mode,
      target,
      worklet_type,
      function_name,
      function,
      extracted_idents,
      extracted_js_fns,
      hash,
      is_class_member,
      named_imports,
      worklet_runtime_loaded_ident,
    } = params;

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
      quote!("$loaded && registerWorkletInternal($type_, $hash, $fn_)" as Stmt,
        loaded: Expr = Expr::Ident(worklet_runtime_loaded_ident.clone()),
        type_: Expr = Expr::Lit(worklet_type.type_str().into()),
        hash: Expr = hash,
        fn_: Expr = Expr::Fn(FnExpr {
              ident: None,
              function: function_to_register,
            }),
      )
    } else if mode == TransformMode::Development {
      named_imports.insert("registerWorkletOnBackground".into());
      quote!("registerWorkletOnBackground($type_, $hash, $fn_)" as Stmt,
        type_: Expr = Expr::Lit(worklet_type.type_str().into()),
        hash: Expr = hash,
        fn_: Expr = Expr::Fn(FnExpr {
              ident: None,
              function: function_to_register,
            }),
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
        Ident::new("_jsFn".into(), DUMMY_SP, Default::default()),
        fn_ids,
      ));
    }

    // let { y1, y2, y3, y4, y8, y5, y6, y7 } = this["_c"];
    if !extracted_idents.is_empty() {
      stmts.push(StmtGen::gen_destructure_stmt(
        Ident::new("_c".into(), DUMMY_SP, Default::default()),
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
