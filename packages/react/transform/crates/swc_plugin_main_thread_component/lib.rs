//! The compile-time half of a main-thread island.
//!
//! Two independent things are recognised here, both of which only *report*
//! (plus strip the directive) — no codegen happens in this pass:
//!
//! 1. `'main thread component'`, the definition-site marker. It is the
//!    symmetric twin of `'background only'`: instead of keeping a component's
//!    render body *out* of the main-thread bundle, it pulls the whole module
//!    *into* the main-thread layer, so the component can render on the first
//!    frame even when the main thread otherwise compiles no business code
//!    (`enableMTSRendering: false`).
//!
//! 2. A root-level `<MainThread>` — `root.render(<MainThread>…</MainThread>)`
//!    — which names the island that *is* the first frame. The build resolves
//!    the wrapped component back to the module it is imported from and makes
//!    the main-thread entry render it.
//!
//! The marker string is `"main thread component"` and not `"main thread"`:
//! a component is a function, and `"main thread"` already means *worklet* to
//! `swc_plugin_worklet` (`WorkletType::from_directive`, exact match). The two
//! never collide.
//!
//! This pass must run before the worklet, snapshot and JSX transforms: it
//! reads the directive prologue that the worklet transform also inspects, and
//! it matches on JSX that the React transform would otherwise have rewritten
//! into `_jsx(…)` calls.

use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::{
  ast::*,
  visit::{VisitMut, VisitMutWith},
};

/// The definition-site marker of a main-thread component.
pub const MAIN_THREAD_COMPONENT_DIRECTIVE: &str = "main thread component";

/// The component name of the `<MainThread>` boundary, as imported from
/// `@lynx-js/react`.
const MAIN_THREAD_BOUNDARY: &str = "MainThread";

const REACT_PACKAGE: &str = "@lynx-js/react";

/// A component marked with [`MAIN_THREAD_COMPONENT_DIRECTIVE`].
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MainThreadComponent {
  /// The declared (local) name, for diagnostics.
  pub name: String,
  /// The name the component is exported under, when it is exported. The
  /// build imports islands by this name to pin them into the main-thread
  /// layer, so an unexported component can be marked but never referenced
  /// from outside its module.
  pub exported: Option<String>,
}

/// The island a root-level `<MainThread>` wraps.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RootMainThreadIsland {
  /// The module specifier the island component is imported from, or `None`
  /// when it is declared in this very module.
  pub source: Option<String>,
  /// The name the island is imported under in its own module (`"default"`
  /// for a default import), or `None` for a locally declared component.
  pub imported: Option<String>,
  /// The local identifier, for diagnostics.
  pub local: String,
}

/// Everything this pass learned about one module.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MainThreadIslandInfo {
  pub components: Vec<MainThreadComponent>,
  pub root_island: Option<RootMainThreadIsland>,
  /// A root-level `<MainThread>` whose child could not be resolved to a
  /// component. Reported so the build can explain the degraded first frame
  /// instead of silently painting nothing.
  pub root_island_warning: Option<String>,
}

pub type MainThreadIslandCollector = Rc<RefCell<MainThreadIslandInfo>>;

#[derive(Default)]
pub struct MainThreadComponentVisitor {
  collector: Option<MainThreadIslandCollector>,

  /// `local ident` → `(module specifier, imported name)`, for every ES import
  /// binding in the module.
  imports: Vec<(Id, String, String)>,
  /// `local ident` → exported name.
  exports: Vec<(Id, String)>,
}

impl MainThreadComponentVisitor {
  pub fn new(collector: MainThreadIslandCollector) -> Self {
    MainThreadComponentVisitor {
      collector: Some(collector),
      ..Default::default()
    }
  }

  fn report_component(&mut self, local: &Ident) {
    let exported = self
      .exports
      .iter()
      .find(|(id, _)| *id == local.to_id())
      .map(|(_, name)| name.clone());
    if let Some(collector) = &self.collector {
      collector.borrow_mut().components.push(MainThreadComponent {
        name: local.sym.to_string(),
        exported,
      });
    }
  }

  fn lookup_import(&self, local: &Ident) -> Option<(String, String)> {
    self
      .imports
      .iter()
      .find(|(id, _, _)| *id == local.to_id())
      .map(|(_, source, imported)| (source.clone(), imported.clone()))
  }

  /// Strip a leading [`MAIN_THREAD_COMPONENT_DIRECTIVE`] from a function body,
  /// reporting whether it was there.
  fn take_directive(body: &mut BlockStmt) -> bool {
    let is_marker = matches!(
      body.stmts.first(),
      Some(Stmt::Expr(ExprStmt { expr, .. }))
        if matches!(
          &**expr,
          Expr::Lit(Lit::Str(str)) if str.value == *MAIN_THREAD_COMPONENT_DIRECTIVE
        )
    );
    if is_marker {
      body.stmts.remove(0);
    }
    is_marker
  }

  fn take_directive_from_expr(expr: &mut Expr) -> bool {
    match expr {
      Expr::Arrow(ArrowExpr { body, .. }) => match &mut **body {
        BlockStmtOrExpr::BlockStmt(block) => Self::take_directive(block),
        BlockStmtOrExpr::Expr(_) => false,
      },
      Expr::Fn(FnExpr { function, .. }) => function
        .body
        .as_mut()
        .map(Self::take_directive)
        .unwrap_or(false),
      // `export const Header = memo(function Header() { 'main thread
      // component'; … })` and friends: the marker is only recognised on the
      // function the declaration binds directly, so a wrapped component must
      // mark the inner function *and* be reachable by name.
      _ => false,
    }
  }

  fn collect_bindings(&mut self, module: &Module) {
    for item in &module.body {
      match item {
        ModuleItem::ModuleDecl(ModuleDecl::Import(import)) => {
          let source = import.src.value.to_string_lossy().into_owned();
          for specifier in &import.specifiers {
            match specifier {
              ImportSpecifier::Named(named) => {
                let imported = match &named.imported {
                  Some(ModuleExportName::Ident(ident)) => ident.sym.to_string(),
                  Some(ModuleExportName::Str(str)) => str.value.to_string_lossy().into_owned(),
                  None => named.local.sym.to_string(),
                };
                self
                  .imports
                  .push((named.local.to_id(), source.clone(), imported));
              }
              ImportSpecifier::Default(default) => {
                self
                  .imports
                  .push((default.local.to_id(), source.clone(), "default".to_string()));
              }
              ImportSpecifier::Namespace(_) => {}
            }
          }
        }
        ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) => match &export.decl {
          Decl::Fn(fn_decl) => {
            self
              .exports
              .push((fn_decl.ident.to_id(), fn_decl.ident.sym.to_string()));
          }
          Decl::Var(var) => {
            for declarator in &var.decls {
              if let Pat::Ident(ident) = &declarator.name {
                self
                  .exports
                  .push((ident.id.to_id(), ident.id.sym.to_string()));
              }
            }
          }
          _ => {}
        },
        ModuleItem::ModuleDecl(ModuleDecl::ExportDefaultDecl(export)) => {
          if let DefaultDecl::Fn(FnExpr {
            ident: Some(ident), ..
          }) = &export.decl
          {
            self.exports.push((ident.to_id(), "default".to_string()));
          }
        }
        ModuleItem::ModuleDecl(ModuleDecl::ExportNamed(export)) if export.src.is_none() => {
          for specifier in &export.specifiers {
            if let ExportSpecifier::Named(named) = specifier {
              if let ModuleExportName::Ident(local) = &named.orig {
                let exported = match &named.exported {
                  Some(ModuleExportName::Ident(ident)) => ident.sym.to_string(),
                  Some(ModuleExportName::Str(str)) => str.value.to_string_lossy().into_owned(),
                  None => local.sym.to_string(),
                };
                self.exports.push((local.to_id(), exported));
              }
            }
          }
        }
        _ => {}
      }
    }
  }

  /// `root.render(<MainThread>…</MainThread>)` — the declaration that the
  /// wrapped subtree is the main thread's first frame.
  fn visit_root_render(&mut self, call: &CallExpr) {
    let Callee::Expr(callee) = &call.callee else {
      return;
    };
    let Expr::Member(MemberExpr {
      prop: MemberProp::Ident(prop),
      ..
    }) = &**callee
    else {
      return;
    };
    if prop.sym != *"render" {
      return;
    }
    let Some(first) = call.args.first() else {
      return;
    };
    if first.spread.is_some() {
      return;
    }
    let Expr::JSXElement(element) = &*first.expr else {
      return;
    };
    let JSXElementName::Ident(name) = &element.opening.name else {
      return;
    };
    // Only a `MainThread` imported from `@lynx-js/react` (or a subpath of it)
    // is the boundary; a same-named local component is not.
    match self.lookup_import(name) {
      Some((source, imported))
        if imported == MAIN_THREAD_BOUNDARY
          && (source == REACT_PACKAGE || source.starts_with(&format!("{REACT_PACKAGE}/"))) => {}
      _ => return,
    }

    let island = element.children.iter().find_map(|child| match child {
      JSXElementChild::JSXElement(child) => match &child.opening.name {
        JSXElementName::Ident(ident) => Some(ident.clone()),
        _ => None,
      },
      _ => None,
    });

    let Some(island) = island else {
      self.warn_root_island(
        "The root <MainThread> has no component child to render on the first frame.",
      );
      return;
    };

    // A host element (`<view>`, `<text>`, …) is not an island: it has no
    // render body to compile into the main-thread layer. The static
    // `fallback` channel already paints those.
    if !island
      .sym
      .chars()
      .next()
      .is_some_and(|c| c.is_ascii_uppercase())
    {
      self.warn_root_island(&format!(
        "The root <MainThread> wraps the host element <{}>. Wrap a component marked with the '{}' directive instead, or declare the static markup through <Background fallback>.",
        island.sym, MAIN_THREAD_COMPONENT_DIRECTIVE,
      ));
      return;
    }

    let (source, imported) = match self.lookup_import(&island) {
      Some((source, imported)) => (Some(source), Some(imported)),
      None => (None, None),
    };

    if let Some(collector) = &self.collector {
      let mut info = collector.borrow_mut();
      // One render root per module: the first declaration wins, exactly like
      // the root `<Background>` fallback.
      if info.root_island.is_none() {
        info.root_island = Some(RootMainThreadIsland {
          source,
          imported,
          local: island.sym.to_string(),
        });
      }
    }
  }

  fn warn_root_island(&mut self, message: &str) {
    if let Some(collector) = &self.collector {
      let mut info = collector.borrow_mut();
      if info.root_island_warning.is_none() {
        info.root_island_warning = Some(message.to_string());
      }
    }
  }
}

impl VisitMut for MainThreadComponentVisitor {
  fn visit_mut_module(&mut self, module: &mut Module) {
    self.collect_bindings(module);
    module.visit_mut_children_with(self);
  }

  fn visit_mut_fn_decl(&mut self, node: &mut FnDecl) {
    if node
      .function
      .body
      .as_mut()
      .map(Self::take_directive)
      .unwrap_or(false)
    {
      let ident = node.ident.clone();
      self.report_component(&ident);
    }
    node.visit_mut_children_with(self);
  }

  fn visit_mut_var_declarator(&mut self, node: &mut VarDeclarator) {
    if let (Pat::Ident(name), Some(init)) = (&node.name, &mut node.init) {
      if Self::take_directive_from_expr(init) {
        let ident = name.id.clone();
        self.report_component(&ident);
      }
    }
    node.visit_mut_children_with(self);
  }

  fn visit_mut_export_default_decl(&mut self, node: &mut ExportDefaultDecl) {
    if let DefaultDecl::Fn(FnExpr { ident, function }) = &mut node.decl {
      if function
        .body
        .as_mut()
        .map(Self::take_directive)
        .unwrap_or(false)
      {
        let name = ident
          .as_ref()
          .map(|ident| ident.sym.to_string())
          .unwrap_or_else(|| "default".to_string());
        if let Some(collector) = &self.collector {
          collector.borrow_mut().components.push(MainThreadComponent {
            name,
            exported: Some("default".to_string()),
          });
        }
      }
    }
    node.visit_mut_children_with(self);
  }

  fn visit_mut_call_expr(&mut self, node: &mut CallExpr) {
    self.visit_root_render(node);
    node.visit_mut_children_with(self);
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use swc_core::common::{sync::Lrc, FileName, Mark, SourceMap};
  use swc_core::ecma::parser::{parse_file_as_module, EsSyntax, Syntax};
  use swc_core::ecma::transforms::base::resolver;
  use swc_core::ecma::visit::visit_mut_pass;
  use swc_core::ecma::visit::VisitMutWith;

  fn run(source: &str) -> (MainThreadIslandInfo, Module) {
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(FileName::Real("test.jsx".into()).into(), source.to_string());
    let mut module = parse_file_as_module(
      &fm,
      Syntax::Es(EsSyntax {
        jsx: true,
        ..Default::default()
      }),
      Default::default(),
      None,
      &mut vec![],
    )
    .expect("parse");

    swc_core::common::GLOBALS.set(&Default::default(), || {
      module.visit_mut_with(&mut resolver(Mark::new(), Mark::new(), false));
      let collector: MainThreadIslandCollector = Default::default();
      let mut pass = visit_mut_pass(MainThreadComponentVisitor::new(collector.clone()));
      use swc_core::ecma::ast::Pass;
      let mut program = Program::Module(module);
      pass.process(&mut program);
      let info = collector.borrow().clone();
      let Program::Module(module) = program else {
        unreachable!()
      };
      (info, module)
    })
  }

  #[test]
  fn marks_an_exported_function_component() {
    let (info, module) = run(
      r#"
      export function Header() {
        'main thread component';
        return <view />;
      }
      "#,
    );
    assert_eq!(
      info.components,
      vec![MainThreadComponent {
        name: "Header".into(),
        exported: Some("Header".into())
      }]
    );
    // The directive is stripped from the emitted body.
    let ModuleItem::ModuleDecl(ModuleDecl::ExportDecl(export)) = &module.body[0] else {
      panic!("expected an export decl");
    };
    let Decl::Fn(fn_decl) = &export.decl else {
      panic!("expected a function decl");
    };
    assert_eq!(fn_decl.function.body.as_ref().unwrap().stmts.len(), 1);
  }

  #[test]
  fn marks_an_arrow_component_exported_separately() {
    let (info, _) = run(
      r#"
      const Header = () => {
        'main thread component';
        return null;
      };
      export { Header as PageHeader };
      "#,
    );
    assert_eq!(
      info.components,
      vec![MainThreadComponent {
        name: "Header".into(),
        exported: Some("PageHeader".into())
      }]
    );
  }

  #[test]
  fn ignores_the_worklet_directive() {
    let (info, _) = run(
      r#"
      export function onTap() {
        'main thread';
        return null;
      }
      "#,
    );
    assert!(info.components.is_empty());
  }

  #[test]
  fn resolves_a_root_main_thread_island() {
    let (info, _) = run(
      r#"
      import { root, MainThread } from '@lynx-js/react';
      import { Shell } from './Shell.js';
      root.render(<MainThread fallback={<view />}><Shell /></MainThread>);
      "#,
    );
    assert_eq!(
      info.root_island,
      Some(RootMainThreadIsland {
        source: Some("./Shell.js".into()),
        imported: Some("Shell".into()),
        local: "Shell".into(),
      })
    );
    assert_eq!(info.root_island_warning, None);
  }

  #[test]
  fn ignores_a_main_thread_boundary_from_another_package() {
    let (info, _) = run(
      r#"
      import { MainThread } from './my-ui.js';
      import { Shell } from './Shell.js';
      root.render(<MainThread><Shell /></MainThread>);
      "#,
    );
    assert_eq!(info.root_island, None);
  }

  #[test]
  fn warns_when_the_root_boundary_wraps_a_host_element() {
    let (info, _) = run(
      r#"
      import { MainThread } from '@lynx-js/react';
      root.render(<MainThread><view /></MainThread>);
      "#,
    );
    assert_eq!(info.root_island, None);
    assert!(info.root_island_warning.is_some());
  }

  #[test]
  fn resolves_a_default_imported_island() {
    let (info, _) = run(
      r#"
      import { MainThread } from '@lynx-js/react/internal';
      import Shell from './Shell.js';
      root.render(<MainThread><Shell /></MainThread>);
      "#,
    );
    assert_eq!(
      info.root_island,
      Some(RootMainThreadIsland {
        source: Some("./Shell.js".into()),
        imported: Some("default".into()),
        local: "Shell".into(),
      })
    );
  }
}
