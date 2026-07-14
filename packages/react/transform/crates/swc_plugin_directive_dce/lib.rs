use serde::Deserialize;
use std::fmt::Debug;
use swc_core::{
  common::{errors::HANDLER, Span, DUMMY_SP},
  ecma::{
    ast::*,
    visit::{Visit, VisitMut, VisitMutWith, VisitWith},
  },
};

use swc_plugins_shared::target::TransformTarget;

#[cfg(feature = "napi")]
pub mod napi;

trait Eliminate {
  fn eliminate(&mut self);
}

impl Eliminate for Function {
  fn eliminate(&mut self) {
    // TODO(hongzhiyuan.hzy): don't change `length` of function
    self.params.clear();
    if let Some(body) = &mut self.body {
      body.stmts.clear();
    }
  }
}

impl Eliminate for ArrowExpr {
  fn eliminate(&mut self) {
    // TODO(hongzhiyuan.hzy): don't change `length` of function
    self.params.clear();
    match &mut *self.body {
      BlockStmtOrExpr::BlockStmt(block) => block.stmts.clear(),
      // Expression-bodied arrow (`() => <jsx/>`): drop the JSX by replacing the
      // body with `null`, so the elements/components it referenced become
      // unreferenced and are shaken from the main-thread bundle.
      BlockStmtOrExpr::Expr(expr) => {
        *expr = Box::new(Expr::Lit(Lit::Null(Null { span: DUMMY_SP })));
      }
    }
  }
}

/// Whether an expression in return position evaluates to JSX. Unwraps the
/// shapes a render commonly returns (parenthesized, ternary, `&&`/`||`,
/// sequence) but treats anything else — notably a call like
/// `root.render(<App/>)`, where JSX is only an *argument* — as not-JSX.
fn expr_is_jsx(e: &Expr) -> bool {
  match e {
    Expr::JSXElement(_) | Expr::JSXFragment(_) => true,
    Expr::Paren(p) => expr_is_jsx(&p.expr),
    Expr::Cond(c) => expr_is_jsx(&c.cons) || expr_is_jsx(&c.alt),
    Expr::Bin(b) if matches!(b.op, BinaryOp::LogicalAnd | BinaryOp::LogicalOr) => {
      expr_is_jsx(&b.left) || expr_is_jsx(&b.right)
    }
    Expr::Seq(s) => s.exprs.last().is_some_and(|e| expr_is_jsx(e)),
    _ => false,
  }
}

/// Detects whether a function-like *returns* JSX, i.e. it is a component render.
/// It deliberately does NOT descend into nested functions, so:
/// - a render is identified by the JSX it returns (not JSX merely passed to a
///   call, so `() => root.render(<App/>)` is not a component), and
/// - the generated snapshot `create`/`update` and worklet closures (which
///   return element-PAPI arrays / nothing, never JSX) are never mistaken for
///   components.
#[derive(Default)]
struct ReturnsJsxFinder {
  found: bool,
}

impl Visit for ReturnsJsxFinder {
  fn visit_return_stmt(&mut self, n: &ReturnStmt) {
    if let Some(arg) = &n.arg {
      if expr_is_jsx(arg) {
        self.found = true;
      }
    }
  }
  fn visit_function(&mut self, _: &Function) {}
  fn visit_arrow_expr(&mut self, _: &ArrowExpr) {}
}

fn block_returns_jsx(block: &BlockStmt) -> bool {
  let mut finder = ReturnsJsxFinder::default();
  block.visit_with(&mut finder);
  finder.found
}

#[derive(Deserialize, Clone, Debug, PartialEq)]
pub struct DirectiveDCEVisitorConfig {
  /// @internal
  pub target: TransformTarget,
  /// When `true` on the `LEPUS` target, empties the render body of every
  /// component (a function-like whose own body contains JSX), while keeping the
  /// module-scope snapshot and worklet definitions. This is how a root-level
  /// `<Background>` (or the explicit main-thread-render opt-out) keeps all
  /// component render logic out of the main-thread bundle without per-component
  /// annotation.
  /// @internal
  #[serde(default)]
  pub strip_all_components: bool,
}

impl Default for DirectiveDCEVisitorConfig {
  fn default() -> Self {
    DirectiveDCEVisitorConfig {
      target: TransformTarget::MIXED,
      strip_all_components: false,
    }
  }
}

pub struct DirectiveDCEVisitor {
  opts: DirectiveDCEVisitorConfig,
}

impl DirectiveDCEVisitor {
  pub fn new(opts: DirectiveDCEVisitorConfig) -> Self {
    DirectiveDCEVisitor { opts }
  }

  /// Whether "strip every component render body" is active for this pass.
  fn strip_all_active(&self) -> bool {
    self.opts.strip_all_components && self.opts.target == TransformTarget::LEPUS
  }

  fn should_eliminate(&self, n: &BlockStmt) -> (bool, Option<Span>) {
    let BlockStmt { stmts, .. } = n;
    if !stmts.is_empty() {
      match &stmts[0] {
        Stmt::Expr(ExprStmt { expr, span }) => match &**expr {
          Expr::Lit(Lit::Str(str)) => match str.value.to_string_lossy().as_ref() {
            "use js only" | "background only" | "background-only" => {
              (self.opts.target == TransformTarget::LEPUS, Some(*span))
            }
            // directive "main thread" is already handled by `worklet_plugin`, do nothing here
            "use lepus only" => (self.opts.target == TransformTarget::JS, Some(*span)),
            _ => (false, None),
          },
          _ => (false, None),
        },
        _ => (false, None),
      }
    } else {
      (false, None)
    }
  }
}

impl VisitMut for DirectiveDCEVisitor {
  fn visit_mut_class_member(&mut self, n: &mut ClassMember) {
    match n {
      ClassMember::Constructor(ctor) => {
        // TODO(hongzhiyuan.hzy): make this configurable
        match &ctor.body {
          None => {}
          Some(stmt) => {
            let (_, span) = self.should_eliminate(stmt);
            if let Some(span) = span {
              HANDLER.with(|handler| {
                handler
                  .struct_span_warn(span, "directive inside constructor is not allowed")
                  .emit();
              });
            }
          }
        };

        n.visit_mut_children_with(self);
      }

      ClassMember::Method(ClassMethod {
        function,
        kind: MethodKind::Getter,
        ..
      })
      | ClassMember::Method(ClassMethod {
        function,
        kind: MethodKind::Setter,
        ..
      })
      | ClassMember::PrivateMethod(PrivateMethod {
        function,
        kind: MethodKind::Getter,
        ..
      })
      | ClassMember::PrivateMethod(PrivateMethod {
        function,
        kind: MethodKind::Setter,
        ..
      }) => {
        // TODO(hongzhiyuan.hzy): make this configurable
        match &function.body {
          None => {}
          Some(stmt) => {
            let (_, span) = self.should_eliminate(stmt);
            if let Some(span) = span {
              HANDLER.with(|handler| {
                handler
                  .struct_span_warn(span, "directive inside getter/setter is ignored")
                  .emit();
              });
            }
          }
        }

        n.visit_mut_children_with(self);
      }

      ClassMember::Method(ClassMethod { function, .. })
      | ClassMember::PrivateMethod(PrivateMethod { function, .. }) => match &function.body {
        None => {}
        Some(stmt) => {
          let should_eliminate =
            self.should_eliminate(stmt).0 || (self.strip_all_active() && block_returns_jsx(stmt));
          // if should_eliminate, then clear the body
          if should_eliminate {
            function.eliminate();
          }

          n.visit_mut_children_with(self);
        }
      },

      _ => {
        n.visit_mut_children_with(self);
      }
    };
  }

  fn visit_mut_fn_decl(&mut self, n: &mut FnDecl) {
    let function = &mut n.function;
    let should_eliminate = match &function.body {
      None => false,
      Some(stmt) => {
        self.should_eliminate(stmt).0 || (self.strip_all_active() && block_returns_jsx(stmt))
      }
    };

    // if should_eliminate, then clear the body and params
    if should_eliminate {
      function.eliminate();
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
    let should_eliminate = match &*arrow.body {
      BlockStmtOrExpr::BlockStmt(body) => {
        self.should_eliminate(body).0 || (self.strip_all_active() && block_returns_jsx(body))
      }
      // Expression-bodied arrows carry no directive prologue, so only the
      // strip-all mode (a component written as `const App = () => <view/>`)
      // targets them.
      BlockStmtOrExpr::Expr(expr) => self.strip_all_active() && expr_is_jsx(expr),
    };

    // if should_eliminate, then clear the body
    if should_eliminate {
      arrow.eliminate();
    }

    arrow.visit_mut_children_with(self);
  }

  fn visit_mut_fn_expr(&mut self, n: &mut FnExpr) {
    let should_eliminate = match &n.function.body {
      None => false,
      Some(stmt) => {
        self.should_eliminate(stmt).0 || (self.strip_all_active() && block_returns_jsx(stmt))
      }
    };

    // if should_eliminate, then clear the body
    if should_eliminate {
      n.function.eliminate();
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_prop(&mut self, n: &mut Prop) {
    match n {
      Prop::Method(MethodProp { function, .. }) => match &function.body {
        None => {}
        Some(stmt) => {
          let (should_eliminate, _) = self.should_eliminate(stmt);
          if should_eliminate {
            function.eliminate();
          }

          n.visit_mut_children_with(self);
        }
      },
      _ => {
        n.visit_mut_children_with(self);
      }
    }
  }
}

#[cfg(test)]
mod tests {
  use crate::{DirectiveDCEVisitor, DirectiveDCEVisitorConfig};
  use swc_core::{
    ecma::parser::Syntax,
    ecma::visit::visit_mut_pass,
    ecma::{parser::EsSyntax, transforms::testing::test},
  };
  use swc_plugins_shared::target::TransformTarget;

  // use crate::{DirectiveDCEVisitor, DirectiveDCEVisitorConfig};

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_js_only_but_keep_constructor,
    r#"
    class Test {
      constructor(props = function() { 'use js only'; console.log("js only") }) {
        'use js only';
        super(props);
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_js_only_class_method,
    r#"
    class Test {
      method() {
        'use js only';
        console.log("js only");
      }
      #privateMethod() {
        'use js only';
        console.log("js only");
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_js_only_class_property,
    r#"
    class Test {
      method = () => {
        'use js only';
        console.log("js only");
      }
      #privateMethod = () => {
        'use js only';
        console.log("js only");
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_js_only_embedded,
    r#"
    function keepMe(arg1, arg2) {
      function eliminateMe(a1, a2, a3, ...a4) {
        'use js only';
        console.log("js only");
      }
    }

    function keepMe2(arg1 = function() { 'use js only'; console.log("js only") }) {}
    function keepMe3(arg1 = () => { 'use js only'; console.log("js only") }) {}
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::MIXED,
      strip_all_components: false,
    })),
    should_do_nothing_in_mixed_target,
    r#"
    function keepMe(arg1, arg2) {
      function eliminateMe(a1, a2, a3, ...a4) {
        'use js only';
        console.log("js only");
      }
    }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::MIXED,
      strip_all_components: false,
    })),
    should_do_nothing_when_arrow_function_return_directive,
    r#"
    const keepMe = () => 'use js only';
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_native_modules_in_default_params,
    r#"
    const keepMe = (call = NativeModules.bridge.call) => {
      'use js only'
      console.log(call)
    };
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_fn_body_in_component_props,
    r#"
      <ListItem
        onTap={() => {
          'background only'
          console.log('xxxx')
        }}
      />
    "#
  );

  test!(
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_fn_decl,
    r#"
      export default function useExposure(exposureArgs) {
        'background-only';
        console.log('useExposure');
      }
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_transpiled_async_arrow_with_background_only_generator,
    r#"
      export const openUrl = (a) => __awaiter(void 0, void 0, void 0, function* () {
        'background only';
        return open({ a });
      });
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_async_arrow_with_background_only_directive,
    r#"
      export const openUrl = async () => {
        'background only';
        return open({ a });
      };
    "#
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: false,
    })),
    should_eliminate_background_only_generator_forms,
    r#"
      function* gen(a) {
        'background only';
        yield a;
      }

      const obj = {
        *gen(a) {
          'background only';
          yield a;
        },
      };

      class Ad {
        *gen(a) {
          'background only';
          yield a;
        }
      }
    "#
  );
}
