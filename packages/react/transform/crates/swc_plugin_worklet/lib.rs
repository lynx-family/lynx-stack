mod decl_collect;
mod extract_ident;
mod gen_stmt;
mod globals;
mod hash;
mod shared_module;
mod worklet_type;

use extract_ident::{ExtractingIdentsCollector, ExtractingIdentsCollectorConfig};
use gen_stmt::StmtGen;
use hash::WorkletHash;
use rustc_hash::{FxHashMap, FxHashSet};
use serde::Deserialize;
use shared_module::{shared_module_id, SharedImportRef, SharedImportedName, SharedRefRewriter};
use std::collections::HashSet;
use std::vec;
use swc_core::common::util::take::Take;
use swc_core::common::{errors::HANDLER, Span, Spanned, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::utils::{prepend_stmts, private_ident};
use swc_core::ecma::visit::VisitMutWith;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut};
use swc_core::quote;
use worklet_type::WorkletType;

use swc_plugins_shared::{
  mts_defines::{
    collect_mts_define, MtsDefineKind, MtsDefinesCollector, MtsSharedImport,
    MtsSharedImportsCollector,
  },
  target::TransformTarget,
  transform_mode::TransformMode,
};

#[cfg(feature = "napi")]
pub mod napi;

#[derive(Deserialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkletVisitorConfig {
  /// @public
  /// During the compilation of worklet, when extracting external variable identifiers,
  /// global identifiers available in lepus context need to be ignored.
  /// In addition to the default lepus global identifier list provided by the compiler,
  /// users can customize the global identifier list through this option.
  /// This configuration will take effect together with the default lepus global identifier list.
  pub custom_global_ident_names: Option<Vec<String>>,
  /// @internal
  pub filename: String,
  /// @internal
  pub target: TransformTarget,
  pub runtime_pkg: String,
}

impl Default for WorkletVisitorConfig {
  fn default() -> Self {
    WorkletVisitorConfig {
      filename: "index.js".into(),
      target: TransformTarget::LEPUS,
      custom_global_ident_names: None,
      runtime_pkg: "NoDiff".into(),
    }
  }
}

pub struct WorkletVisitor {
  mode: TransformMode,
  content_hash: String,
  cfg: WorkletVisitorConfig,
  stmts_to_insert_at_top_level: Vec<Stmt>,
  named_imports: HashSet<String>,
  hasher: WorkletHash,
  shared_identifiers: FxHashSet<Id>,
  shared_import_refs: FxHashMap<Id, SharedImportRef>,
  worklet_runtime_loaded: bool,
  worklet_runtime_loaded_ident: Ident,
  mts_defs_collector: Option<MtsDefinesCollector>,
  shared_imports_collector: Option<MtsSharedImportsCollector>,
}

impl Default for WorkletVisitor {
  fn default() -> Self {
    WorkletVisitor::new(TransformMode::Production, WorkletVisitorConfig::default())
  }
}

impl VisitMut for WorkletVisitor {
  noop_visit_mut_type!();

  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    match n {
      ClassMember::Method(_) => {
        if n.as_method().unwrap().kind != MethodKind::Method {
          n.visit_mut_children_with(self);
          return;
        }

        let worklet_type = match n.as_mut_method().unwrap().function.body {
          None => None,
          Some(ref mut body) => self.check_is_worklet_block(body),
        };
        if worklet_type.is_none() {
          n.visit_mut_children_with(self);
          return;
        }

        let mut collector = ExtractingIdentsCollector::new(ExtractingIdentsCollectorConfig {
          custom_global_ident_names: self.cfg.custom_global_ident_names.clone(),
          shared_identifiers: Some(self.shared_identifiers.clone()),
        });
        n.visit_mut_with(&mut collector);

        let should_use_getter = self.cfg.target == TransformTarget::JS
          && !n.as_method().unwrap().is_static
          && (collector.has_extracted_this_props()
            || collector.has_extracted_values_props()
            || collector.has_extracted_js_fns());

        let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
        let collect_mts = self.mts_defs_collector.is_some();
        let collected_hash = collect_mts.then(|| hash.clone());
        let m = n.as_method().unwrap().clone();
        let original_function = m.function.clone();
        let (worklet_object_expr, register_worklet_stmt, main_thread_stmt) =
          StmtGen::transform_worklet(
            self.mode,
            worklet_type.unwrap(),
            hash,
            self.cfg.target,
            m.key
              .clone()
              .ident()
              .unwrap_or(Ident::dummy().into())
              .into(),
            m.function,
            &mut collector,
            true,
            &mut self.named_imports,
            self.worklet_runtime_loaded_ident.clone(),
            collect_mts,
          );

        // For JS worklets, the ctx object is later converted to a function by `transformWorklet(..)`
        // and invoked with `this` bound to the ctx object (not the component instance). Therefore,
        // extracted `this.xxx` values become snapshot-like values on the ctx.
        //
        // If we emit a class field initializer (`onTapLepus = { ... a: this.a }`), that snapshot is
        // computed once during construction, and `this.a` inside the worklet will keep reading the
        // old value from the ctx. To keep `this.xxx` in sync for class components, generate a
        // getter so the ctx object is re-created whenever `this.onTapLepus` is read (e.g. each
        // render).
        if should_use_getter {
          let mut getter_fn = (*original_function).clone();
          getter_fn.params = vec![];
          getter_fn.is_async = false;
          getter_fn.is_generator = false;
          getter_fn.type_params = None;
          getter_fn.return_type = None;
          getter_fn.body = Some(BlockStmt {
            ctxt: Default::default(),
            span: DUMMY_SP,
            stmts: vec![ReturnStmt {
              span: DUMMY_SP,
              arg: Some(worklet_object_expr),
            }
            .into()],
          });

          *n = ClassMethod {
            span: m.span,
            key: m.key,
            function: getter_fn.into(),
            kind: MethodKind::Getter,
            is_static: false,
            accessibility: m.accessibility,
            is_abstract: m.is_abstract,
            is_optional: m.is_optional,
            is_override: m.is_override,
          }
          .into();
        } else {
          *n = ClassProp {
            span: m.span,
            key: m.key,
            value: worklet_object_expr.into(),
            declare: false,
            is_abstract: m.is_abstract,
            decorators: vec![],
            definite: false,
            type_ann: None,
            is_static: m.is_static,
            accessibility: m.accessibility,
            is_optional: m.is_optional,
            is_override: m.is_override,
            readonly: false,
          }
          .into();
        }
        self.collect_worklet_define(collected_hash, main_thread_stmt);
        self
          .stmts_to_insert_at_top_level
          .push(register_worklet_stmt);
      }
      ClassMember::ClassProp(p) => {
        if self.cfg.target != TransformTarget::JS || p.is_static || p.value.is_none() {
          n.visit_mut_children_with(self);
          return;
        }

        let value = p.value.as_mut().unwrap();
        let worklet_type: Option<WorkletType> = match value.as_mut() {
          Expr::Arrow(arrow) if arrow.body.is_block_stmt() => {
            self.check_is_worklet_block(arrow.body.as_mut_block_stmt().unwrap())
          }
          Expr::Fn(FnExpr { function, .. }) if function.body.is_some() => {
            self.check_is_worklet_block(function.body.as_mut().unwrap())
          }
          _ => None,
        };

        if worklet_type.is_none() {
          n.visit_mut_children_with(self);
          return;
        }

        let mut collector = ExtractingIdentsCollector::new(ExtractingIdentsCollectorConfig {
          custom_global_ident_names: self.cfg.custom_global_ident_names.clone(),
          shared_identifiers: Some(self.shared_identifiers.clone()),
        });
        value.visit_mut_with(&mut collector);

        let function: Box<Function> = match value.as_ref() {
          Expr::Arrow(arrow) if arrow.body.is_block_stmt() => Box::new(Function {
            ctxt: arrow.ctxt,
            body: arrow.body.as_block_stmt().unwrap().clone().into(),
            span: arrow.span,
            return_type: arrow.return_type.clone(),
            is_async: arrow.is_async,
            is_generator: arrow.is_generator,
            type_params: arrow.type_params.clone(),
            decorators: vec![],
            params: arrow.params.iter().cloned().map(|p| p.into()).collect(),
          }),
          Expr::Fn(FnExpr { function, .. }) => function.clone(),
          _ => unreachable!("worklet_type was checked to be a class property function"),
        };

        let should_use_getter = collector.has_extracted_this_props()
          || collector.has_extracted_values_props()
          || collector.has_extracted_js_fns();

        let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
        let collect_mts = self.mts_defs_collector.is_some();
        let collected_hash = collect_mts.then(|| hash.clone());
        let (worklet_object_expr, register_worklet_stmt, main_thread_stmt) =
          StmtGen::transform_worklet(
            self.mode,
            worklet_type.unwrap(),
            hash,
            self.cfg.target,
            p.key
              .clone()
              .ident()
              .unwrap_or(Ident::dummy().into())
              .into(),
            function,
            &mut collector,
            true,
            &mut self.named_imports,
            self.worklet_runtime_loaded_ident.clone(),
            collect_mts,
          );

        if should_use_getter {
          let getter_fn: Function = Function {
            ctxt: Default::default(),
            span: DUMMY_SP,
            params: vec![],
            decorators: vec![],
            body: Some(BlockStmt {
              ctxt: Default::default(),
              span: DUMMY_SP,
              stmts: vec![ReturnStmt {
                span: DUMMY_SP,
                arg: Some(worklet_object_expr),
              }
              .into()],
            }),
            is_generator: false,
            is_async: false,
            type_params: None,
            return_type: None,
          };

          *n = ClassMethod {
            span: p.span,
            key: p.key.clone(),
            function: getter_fn.into(),
            kind: MethodKind::Getter,
            is_static: false,
            accessibility: p.accessibility,
            is_abstract: p.is_abstract,
            is_optional: p.is_optional,
            is_override: p.is_override,
          }
          .into();
        } else {
          p.value = Some(worklet_object_expr);
        }

        self.collect_worklet_define(collected_hash, main_thread_stmt);
        self
          .stmts_to_insert_at_top_level
          .push(register_worklet_stmt);
      }
      _ => {
        n.visit_mut_children_with(self);
      }
    }
  }

  fn visit_mut_decl(&mut self, n: &mut Decl) {
    if !n.is_fn_decl() {
      n.visit_mut_children_with(self);
      return;
    }
    let worklet_type = match n.as_mut_fn_decl().unwrap().function.body {
      None => None,
      Some(ref mut body) => self.check_is_worklet_block(body),
    };
    if worklet_type.is_none() {
      n.visit_mut_children_with(self);
      return;
    }

    let mut collector = ExtractingIdentsCollector::new(ExtractingIdentsCollectorConfig {
      custom_global_ident_names: self.cfg.custom_global_ident_names.clone(),
      shared_identifiers: Some(self.shared_identifiers.clone()),
    });
    n.visit_mut_with(&mut collector);

    let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
    let collect_mts = self.mts_defs_collector.is_some();
    let collected_hash = collect_mts.then(|| hash.clone());
    let (worklet_object_expr, register_worklet_stmt, main_thread_stmt) = StmtGen::transform_worklet(
      self.mode,
      worklet_type.unwrap(),
      hash,
      self.cfg.target,
      n.as_fn_decl().unwrap().ident.clone(),
      n.as_fn_decl().unwrap().function.clone(),
      &mut collector,
      false,
      &mut self.named_imports,
      self.worklet_runtime_loaded_ident.clone(),
      collect_mts,
    );

    *n = VarDecl {
      ctxt: n.as_fn_decl().unwrap().ident.ctxt,
      span: n.as_fn_decl().unwrap().ident.span,
      kind: VarDeclKind::Let,
      declare: false,
      decls: vec![VarDeclarator {
        span: n.as_fn_decl().unwrap().ident.span,
        definite: false,
        name: n.as_fn_decl().unwrap().ident.clone().into(),
        init: worklet_object_expr.into(),
      }],
    }
    .into();
    self.collect_worklet_define(collected_hash, main_thread_stmt);
    self
      .stmts_to_insert_at_top_level
      .push(register_worklet_stmt);
  }

  fn visit_mut_expr(&mut self, n: &mut Expr) {
    match n {
      Expr::Arrow(ArrowExpr { body, .. }) if body.is_block_stmt() => {
        let worklet_type =
          self.check_is_worklet_block(n.as_mut_arrow().unwrap().body.as_mut_block_stmt().unwrap());
        if worklet_type.is_none() {
          n.visit_mut_children_with(self);
          return;
        }

        let mut collector = ExtractingIdentsCollector::new(ExtractingIdentsCollectorConfig {
          custom_global_ident_names: self.cfg.custom_global_ident_names.clone(),
          shared_identifiers: Some(self.shared_identifiers.clone()),
        });
        n.visit_mut_with(&mut collector);

        let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
        let collect_mts = self.mts_defs_collector.is_some();
        let collected_hash = collect_mts.then(|| hash.clone());
        let (worklet_object_expr, register_worklet_stmt, main_thread_stmt) =
          StmtGen::transform_worklet(
            self.mode,
            worklet_type.unwrap(),
            hash,
            self.cfg.target,
            Ident::dummy(),
            Box::new(Function {
              ctxt: n.as_mut_arrow().unwrap().ctxt,
              body: n
                .as_mut_arrow()
                .unwrap()
                .body
                .as_block_stmt()
                .unwrap()
                .clone()
                .into(),
              span: n.as_mut_arrow().unwrap().span,
              return_type: n.as_mut_arrow().unwrap().return_type.clone(),
              is_async: n.as_mut_arrow().unwrap().is_async,
              is_generator: n.as_mut_arrow().unwrap().is_generator,
              type_params: n.as_mut_arrow().unwrap().type_params.clone(),
              decorators: vec![],
              params: n
                .as_mut_arrow()
                .unwrap()
                .params
                .iter()
                .map(|p| p.clone().into())
                .collect(),
            }),
            &mut collector,
            false,
            &mut self.named_imports,
            self.worklet_runtime_loaded_ident.clone(),
            collect_mts,
          );

        *n = *worklet_object_expr;
        self.collect_worklet_define(collected_hash, main_thread_stmt);
        self
          .stmts_to_insert_at_top_level
          .push(register_worklet_stmt);
      }
      Expr::Fn(_) if n.as_fn_expr().unwrap().function.body.is_some() => {
        let worklet_type =
          self.check_is_worklet_block(n.as_mut_fn_expr().unwrap().function.body.as_mut().unwrap());
        if worklet_type.is_none() {
          n.visit_mut_children_with(self);
          return;
        }

        let mut collector = ExtractingIdentsCollector::new(ExtractingIdentsCollectorConfig {
          custom_global_ident_names: self.cfg.custom_global_ident_names.clone(),
          shared_identifiers: Some(self.shared_identifiers.clone()),
        });
        n.visit_mut_with(&mut collector);

        let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
        let collect_mts = self.mts_defs_collector.is_some();
        let collected_hash = collect_mts.then(|| hash.clone());
        let (worklet_object_expr, register_worklet_stmt, main_thread_stmt) =
          StmtGen::transform_worklet(
            self.mode,
            worklet_type.unwrap(),
            hash,
            self.cfg.target,
            Ident::dummy(),
            n.as_mut_fn_expr().unwrap().function.take(),
            &mut collector,
            false,
            &mut self.named_imports,
            self.worklet_runtime_loaded_ident.clone(),
            collect_mts,
          );

        *n = *worklet_object_expr;
        self.collect_worklet_define(collected_hash, main_thread_stmt);
        self
          .stmts_to_insert_at_top_level
          .push(register_worklet_stmt);
      }
      _ => {
        n.visit_mut_children_with(self);
      }
    }
  }

  fn visit_mut_module_decl(&mut self, n: &mut ModuleDecl) {
    if !matches!(
      n,
      ModuleDecl::ExportDefaultDecl(ExportDefaultDecl {
        decl: DefaultDecl::Fn(_),
        ..
      })
    ) || n
      .as_export_default_decl()
      .unwrap()
      .decl
      .as_fn_expr()
      .unwrap()
      .function
      .body
      .is_none()
    {
      n.visit_mut_children_with(self);
      return;
    }

    let worklet_type = self.check_is_worklet_block(
      n.as_mut_export_default_decl()
        .unwrap()
        .decl
        .as_mut_fn_expr()
        .unwrap()
        .function
        .body
        .as_mut()
        .unwrap(),
    );
    if worklet_type.is_none() {
      n.visit_mut_children_with(self);
      return;
    }

    let mut collector = ExtractingIdentsCollector::new(ExtractingIdentsCollectorConfig {
      custom_global_ident_names: self.cfg.custom_global_ident_names.clone(),
      shared_identifiers: Some(self.shared_identifiers.clone()),
    });
    n.as_mut_export_default_decl()
      .unwrap()
      .decl
      .as_mut_fn_expr()
      .unwrap()
      .visit_mut_with(&mut collector);

    let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
    let collect_mts = self.mts_defs_collector.is_some();
    let collected_hash = collect_mts.then(|| hash.clone());
    let (worklet_object_expr, register_worklet_stmt, main_thread_stmt) = StmtGen::transform_worklet(
      self.mode,
      worklet_type.unwrap(),
      hash,
      self.cfg.target,
      Ident::dummy(),
      n.as_mut_export_default_decl()
        .unwrap()
        .decl
        .as_mut_fn_expr()
        .unwrap()
        .function
        .take(),
      &mut collector,
      false,
      &mut self.named_imports,
      self.worklet_runtime_loaded_ident.clone(),
      collect_mts,
    );

    *n = ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
      span: n.span(),
      expr: worklet_object_expr,
    });
    self.collect_worklet_define(collected_hash, main_thread_stmt);
    self
      .stmts_to_insert_at_top_level
      .push(register_worklet_stmt);
  }

  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    n.visit_mut_children_with(self);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    // First process imports to detect shared-runtime modules
    for item in &n.body {
      if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = item {
        if is_shared_runtime_import(import_decl) {
          let request = import_decl.src.value.to_string_lossy().into_owned();
          let module_id = shared_module_id(&self.cfg.filename, &request);
          let mut add = |local: &Ident, imported: SharedImportedName| {
            self.shared_identifiers.insert(local.to_id());
            self.shared_import_refs.insert(
              local.to_id(),
              SharedImportRef {
                module_id: module_id.clone(),
                request: request.clone(),
                imported,
              },
            );
          };
          for specifier in &import_decl.specifiers {
            match specifier {
              ImportSpecifier::Named(named) => {
                let imported = match &named.imported {
                  Some(ModuleExportName::Ident(ident)) => {
                    SharedImportedName::Named(ident.sym.clone())
                  }
                  Some(ModuleExportName::Str(s)) => {
                    SharedImportedName::NamedStr(s.value.to_string_lossy().into_owned())
                  }
                  None => SharedImportedName::Named(named.local.sym.clone()),
                  #[cfg(swc_ast_unknown)]
                  _ => panic!("unknown node"),
                };
                add(&named.local, imported);
              }
              ImportSpecifier::Default(default) => {
                add(&default.local, SharedImportedName::Default);
              }
              ImportSpecifier::Namespace(ns) => {
                add(&ns.local, SharedImportedName::Namespace);
              }
              #[cfg(swc_ast_unknown)]
              _ => panic!("unknown node"),
            }
          }
        }
      }
    }

    n.visit_mut_children_with(self);

    // Add global loadWorkletRuntime call if needed
    if self.named_imports.contains("loadWorkletRuntime") && !self.worklet_runtime_loaded {
      self.stmts_to_insert_at_top_level.insert(
        0,
        quote!("const $loaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry)" as Stmt, loaded = self.worklet_runtime_loaded_ident.clone()),
      );
      self.worklet_runtime_loaded = true;
    }

    let mut specifiers = self.named_imports.iter().collect::<Vec<_>>();

    if !specifiers.is_empty() {
      // Sort to keep the output consistent
      specifiers.sort();

      prepend_stmts(
        &mut n.body,
        vec![
          ModuleItem::ModuleDecl(ModuleDecl::Import(ImportDecl {
            span: DUMMY_SP,
            phase: ImportPhase::Evaluation,
            specifiers: specifiers
              .iter()
              .map(|imported| {
                ImportSpecifier::Named(ImportNamedSpecifier {
                  span: DUMMY_SP,
                  is_type_only: false,
                  local: Ident {
                    ctxt: Default::default(),
                    span: DUMMY_SP,
                    sym: format!("__{imported}").into(),
                    optional: false,
                  },
                  imported: Some(ModuleExportName::Ident(Ident {
                    ctxt: Default::default(),
                    span: DUMMY_SP,
                    sym: imported.as_str().into(),
                    optional: false,
                  })),
                })
              })
              .collect::<Vec<_>>(),
            src: Box::new(Str {
              span: DUMMY_SP,
              raw: None,
              value: self.cfg.runtime_pkg.clone().into(),
            }),
            type_only: Default::default(),
            with: Default::default(),
          })),
          ModuleItem::Stmt(Stmt::Decl(Decl::Var(Box::new(VarDecl {
            ctxt: Default::default(),
            span: DUMMY_SP,
            kind: VarDeclKind::Var,
            declare: false,
            decls: specifiers
              .into_iter()
              .map(|name| VarDeclarator {
                span: DUMMY_SP,
                name: Pat::Ident(
                  Ident {
                    ctxt: Default::default(),
                    span: DUMMY_SP,
                    sym: name.as_str().into(),
                    optional: false,
                  }
                  .into(),
                ),
                init: Some(Box::new(Expr::Ident(Ident {
                  ctxt: Default::default(),
                  span: DUMMY_SP,
                  sym: format!("__{name}").into(),
                  optional: false,
                }))),
                definite: false,
              })
              .collect(),
          })))),
        ]
        .into_iter(),
      );
    }
    // Add statements to insert at top level after processing all items
    n.body.extend(
      self
        .stmts_to_insert_at_top_level
        .iter_mut()
        .filter(|stmt| !stmt.is_empty())
        .map(|stmt| stmt.take().into()),
    );
  }
}

/// Digs the registered worklet function out of a collected define statement,
/// whose shape is fixed by `gen_register_worklet_stmt`:
/// `$loaded && registerWorkletInternal($type, $hash, function () { ... })`.
fn find_registered_function(stmt: &mut Stmt) -> Option<&mut Function> {
  let fn_expr = stmt
    .as_mut_expr()?
    .expr
    .as_mut_bin()?
    .right
    .as_mut_call()?
    .args
    .get_mut(2)?
    .expr
    .as_mut_fn_expr()?;
  Some(&mut fn_expr.function)
}

const INVALID_RUNTIME_MSG: &str = "Invalid runtime value. Only 'shared' is supported.";

fn emit_invalid_runtime_error(span: Span) {
  HANDLER.with(|handler| {
    handler.struct_span_err(span, INVALID_RUNTIME_MSG).emit();
  });
}

fn validate_runtime_value(expr: &Expr) -> bool {
  match expr {
    Expr::Lit(Lit::Str(value)) => {
      if value.value == "shared" {
        true
      } else {
        emit_invalid_runtime_error(value.span);
        false
      }
    }
    _ => {
      emit_invalid_runtime_error(expr.span());
      false
    }
  }
}

fn is_shared_runtime_import(import_decl: &ImportDecl) -> bool {
  if let Some(with_clause) = &import_decl.with {
    // Check if the with clause contains runtime: "shared"
    for prop in &with_clause.props {
      if let PropOrSpread::Prop(prop) = prop {
        if let Prop::KeyValue(kv) = &**prop {
          match &kv.key {
            PropName::Ident(key) if key.sym == "runtime" => {
              return validate_runtime_value(&kv.value);
            }
            PropName::Str(s) if s.value == "runtime" => {
              return validate_runtime_value(&kv.value);
            }
            _ => {}
          }
        }
      }
    }
  }
  false
}

impl WorkletVisitor {
  pub fn with_content_hash(mut self, content_hash: String) -> Self {
    self.content_hash = content_hash;
    self
  }

  pub fn new(mode: TransformMode, cfg: WorkletVisitorConfig) -> Self {
    WorkletVisitor {
      mode,
      content_hash: "test".into(),
      cfg,
      stmts_to_insert_at_top_level: vec![],
      hasher: WorkletHash::new(),
      named_imports: HashSet::default(),
      shared_identifiers: FxHashSet::default(),
      shared_import_refs: FxHashMap::default(),
      worklet_runtime_loaded: false,
      worklet_runtime_loaded_ident: private_ident!("__workletRuntimeLoaded"),
      mts_defs_collector: None,
      shared_imports_collector: None,
    }
  }

  pub fn with_mts_defs_collector(mut self, collector: MtsDefinesCollector) -> Self {
    self.mts_defs_collector = Some(collector);
    self
  }

  pub fn with_shared_imports_collector(mut self, collector: MtsSharedImportsCollector) -> Self {
    self.shared_imports_collector = Some(collector);
    self
  }

  fn collect_worklet_define(&mut self, hash: Option<String>, stmt: Option<Stmt>) {
    let (Some(hash), Some(mut stmt)) = (hash, stmt) else {
      return;
    };
    self.rewrite_shared_refs_in_define(&mut stmt);
    let guard = quote!(
      "const $loaded = loadWorkletRuntime(typeof globDynamicComponentEntry === 'undefined' ? undefined : globDynamicComponentEntry)" as Stmt,
      loaded = self.worklet_runtime_loaded_ident.clone(),
    );
    collect_mts_define(
      &self.mts_defs_collector,
      MtsDefineKind::Worklet,
      hash,
      vec![ModuleItem::Stmt(guard), ModuleItem::Stmt(stmt)],
    );
  }

  /// A collected define is assembled into a main-thread chunk detached from
  /// any module graph, so a `runtime: 'shared'` local has no import statement
  /// to bind to there. Rewrite those references to lookups of the runtime's
  /// shared-module registry, and report the shared modules the define uses so
  /// the bundler can compile them into the main-thread layer and register
  /// them.
  fn rewrite_shared_refs_in_define(&mut self, stmt: &mut Stmt) {
    if self.shared_import_refs.is_empty() {
      return;
    }
    let Some(function) = find_registered_function(stmt) else {
      return;
    };
    let used = SharedRefRewriter::rewrite_function(&self.shared_import_refs, function);
    if let Some(collector) = &self.shared_imports_collector {
      let mut collector = collector.borrow_mut();
      for u in used {
        if !collector.iter().any(|s| s.id == u.module_id) {
          collector.push(MtsSharedImport {
            id: u.module_id,
            request: u.request,
          });
        }
      }
    }
  }

  fn check_is_worklet_block(&self, n: &mut BlockStmt) -> Option<WorkletType> {
    let BlockStmt { stmts, .. } = n;
    if !stmts.is_empty() {
      match &mut stmts[0] {
        Stmt::Expr(ExprStmt { expr, span: _ }) => match &mut **expr {
          Expr::Lit(Lit::Str(str)) => {
            WorkletType::from_directive(str.value.to_string_lossy().into_owned())
          }
          _ => None,
        },
        _ => None,
      }
    } else {
      None
    }
  }
}

#[cfg(test)]
mod tests {
  use crate::{TransformMode, TransformTarget, WorkletVisitor, WorkletVisitorConfig};
  use swc_core::common::Mark;
  use swc_core::ecma::parser::TsSyntax;
  use swc_core::ecma::transforms::base::hygiene::hygiene;
  use swc_core::ecma::transforms::base::resolver;
  use swc_core::{
    ecma::parser::Syntax,
    ecma::visit::visit_mut_pass,
    ecma::{parser::EsSyntax, transforms::testing::test},
  };

  use std::{cell::RefCell, rc::Rc};

  use swc_core::ecma::transforms::testing::Tester;
  use swc_plugins_shared::mts_defines::{MtsDefinesCollector, MtsSharedImportsCollector};

  #[test]
  fn should_rewrite_shared_refs_in_collected_defines() {
    Tester::run(|tester| {
      let collector: MtsDefinesCollector = Rc::new(RefCell::new(vec![]));
      let shared_collector: MtsSharedImportsCollector = Rc::new(RefCell::new(vec![]));

      tester.apply_transform(
        (
          resolver(Mark::new(), Mark::new(), true),
          visit_mut_pass(
            WorkletVisitor::new(
              TransformMode::Test,
              WorkletVisitorConfig {
                filename: "index.js".into(),
                target: TransformTarget::JS,
                custom_global_ident_names: None,
                runtime_pkg: "@lynx-js/react".into(),
              },
            )
            .with_mts_defs_collector(collector.clone())
            .with_shared_imports_collector(shared_collector.clone()),
          ),
        ),
        "input.js",
        Syntax::Typescript(TsSyntax {
          ..Default::default()
        }),
        Some(true),
        r#"
import { spring } from './physics.js' with { runtime: "shared" };
import { unused } from './unused.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log(spring(e));
}
    "#,
      )?;

      let shared = shared_collector.borrow();
      assert_eq!(shared.len(), 1);
      assert_eq!(shared[0].request, "./physics.js");

      let defines = collector.borrow();
      assert_eq!(defines.len(), 1);
      let collected = format!("{:?}", defines[0].items);
      assert!(collected.contains("getSharedModule"));
      assert!(collected.contains(&shared[0].id));
      assert!(collected.contains("spring"));

      Ok(())
    });
  }

  /// Runs the worklet transform over `source` in collecting mode and hands the
  /// reported shared imports and the debug-rendered defines to `assertions`.
  fn collect_shared_defines(
    source: &'static str,
    assertions: impl FnOnce(&[swc_plugins_shared::mts_defines::MtsSharedImport], &str),
  ) {
    Tester::run(|tester| {
      let collector: MtsDefinesCollector = Rc::new(RefCell::new(vec![]));
      let shared_collector: MtsSharedImportsCollector = Rc::new(RefCell::new(vec![]));

      tester.apply_transform(
        (
          resolver(Mark::new(), Mark::new(), true),
          visit_mut_pass(
            WorkletVisitor::new(
              TransformMode::Test,
              WorkletVisitorConfig {
                filename: "index.js".into(),
                target: TransformTarget::JS,
                custom_global_ident_names: None,
                runtime_pkg: "@lynx-js/react".into(),
              },
            )
            .with_mts_defs_collector(collector.clone())
            .with_shared_imports_collector(shared_collector.clone()),
          ),
        ),
        "input.js",
        Syntax::Typescript(TsSyntax {
          ..Default::default()
        }),
        Some(true),
        source,
      )?;

      let defines = collector.borrow();
      let rendered = defines
        .iter()
        .map(|d| format!("{:?}", d.items))
        .collect::<Vec<_>>()
        .join("\n");
      assertions(&shared_collector.borrow(), &rendered);

      Ok(())
    });
  }

  #[test]
  fn should_rewrite_a_default_shared_import_through_the_default_property() {
    collect_shared_defines(
      r#"
import physics from './physics.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log(physics(e));
}
      "#,
      |shared, defines| {
        assert_eq!(shared.len(), 1);
        assert!(defines.contains("getSharedModule"));
        assert!(defines.contains(&shared[0].id));
        // A default import is the namespace's `default` binding.
        assert!(defines.contains("default"), "defines were: {defines}");
      },
    );
  }

  #[test]
  fn should_rewrite_a_namespace_shared_import_to_the_cached_namespace() {
    collect_shared_defines(
      r#"
import * as physics from './physics.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log(physics.spring(e));
}
      "#,
      |shared, defines| {
        assert_eq!(shared.len(), 1);
        assert!(defines.contains("getSharedModule"));
        assert!(defines.contains(&shared[0].id));
        assert!(defines.contains("spring"), "defines were: {defines}");
      },
    );
  }

  #[test]
  fn should_rewrite_a_string_named_shared_import_through_computed_access() {
    collect_shared_defines(
      r#"
import { "with-dash" as dashed } from './physics.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log(dashed(e));
}
      "#,
      |shared, defines| {
        assert_eq!(shared.len(), 1);
        assert!(defines.contains("getSharedModule"));
        // Not a valid identifier, so it must survive as a computed string key
        // rather than being emitted as `ns.with-dash`.
        assert!(defines.contains("with-dash"), "defines were: {defines}");
      },
    );
  }

  #[test]
  fn should_rewrite_a_shared_import_used_as_an_object_shorthand() {
    collect_shared_defines(
      r#"
import { spring } from './physics.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log({ spring });
}
      "#,
      |shared, defines| {
        assert_eq!(shared.len(), 1);
        assert!(defines.contains("getSharedModule"));
        assert!(defines.contains(&shared[0].id));
        // `{ spring }` cannot stay shorthand once the value becomes a lookup.
        assert!(defines.contains("spring"), "defines were: {defines}");
      },
    );
  }

  #[test]
  fn should_cache_one_module_once_however_many_bindings_it_provides() {
    collect_shared_defines(
      r#"
import { spring, damp } from './physics.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log(spring(e), damp(e));
}
      "#,
      |shared, defines| {
        // Two bindings, one module — so one reported import and one lookup.
        assert_eq!(shared.len(), 1);
        assert_eq!(shared[0].request, "./physics.js");
        assert_eq!(
          defines.matches("getSharedModule").count(),
          1,
          "the module should be looked up once per invocation, not once per binding: {defines}"
        );
      },
    );
  }

  #[test]
  fn should_report_each_distinct_shared_module_separately() {
    collect_shared_defines(
      r#"
import { spring } from './physics.js' with { runtime: "shared" };
import { accent } from './palette.js' with { runtime: "shared" };

function worklet(e) {
    "main thread";
    console.log(spring(e), accent);
}
      "#,
      |shared, defines| {
        assert_eq!(shared.len(), 2);
        let mut requests = shared
          .iter()
          .map(|s| s.request.as_str())
          .collect::<Vec<_>>();
        requests.sort_unstable();
        assert_eq!(requests, vec!["./palette.js", "./physics.js"]);
        // Distinct modules get distinct registry keys and distinct lookups.
        assert_ne!(shared[0].id, shared[1].id);
        assert_eq!(defines.matches("getSharedModule").count(), 2);
      },
    );
  }

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_lepus_general,
    r#"
function worklet(event: Event) {
    "main thread";
    console.log(y1);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_lepus_alias,
    r#"
function worklet(event: Event) {
    "main-thread";
    console.log(y1);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::MIXED,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_lepus_general_mixed,
    r#"
function worklet(event: Event) {
    "main thread";
    console.log(y1);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_js_general,
    r#"
function worklet(event: Event) {
    "main thread";
    console.log(y1);
    console.log(this.y1);
    let a: object = y1;
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_lepus,
    r#"
function X(event) {
    "main thread";
    console.log(y1[y2 + 1]);
    if (
      {
        x: 345,
      }.x.value
    ) {
      console.log(y3);
    }
    let a = y4;
    const { b, c = y8 } = y5;
    a, b, c;
    y6.m = y7;
    function xxx() {}
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_js,
    r#"
function X(event) {
    "main thread";
    console.log(y1[y2 + 1]);
    if (
      {
        x: 345,
      }.x.value
    ) {
      console.log(y3);
    }
    let a = y4;
    const { b, c = y8 } = y5;
    a, b, c;
    y6.m = y7;
    function xxx() {}
}
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_skip_shared_identifiers_js,
    r#"
import { sharedRuntime } from './utils.js' with {
    runtime: "shared"
};

function worklet(event: Event) {
    "main thread";
    console.log(sharedRuntime);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  // default import should also be treated as shared-runtime and skipped from capture
  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_skip_shared_identifiers_default_import_js,
    r#"
import sharedRuntime from './utils.js' with {
    runtime: "shared"
};

function worklet(event: Event) {
    "main thread";
    console.log(sharedRuntime);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  // namespace import should be skipped from capture
  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_skip_shared_identifiers_namespace_import_js,
    r#"
import * as SR from './utils.js' with {
    runtime: "shared"
};

function worklet(event: Event) {
    "main thread";
    console.log(SR);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  // with clause key can be string literal
  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_skip_shared_identifiers_string_key_js,
    r#"
import { sharedRuntime as sr } from './utils.js' with {
    "runtime": "shared"
};

function worklet(event: Event) {
    "main thread";
    console.log(sr);
    console.log(this.y1);
    let a: object = y1;
}
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_handle_renamed_import_shadowing_js,
    r#"
import { sharedRuntime as sr } from './utils.js' with {
    runtime: "shared"
};

(function() {
  let sr = y1;
  function worklet(event: Event) {
      "main thread";
      console.log(sr);
      console.log(this.y1);
      let a: object = y1;
  }
})();
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_skip_shared_identifiers_lepus,
    r#"
import { sharedRuntime } from './utils.js' with {
    runtime: "shared"
};

function worklet(event: Event) {
    "main thread";
    console.log(sharedRuntime);
    console.log(this.y1);
    let a: object = y1;
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_multiple_worklets,
    r#"
function X(event) {
    "main thread";
    console.log(y1[y2 + 1]);
}
function Y(event) {
    "main thread";
    console.log(z1[z2 + 1]);
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_multiple_worklets_in_func,
    r#"
function App() {
    function X(event) {
        "main thread";
        console.log(y1[y2 + 1]);
    }
    function Y(event) {
        "main thread";
        console.log(z1[z2 + 1]);
    }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_arrow_function,
    r#"
let X = (event) => {
    "main thread";
    console.log(y1[y2 + 1]);
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_function_expr,
    r#"
let X = function (event) {
    "main thread";
    console.log(y1[y2 + 1]);
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_lepus,
    r#"
class App extends Component {
  a = 1;

  onTapLepus(event) {
    "main thread";
    console.log(this.a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_js,
    r#"
class App extends Component {
  a = 1;

  onTapLepus(event) {
    "main thread";
    console.log(this.a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_js_capture_values,
    r#"
let a = 1;
class App extends Component {
  onTapLepus(event) {
    "main thread";
    console.log(a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_static_lepus,
    r#"
let a = 1;
class App extends Component {
  static onTapLepus(event) {
    "main thread";
    console.log(a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_static_js,
    r#"
let a = 1;
class App extends Component {
  static onTapLepus(event) {
    "main thread";
    console.log(a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_property_lepus,
    r#"
let a = 1;
class App extends Component {
  onTapLepus = (event) => {
    "main thread";
    console.log(a);
    console.log(this.a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_property_js,
    r#"
let a = 1;
class App extends Component {
  onTapLepus = (event) => {
    "main thread";
    console.log(a);
    console.log(this.a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_property_js_capture_values,
    r#"
let a = 1;
class App extends Component {
  onTapLepus = (event) => {
    "main thread";
    console.log(a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_static_property_lepus,
    r#"
let a = 1;
class App extends Component {
  static onTapLepus = (event) => {
    "main thread";
    console.log(a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_in_class_static_property_js,
    r#"
let a = 1;
class App extends Component {
  static onTapLepus = (event) => {
    "main thread";
    console.log(a);
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_transform_recursively,
    r#"
function X() {
    "main thread";
    console.log(y1[y2 + 1]);
    function Y() {
        "main thread";
        console.log(y1[y2 + 1]);
        console.log(z1[z2 + 1]);
    }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_transform_when_wrong_directives,
    r#"
function X() {
    "main threads";
    console.log(y1[y2 + 1]);
}
function Y() {
    console.log(y1[y2 + 1]);
}
function Z() {
    console.log("main thread");
}
function A() {
    console.log("");
    "main thread";
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_transform_getter_and_setter,
    r#"
let a = 1;
class App extends Component {
  get x() {
    "main thread";
    return a;
  }
}
class Bpp extends Component {
  set x(n) {
    "main thread";
    this.a = n;
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_transform_constructor,
    r#"
let a = 1;
class App extends Component {
  constructor() {
    "main thread";
    return a;
  }
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_destructure_from_closure,
    r#"
    function Y(n) {
        "main thread";
        let a = 123;
        n;
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_capture_env_lepus,
    r#"
    function Y() {
        "main thread";
        let a = 123;
        const b = [ a, ...y1];
        const c = { a, y2, ...y3, ...{ d: 233, e: y4 } };
        return y5.r;
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_capture_env_js,
    r#"
    function Y() {
        "main thread";
        let a = 123;
        const b = [ a, ...y1];
        const c = { a, y2, ...y3, ...{ d: 233, e: y4 } };
        return y5.r;
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
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.js".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: Some(vec!["myCustomGlobal".to_string()]),
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_capture_globals,
    r#"
    function Y() {
        "main thread";
        console.log(111);
        setTimeout(() => {});
        lynx.querySelector();
        SystemInfo.version;
        myCustomGlobal;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_capture_type_annotations,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        type XXXX = YYYY;
        class N {};
        let a: AClass = 0;
        console.log(a);
        event.target.setStyle("background-color", wv.current % 2 ? "blue" : "green");
        event.target.setStyle("height", "200px");
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_js_fn_in_run_on_js_js,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        runOnBackground(fn1);
        runOnBackground(obj.fn2);
        runOnBackground(obj[fn3]);
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_js_fn_in_run_on_js_lepus,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        runOnBackground(fn1);
        runOnBackground(obj.fn2);
        runOnBackground(obj[fn3]);
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_idents_outside_of_ctx,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        if(true) {
          let a = 1;
          a;
        }
        a;
        function fn(m, x) {
          let b = 1;
          m;
          x;
          b;
        }
        m;
        b;
        c;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_extract_idents_inside_of_ctx,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        if(true) {
          let a = 1;
          a;
        }
        function f(e) {
          f;
          e;
        }
        if(true) {
          var b = 1;
          b;
        }
        b;
        f;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_extract_catch_clause_params,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        try {} catch(e) {}
        try {} catch({f, g}) {}
        g;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_ident_from_this_lepus,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        let a = 1;
        this.a;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_ident_from_this_js,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        let a = 1;
        this.a;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_not_extract_ident_from_this,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "main thread";
        class C {
          a = 1;
          b = 1;
          c = 1;
          d = 1;
          constructor() {
             this.b;
          }
          get GET() {
            return this.c;
          }
          set SET(v) {
            this.d;
          }
          f() {
            this.a;
          }
          x = 1;
        }
        function g() {
          this.b;
        }
        x;
        () => {
          this.y;
        }
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_ui_worklet_js,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "use worklet";
        a;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_ui_worklet_lepus,
    r#"
    function onTapLepus(event: ReactLynx.Worklet.ITouchEvent) {
        "use worklet";
        a;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    class_in_worklet_1,
    r#"
    function onTapLepus() {
      "main thread";
      class C {
        onUpdate: (progress: number) => number;

        constructor() {
           this.b;
        }

        f() {
           const progress = undefined;
           this.onUpdate(progress);
        }
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_js,
    r#"
    function onTapLepus() {
      "main thread";
      aaaa.bbbb[cccc.dddd].eeee;
      aaaa.bbbb[cccc.dddd].eeee;
      aaaa.bbbb[cccc.dddd].eeee;
      hhhh.iiii.current.jjjj;
      hhhh.iiii.current.jjjj;
      llll.mmmm.nnnn;
      llll.mmmm;
      llll;
      oooo.pppp.qqqq;
      oooo.pppp;
      oooo.qqqq;
      rrrr;
      rrrr.ssss;
      rrrr.ssss.tttt;
      uuuu["__??__"];
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_lepus,
    r#"
    function onTapLepus() {
      "main thread";
      aaaa.bbbb[cccc.dddd].eeee;
      aaaa.bbbb[cccc.dddd].eeee;
      aaaa.bbbb[cccc.dddd].eeee;
      hhhh.iiii.current.jjjj;
      hhhh.iiii.current.jjjj;
      llll.mmmm.nnnn;
      llll.mmmm;
      llll;
      oooo.pppp.qqqq;
      oooo.pppp;
      oooo.qqqq;
      rrrr;
      rrrr.ssss;
      rrrr.ssss.tttt;
      uuuu["__??__"];
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_2_js,
    r#"
    function onTapLepus() {
      "main thread";
      this.aaaa;
      this.aaaa;
      this.bbbb.cccc.dddd;
      this.bbbb.cccc.dddd;
      this.eeee.ffff.gggg;
      this.eeee;
      this.ffff;
      this.eeee.ffff.gggg;
      this.hhhh.iiii.jjjj;
      this.hhhh['iiii'];
      this.hhhh.kkkk;
      this.hhhh.iiii.jjjj;
      this.llll[this.mmmm.nnnn['oooo']];
      aaaa;
      bbbb;
      eeee;
      ffff;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_2_lepus,
    r#"
    function onTapLepus() {
      "main thread";
      this.aaaa;
      this.aaaa;
      this.bbbb.cccc.dddd;
      this.bbbb.cccc.dddd;
      this.eeee.ffff.gggg;
      this.eeee;
      this.ffff;
      this.eeee.ffff.gggg;
      this.hhhh.iiii.jjjj;
      this.hhhh['iiii'];
      this.hhhh.kkkk;
      this.hhhh.iiii.jjjj;
      this.llll[this.mmmm.nnnn['oooo']];
      aaaa;
      bbbb;
      eeee;
      ffff;
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_3_js,
    r#"
    function enableScroll(enable: boolean) {
      'main thread';
        lynx
          .querySelector(`#${containerID}`)
          ?.setAttribute('enable-scroll', enable);
        (a + b).c.d;
        ({e: f}).e;
    }

    function makeVelocityIfRequired(nodeRef: MainThreadRef<Velocity>, velocity: boolean) {
      'main thread';

      class Velocity implements Velocity {
        constructor(velocity: boolean) {
          this.enabled = velocity;
        }

        positionQueue = [];
        timeQueue = [];
        enabled = true;

        reset = () => {
          this.positionQueue = [];
          this.timeQueue = [];
        };

        getVelocity = () => {
          if (!this.enabled) {
            return {
              velocity: 0,
              direction: 0,
            };
          }

          this.pruneQueue(500);

          const { length } = this.timeQueue;
          if (length < 2) {
            return {
              velocity: 0,
              direction: 1,
            };
          }

          const distance = this.positionQueue[length - 1] - this.positionQueue[0];
          const time = (this.timeQueue[length - 1] - this.timeQueue[0]) / 1000;

          return {
            velocity: distance / time,
            direction: distance > 0 ? 1 : -1,
          };
        };

        updatePosition = (position: number) => {
          if (!this.enabled) {
            return;
          }
          this.positionQueue.push(position);
          this.timeQueue.push(Date.now());
          this.pruneQueue(50);
          console.log('updatePosition done', position);
        };

        pruneQueue = (ms: number) => {
          if (!this.enabled) {
            return;
          }
          const nowTs = Date.now();
          // pull old values off of the queue
          while (this.timeQueue.length && this.timeQueue[0] < nowTs - ms) {
            this.timeQueue.shift();
            this.positionQueue.shift();
          }
        };
      }

      if (nodeRef && nodeRef.current) {
        nodeRef.current.reset();
        return nodeRef.current;
      } else {
        return new Velocity(velocity);
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_3_lepus,
    r#"
    function enableScroll(enable: boolean) {
      'main thread';
        lynx
          .querySelector(`#${containerID}`)
          ?.setAttribute('enable-scroll', enable);
        (a + b).c.d;
        ({e: f}).e;
    }

    function makeVelocityIfRequired(nodeRef: MainThreadRef<Velocity>, velocity: boolean) {
      'main thread';

      class Velocity implements Velocity {
        constructor(velocity: boolean) {
          this.enabled = velocity;
        }

        positionQueue = [];
        timeQueue = [];
        enabled = true;

        reset = () => {
          this.positionQueue = [];
          this.timeQueue = [];
        };

        getVelocity = () => {
          if (!this.enabled) {
            return {
              velocity: 0,
              direction: 0,
            };
          }

          this.pruneQueue(500);

          const { length } = this.timeQueue;
          if (length < 2) {
            return {
              velocity: 0,
              direction: 1,
            };
          }

          const distance = this.positionQueue[length - 1] - this.positionQueue[0];
          const time = (this.timeQueue[length - 1] - this.timeQueue[0]) / 1000;

          return {
            velocity: distance / time,
            direction: distance > 0 ? 1 : -1,
          };
        };

        updatePosition = (position: number) => {
          if (!this.enabled) {
            return;
          }
          this.positionQueue.push(position);
          this.timeQueue.push(Date.now());
          this.pruneQueue(50);
          console.log('updatePosition done', position);
        };

        pruneQueue = (ms: number) => {
          if (!this.enabled) {
            return;
          }
          const nowTs = Date.now();
          // pull old values off of the queue
          while (this.timeQueue.length && this.timeQueue[0] < nowTs - ms) {
            this.timeQueue.shift();
            this.positionQueue.shift();
          }
        };
      }

      if (nodeRef && nodeRef.current) {
        nodeRef.current.reset();
        return nodeRef.current;
      } else {
        return new Velocity(velocity);
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_4_js,
    r#"
    function enableScroll(enable: boolean) {
      'main thread';
      function x() {
        this.a;
      }
    }

    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_extract_member_expr_4_lepus,
    r#"
    function enableScroll(enable: boolean) {
      'main thread';
      function x() {
        this.a;
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_fn_decl_lepus,
    r#"
      export default function useExposure(exposureArgs) {
        'main thread';
        console.log('useExposure2');
        console.log(exposureArgs);
        x;
      }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::JS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_transform_fn_decl_js,
    r#"
      export default function useExposure(exposureArgs) {
        'main thread';
        console.log('useExposure2');
        console.log(exposureArgs);
        x;
      }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_add_worklet_runtime_ident_with_outer_ident,
    r#"
      const __workletRuntimeLoaded = false;
      console.log(__workletRuntimeLoaded);

      function foo() {
        "main thread";
        return 1;
      }
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| (
      resolver(Mark::new(), Mark::new(), true),
      visit_mut_pass(WorkletVisitor::new(
        TransformMode::Test,
        WorkletVisitorConfig {
          filename: "index.ts".into(),
          target: TransformTarget::LEPUS,
          custom_global_ident_names: None,
          runtime_pkg: "@lynx-js/react".into(),
        }
      )),
      hygiene()
    ),
    should_add_worklet_runtime_ident_with_inner_ident,
    r#"
      function foo() {
        "main thread";
        const __workletRuntimeLoaded = false;
        console.log(__workletRuntimeLoaded);
        return 1;
      }
    "#
  );
}
