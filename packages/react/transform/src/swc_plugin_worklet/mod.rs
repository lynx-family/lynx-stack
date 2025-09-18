mod decl_collect;
mod extract_ident;
mod gen_stmt;
mod globals;
mod hash;
mod worklet_type;

use crate::swc_plugin_worklet::extract_ident::{
  ExtractingIdentsCollector, ExtractingIdentsCollectorConfig,
};
use crate::swc_plugin_worklet::gen_stmt::StmtGen;
use crate::swc_plugin_worklet::hash::WorkletHash;
use crate::swc_plugin_worklet::worklet_type::WorkletType;
use napi_derive::napi;
use std::collections::HashSet;
use std::vec;
use swc_core::common::util::take::Take;
use swc_core::common::{Spanned, DUMMY_SP};
use swc_core::ecma::ast::*;
use swc_core::ecma::utils::prepend_stmts;
use swc_core::ecma::visit::VisitMutWith;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut};

use crate::TransformMode;
use swc_plugins_shared::target_napi::TransformTarget;

#[derive(Clone, Debug)]
#[napi(object)]
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
  #[napi(ts_type = "'LEPUS' | 'JS' | 'MIXED'")]
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
}

impl Default for WorkletVisitor {
  fn default() -> Self {
    WorkletVisitor::new(TransformMode::Production, WorkletVisitorConfig::default())
  }
}

impl VisitMut for WorkletVisitor {
  noop_visit_mut_type!();

  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    if !n.is_method() || n.as_method().unwrap().kind != MethodKind::Method {
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
    });
    n.visit_mut_with(&mut collector);

    let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
    let (worklet_object_expr, register_worklet_stmt) = StmtGen::transform_worklet(
      self.mode,
      worklet_type.unwrap(),
      hash,
      self.cfg.target,
      n.as_method()
        .unwrap()
        .key
        .clone()
        .ident()
        .unwrap_or(Ident::dummy().into())
        .into(),
      n.as_method().unwrap().function.clone(),
      &mut collector,
      true,
      &mut self.named_imports,
    );

    *n = ClassProp {
      span: n.as_method().unwrap().span,
      key: n.as_method().unwrap().key.clone(),
      value: worklet_object_expr.into(),
      declare: false,
      is_abstract: n.as_method().unwrap().is_abstract,
      decorators: vec![],
      definite: false,
      type_ann: None,
      is_static: n.as_method().unwrap().is_static,
      accessibility: n.as_method().unwrap().accessibility,
      is_optional: n.as_method().unwrap().is_optional,
      is_override: n.as_method().unwrap().is_override,
      readonly: false,
    }
    .into();
    self
      .stmts_to_insert_at_top_level
      .push(register_worklet_stmt);
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
    });
    n.visit_mut_with(&mut collector);

    let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
    let (worklet_object_expr, register_worklet_stmt) = StmtGen::transform_worklet(
      self.mode,
      worklet_type.unwrap(),
      hash,
      self.cfg.target,
      n.as_fn_decl().unwrap().ident.clone(),
      n.as_fn_decl().unwrap().function.clone(),
      &mut collector,
      false,
      &mut self.named_imports,
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
        });
        n.visit_mut_with(&mut collector);

        let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
        let (worklet_object_expr, register_worklet_stmt) = StmtGen::transform_worklet(
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
        );

        *n = *worklet_object_expr;
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
        });
        n.visit_mut_with(&mut collector);

        let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
        let (worklet_object_expr, register_worklet_stmt) = StmtGen::transform_worklet(
          self.mode,
          worklet_type.unwrap(),
          hash,
          self.cfg.target,
          Ident::dummy(),
          n.as_mut_fn_expr().unwrap().function.take(),
          &mut collector,
          false,
          &mut self.named_imports,
        );

        *n = *worklet_object_expr;
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
    });
    n.as_mut_export_default_decl()
      .unwrap()
      .decl
      .as_mut_fn_expr()
      .unwrap()
      .visit_mut_with(&mut collector);

    let hash = self.hasher.gen(&self.cfg.filename, &self.content_hash);
    let (worklet_object_expr, register_worklet_stmt) = StmtGen::transform_worklet(
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
    );

    *n = ModuleDecl::ExportDefaultExpr(ExportDefaultExpr {
      span: n.span(),
      expr: worklet_object_expr,
    });
    self
      .stmts_to_insert_at_top_level
      .push(register_worklet_stmt);
  }

  fn visit_mut_module_items(&mut self, n: &mut Vec<ModuleItem>) {
    n.visit_mut_children_with(self);
    n.extend(
      self
        .stmts_to_insert_at_top_level
        .iter_mut()
        .filter(|stmt| !stmt.is_empty())
        .map(|stmt| stmt.take().into()),
    );
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    n.visit_mut_children_with(self);

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
  }
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
    }
  }

  fn check_is_worklet_block(&self, n: &mut BlockStmt) -> Option<WorkletType> {
    let BlockStmt { stmts, .. } = n;
    if !stmts.is_empty() {
      match &mut stmts[0] {
        Stmt::Expr(ExprStmt { expr, span: _ }) => match &mut **expr {
          Expr::Lit(Lit::Str(str)) => WorkletType::from_directive(str.value.to_string()),
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
  use crate::swc_plugin_worklet::{TransformTarget, WorkletVisitor, WorkletVisitorConfig};
  use crate::TransformMode;
  use swc_core::common::Mark;
  use swc_core::ecma::parser::TsSyntax;
  use swc_core::ecma::transforms::base::hygiene::hygiene;
  use swc_core::ecma::transforms::base::resolver;
  use swc_core::{
    ecma::parser::Syntax,
    ecma::visit::visit_mut_pass,
    ecma::{parser::EsSyntax, transforms::testing::test},
  };

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
}
