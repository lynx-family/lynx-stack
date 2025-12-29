use std::fmt::Debug;
use swc_core::{
  common::{errors::HANDLER, Span},
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};

use swc_plugins_shared::target::TransformTarget;

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
    if let BlockStmtOrExpr::BlockStmt(block) = &mut *self.body {
      block.stmts.clear();
    }
  }
}

#[derive(Clone, Debug)]
pub struct DirectiveDCEVisitorConfig {
  /// @internal
  pub target: TransformTarget,
}

impl Default for DirectiveDCEVisitorConfig {
  fn default() -> Self {
    DirectiveDCEVisitorConfig {
      target: TransformTarget::MIXED,
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

  fn should_eliminate(&self, n: &BlockStmt) -> (bool, Option<Span>) {
    let BlockStmt { stmts, .. } = n;
    if !stmts.is_empty() {
      match &stmts[0] {
        Stmt::Expr(ExprStmt { expr, span }) => match &**expr {
          Expr::Lit(Lit::Str(str)) => match str.value.to_string().as_str() {
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
          let (should_eliminate, _) = self.should_eliminate(stmt);
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
      Some(stmt) => self.should_eliminate(stmt).0,
    };

    // if should_eliminate, then clear the body and params
    if should_eliminate {
      function.eliminate();
    }

    n.visit_mut_children_with(self);
  }

  fn visit_mut_arrow_expr(&mut self, arrow: &mut ArrowExpr) {
    if arrow.body.is_block_stmt() {
      let body = arrow.body.as_mut_block_stmt().unwrap();
      let (should_eliminate, _) = self.should_eliminate(body);

      // if should_eliminate, then clear the body
      if should_eliminate {
        arrow.eliminate();
      }

      arrow.visit_mut_children_with(self);
    }
  }

  fn visit_mut_fn_expr(&mut self, n: &mut FnExpr) {
    let should_eliminate = match &n.function.body {
      None => false,
      Some(stmt) => self.should_eliminate(stmt).0,
    };

    // if should_eliminate, then clear the body
    if should_eliminate {
      n.function.eliminate();
    }

    n.visit_mut_children_with(self);
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
    })),
    should_eliminate_fn_decl,
    r#"
      export default function useExposure(exposureArgs) {
        'background-only';
        console.log('useExposure');
      }
    "#
  );
}
