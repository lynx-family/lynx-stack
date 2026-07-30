use std::collections::HashSet;

use swc_core::{
  atoms::Atom,
  common::{errors::HANDLER, Spanned, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};

fn is_background_only_directive(value: &str) -> bool {
  matches!(value, "use js only" | "background only" | "background-only")
}

fn as_directive(stmt: &Stmt) -> Option<String> {
  if let Stmt::Expr(ExprStmt { expr, .. }) = stmt {
    if let Expr::Lit(Lit::Str(str)) = &**expr {
      return Some(str.value.to_string_lossy().into_owned());
    }
  }
  None
}

/// Whether the module opens with a `'background only'` directive prologue.
fn has_background_only_module_directive(module: &Module) -> bool {
  for item in &module.body {
    match item {
      ModuleItem::Stmt(stmt) => match as_directive(stmt) {
        Some(directive) if is_background_only_directive(&directive) => return true,
        // Keep scanning the directive prologue ('use strict' and friends).
        Some(_) => continue,
        None => return false,
      },
      _ => return false,
    }
  }
  false
}

fn block_is_background_only(body: &BlockStmt) -> bool {
  body
    .stmts
    .first()
    .and_then(as_directive)
    .is_some_and(|directive| is_background_only_directive(&directive))
}

fn expr_is_background_only_fn(expr: &Expr) -> bool {
  match expr {
    Expr::Fn(FnExpr { function, .. }) => {
      function.body.as_ref().is_some_and(block_is_background_only)
    }
    Expr::Arrow(ArrowExpr { body, .. }) => match &**body {
      BlockStmtOrExpr::BlockStmt(block) => block_is_background_only(block),
      BlockStmtOrExpr::Expr(_) => false,
    },
    _ => false,
  }
}

/// Names of top-level bindings that are `'background only'` functions.
fn background_only_bindings(module: &Module) -> HashSet<Atom> {
  let mut bindings = HashSet::new();

  let mut visit_decl = |decl: &Decl| match decl {
    Decl::Fn(fn_decl) => {
      if fn_decl
        .function
        .body
        .as_ref()
        .is_some_and(block_is_background_only)
      {
        bindings.insert(fn_decl.ident.sym.clone());
      }
    }
    Decl::Var(var_decl) => {
      for declarator in &var_decl.decls {
        if let (Pat::Ident(name), Some(init)) = (&declarator.name, &declarator.init) {
          if expr_is_background_only_fn(init) {
            bindings.insert(name.id.sym.clone());
          }
        }
      }
    }
    _ => {}
  };

  for item in &module.body {
    match item {
      ModuleItem::Stmt(Stmt::Decl(decl)) => visit_decl(decl),
      ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => visit_decl(&export.decl),
      _ => {}
    }
  }

  bindings
}

/// Whether every (value) export of the module is a `'background only'`
/// component/function — the component-level directive promoted to the module.
///
/// This is deliberately conservative: any export the transform cannot prove
/// `'background only'` (re-exports, classes, non-function values,
/// runtime-computed expressions) keeps the module on the in-place path.
/// Type-only exports are ignored.
fn all_exports_are_background_only(module: &Module) -> bool {
  let bindings = background_only_bindings(module);
  let mut value_exports = 0usize;

  for item in &module.body {
    let ModuleItem::ModuleDecl(module_decl) = item else {
      continue;
    };
    match module_decl {
      ModuleDecl::ExportDecl(export) => match &export.decl {
        Decl::Fn(fn_decl) => {
          value_exports += 1;
          if !fn_decl
            .function
            .body
            .as_ref()
            .is_some_and(block_is_background_only)
          {
            return false;
          }
        }
        Decl::Var(var_decl) => {
          for declarator in &var_decl.decls {
            value_exports += 1;
            let is_background_only = matches!(&declarator.name, Pat::Ident(_))
              && declarator
                .init
                .as_ref()
                .is_some_and(|init| expr_is_background_only_fn(init));
            if !is_background_only {
              return false;
            }
          }
        }
        Decl::TsInterface(_) | Decl::TsTypeAlias(_) => {}
        _ => return false,
      },
      ModuleDecl::ExportDefaultDecl(export) => match &export.decl {
        DefaultDecl::Fn(fn_expr) => {
          value_exports += 1;
          if !fn_expr
            .function
            .body
            .as_ref()
            .is_some_and(block_is_background_only)
          {
            return false;
          }
        }
        DefaultDecl::TsInterfaceDecl(_) => {}
        DefaultDecl::Class(_) => return false,
      },
      ModuleDecl::ExportDefaultExpr(export) => {
        value_exports += 1;
        let is_background_only = match &*export.expr {
          Expr::Ident(ident) => bindings.contains(&ident.sym),
          expr => expr_is_background_only_fn(expr),
        };
        if !is_background_only {
          return false;
        }
      }
      ModuleDecl::ExportNamed(named) => {
        if named.type_only {
          continue;
        }
        if named.src.is_some() {
          return false;
        }
        for specifier in &named.specifiers {
          match specifier {
            ExportSpecifier::Named(specifier) => {
              if specifier.is_type_only {
                continue;
              }
              value_exports += 1;
              let ModuleExportName::Ident(orig) = &specifier.orig else {
                return false;
              };
              if !bindings.contains(&orig.sym) {
                return false;
              }
            }
            _ => return false,
          }
        }
      }
      ModuleDecl::ExportAll(_) => return false,
      _ => {}
    }
  }

  value_exports > 0
}

/// Whether the module is `'background only'` for the main thread: either the
/// module-level directive, or every export carries the component-level
/// directive.
pub fn is_background_only_module(module: &Module) -> bool {
  has_background_only_module_directive(module) || all_exports_are_background_only(module)
}

/// The names the stub shell must keep exporting.
struct StubExports {
  named: Vec<Atom>,
  has_default: bool,
  /// `export * from` re-exports the stub cannot enumerate; kept as-is.
  export_alls: Vec<ExportAll>,
}

fn stub_exports(module: &Module) -> StubExports {
  let mut named: Vec<Atom> = vec![];
  let mut seen: HashSet<Atom> = HashSet::new();
  let mut has_default = false;
  let mut export_alls: Vec<ExportAll> = vec![];

  let mut push = |name: Atom, has_default: &mut bool| {
    if &*name == "default" {
      *has_default = true;
    } else if seen.insert(name.clone()) {
      named.push(name);
    }
  };

  for item in &module.body {
    let ModuleItem::ModuleDecl(module_decl) = item else {
      continue;
    };
    match module_decl {
      ModuleDecl::ExportDecl(export) => match &export.decl {
        Decl::Fn(fn_decl) => push(fn_decl.ident.sym.clone(), &mut has_default),
        Decl::Class(class_decl) => push(class_decl.ident.sym.clone(), &mut has_default),
        Decl::Var(var_decl) => {
          for declarator in &var_decl.decls {
            if let Pat::Ident(name) = &declarator.name {
              push(name.id.sym.clone(), &mut has_default);
            }
          }
        }
        Decl::TsEnum(ts_enum) => push(ts_enum.id.sym.clone(), &mut has_default),
        _ => {}
      },
      ModuleDecl::ExportDefaultDecl(_) | ModuleDecl::ExportDefaultExpr(_) => {
        has_default = true;
      }
      ModuleDecl::ExportNamed(named_export) => {
        if named_export.type_only {
          continue;
        }
        for specifier in &named_export.specifiers {
          match specifier {
            ExportSpecifier::Named(specifier) => {
              if specifier.is_type_only {
                continue;
              }
              let exported = specifier.exported.as_ref().unwrap_or(&specifier.orig);
              if let ModuleExportName::Ident(ident) = exported {
                push(ident.sym.clone(), &mut has_default);
              }
            }
            ExportSpecifier::Namespace(specifier) => {
              if let ModuleExportName::Ident(ident) = &specifier.name {
                push(ident.sym.clone(), &mut has_default);
              }
            }
            ExportSpecifier::Default(_) => {
              has_default = true;
            }
          }
        }
      }
      ModuleDecl::ExportAll(export_all) => export_alls.push(export_all.clone()),
      _ => {}
    }
  }

  StubExports {
    named,
    has_default,
    export_alls,
  }
}

fn inert_fn_expr() -> Expr {
  Expr::Fn(FnExpr {
    ident: None,
    function: Box::new(Function {
      params: vec![],
      decorators: vec![],
      span: DUMMY_SP,
      ctxt: Default::default(),
      body: Some(BlockStmt {
        span: DUMMY_SP,
        ctxt: Default::default(),
        stmts: vec![],
      }),
      is_generator: false,
      is_async: false,
      type_params: None,
      return_type: None,
    }),
  })
}

fn warn_dropped_top_level_statements(module: &Module) {
  let dropped = module.body.iter().find_map(|item| match item {
    ModuleItem::Stmt(stmt) => match stmt {
      Stmt::Decl(_) => None,
      stmt if as_directive(stmt).is_some() => None,
      stmt => Some(stmt.span()),
    },
    _ => None,
  });

  if let Some(span) = dropped {
    HANDLER.with(|handler| {
      handler
        .struct_span_warn(
          span,
          "this 'background only' module compiles as a stub shell for the main thread: \
           its top-level statements no longer run on the main thread (they still run on \
           the background thread). Move side effects the main thread relies on into a \
           module that is not 'background only'.",
        )
        .emit();
    });
  }
}

/// Compiles a `'background only'` module as a main-thread stub shell.
///
/// The parent module still evaluates the imported bindings as values while
/// rendering on the main thread (`jsx(Feed, …)`), so a background-only module
/// cannot disappear from the main-thread graph. Its exports survive as inert
/// empty functions; everything else — render bodies, top-level statements,
/// and the in-place snapshot/worklet definitions — is dropped. The dropped
/// definitions reach the main thread through assembly instead (collected
/// while the background compiles the same module).
pub struct BackgroundOnlyModuleStubVisitor;

impl BackgroundOnlyModuleStubVisitor {
  pub fn new() -> Self {
    BackgroundOnlyModuleStubVisitor
  }
}

impl Default for BackgroundOnlyModuleStubVisitor {
  fn default() -> Self {
    Self::new()
  }
}

impl VisitMut for BackgroundOnlyModuleStubVisitor {
  fn visit_mut_module(&mut self, module: &mut Module) {
    if !is_background_only_module(module) {
      module.visit_mut_children_with(self);
      return;
    }

    warn_dropped_top_level_statements(module);

    let exports = stub_exports(module);
    let mut body: Vec<ModuleItem> = vec![];

    for name in exports.named {
      body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(ExportDecl {
        span: DUMMY_SP,
        decl: Decl::Var(Box::new(VarDecl {
          span: DUMMY_SP,
          ctxt: Default::default(),
          kind: VarDeclKind::Var,
          declare: false,
          decls: vec![VarDeclarator {
            span: DUMMY_SP,
            name: Pat::Ident(BindingIdent {
              id: Ident::new(name, DUMMY_SP, Default::default()),
              type_ann: None,
            }),
            init: Some(Box::new(inert_fn_expr())),
            definite: false,
          }],
        })),
      })));
    }

    if exports.has_default {
      body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultExpr(
        ExportDefaultExpr {
          span: DUMMY_SP,
          expr: Box::new(inert_fn_expr()),
        },
      )));
    }

    for export_all in exports.export_alls {
      body.push(ModuleItem::ModuleDecl(ModuleDecl::ExportAll(export_all)));
    }

    module.body = body;
    module.shebang = None;
  }
}

#[cfg(test)]
mod tests {
  use swc_core::{
    ecma::parser::Syntax,
    ecma::visit::visit_mut_pass,
    ecma::{parser::EsSyntax, parser::TsSyntax, transforms::testing::test},
  };

  use super::BackgroundOnlyModuleStubVisitor;

  fn es_jsx() -> Syntax {
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    })
  }

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_stub_module_level_directive,
    r#"
    'background only';
    import { sideEffect } from './effects.js';
    sideEffect("TOP_LEVEL_SIDE_EFFECT");
    const helper = () => "internal";
    export function Feed() {
      return helper();
    }
    export const onScroll = () => {
      console.log("scroll");
    };
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_stub_when_every_export_is_background_only,
    r#"
    import { formatFeed } from './heavy-format.js';
    console.log("TOP_LEVEL_SIDE_EFFECT");
    export function Feed() {
      'background only';
      return formatFeed(1, 2, 3);
    }
    export const Card = () => {
      'background only';
      return null;
    };
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_stub_local_component_exported_by_name,
    r#"
    function Feed() {
      'background only';
      return null;
    }
    export { Feed, Feed as default };
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_stub_default_export_with_directive,
    r#"
    export default function Feed() {
      'background-only';
      return null;
    }
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_keep_mixed_module_on_the_in_place_path,
    r#"
    export function Feed() {
      'background only';
      return null;
    }
    export function Header() {
      return null;
    }
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_keep_re_exporting_module_on_the_in_place_path,
    r#"
    export { Feed } from './Feed.jsx';
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_keep_module_without_exports_on_the_in_place_path,
    r#"
    console.log("side effect only");
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      tsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_ignore_type_only_exports,
    r#"
    export interface FeedProps {
      items: string[];
    }
    export type FeedItem = string;
    export function Feed(props: FeedProps) {
      'background only';
      return null;
    }
    "#
  );

  test!(
    module,
    es_jsx(),
    |_| visit_mut_pass(BackgroundOnlyModuleStubVisitor::new()),
    should_keep_runtime_computed_export_on_the_in_place_path,
    r#"
    const pick = (a) => a;
    export const Feed = pick(function () {
      'background only';
      return null;
    });
    "#
  );
}
