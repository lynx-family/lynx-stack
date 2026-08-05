//! The compile-time half of a main-thread island.
//!
//! `'main thread component'` is the definition-site marker of an island. It
//! is the symmetric twin of `'background only'`: instead of keeping a
//! component's render body *out* of the main-thread bundle, it pulls the
//! whole module *into* the main-thread layer, so the component can render on
//! the first frame even when the main thread otherwise compiles only what a
//! root first-screen boundary reaches (`enableMTSRendering: false`).
//!
//! This pass only *reports* (and strips the directive) — no codegen happens
//! here; the build turns the report into an extra main-thread entry.
//!
//! The marker string is `"main thread component"` and not `"main thread"`:
//! a component is a function, and `"main thread"` already means *worklet* to
//! `swc_plugin_worklet` (`WorkletType::from_directive`, exact match). The two
//! never collide.
//!
//! This pass must run before the worklet transform, which inspects the same
//! directive prologue.

use std::cell::RefCell;
use std::rc::Rc;

use swc_core::ecma::{
  ast::*,
  visit::{VisitMut, VisitMutWith},
};

/// The definition-site marker of a main-thread component.
pub const MAIN_THREAD_COMPONENT_DIRECTIVE: &str = "main thread component";

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

/// Everything this pass learned about one module.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MainThreadIslandInfo {
  pub components: Vec<MainThreadComponent>,
}

pub type MainThreadIslandCollector = Rc<RefCell<MainThreadIslandInfo>>;

#[derive(Default)]
pub struct MainThreadComponentVisitor {
  collector: Option<MainThreadIslandCollector>,

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
  fn marks_a_default_exported_component() {
    let (info, _) = run(
      r#"
      export default function Header() {
        'main thread component';
        return null;
      }
      "#,
    );
    assert_eq!(
      info.components,
      vec![MainThreadComponent {
        name: "Header".into(),
        exported: Some("default".into())
      }]
    );
  }

  #[test]
  fn only_matches_the_first_statement() {
    // A directive prologue is the first statement or nothing; anything else
    // is an ordinary string expression the author did not mean as a marker.
    let (info, _) = run(
      r#"
      export function Header() {
        const x = 1;
        'main thread component';
        return null;
      }
      "#,
    );
    assert!(info.components.is_empty());
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
}
