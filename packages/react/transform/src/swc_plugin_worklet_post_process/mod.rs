use swc_core::ecma::ast::*;
use swc_core::ecma::visit::{noop_visit_mut_type, VisitMut, VisitMutWith};

pub struct WorkletPostProcessorVisitorResult {
  pub has_worklet: bool,
}

impl Default for WorkletPostProcessorVisitorResult {
  fn default() -> Self {
    WorkletPostProcessorVisitorResult { has_worklet: false }
  }
}

pub struct WorkletPostProcessorVisitor {
  pub result: WorkletPostProcessorVisitorResult,
}

impl Default for WorkletPostProcessorVisitor {
  fn default() -> Self {
    WorkletPostProcessorVisitor::new(WorkletPostProcessorVisitorResult { has_worklet: false })
  }
}

impl WorkletPostProcessorVisitor {
  pub fn new(result: WorkletPostProcessorVisitorResult) -> Self {
    return WorkletPostProcessorVisitor { result };
  }
}

impl VisitMut for WorkletPostProcessorVisitor {
  noop_visit_mut_type!();

  fn visit_mut_call_expr(&mut self, n: &mut CallExpr) {
    if self.result.has_worklet {
      return;
    }

    if let Callee::Expr(expr) = &n.callee {
      if let Expr::Ident(Ident { sym, .. }) = &**expr {
        if sym == "registerWorklet" {
          self.result.has_worklet = true;
        }
      }
    }

    n.visit_mut_children_with(self);
  }
}

#[cfg(test)]
mod tests {
  use crate::swc_plugin_worklet_post_process::WorkletPostProcessorVisitor;
  use swc_core::ecma::parser::TsSyntax;
  use swc_core::{
    ecma::parser::Syntax, ecma::transforms::testing::test, ecma::visit::visit_mut_pass,
  };

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| visit_mut_pass(WorkletPostProcessorVisitor::default()),
    should_transform_worklet,
    r#"
registerWorklet("57ba11b1", function(event) {
    const elementOnTextLayout = lynxWorkletImpl._workletMap["57ba11b1"].bind(this);
    let { _jsFn1 } = this._jsFn;
    "main thread";
    runOnBackground(_jsFn1)(true);
});
registerWorklet("57ba11b2", function(event) {
    const elementOnTextLayout2 = lynxWorkletImpl._workletMap["57ba11b2"].bind(this);
    let { _jsFn1 } = this._jsFn;
    "main thread";
    runOnBackground(_jsFn1)(true);
});
    "#
  );

  test!(
    module,
    Syntax::Typescript(TsSyntax {
      ..Default::default()
    }),
    |_| visit_mut_pass(WorkletPostProcessorVisitor::default()),
    should_transform_worklet_2,
    r#"
function f() {
  registerWorklet("57ba11b1", function(event) {
      const elementOnTextLayout = lynxWorkletImpl._workletMap["57ba11b1"].bind(this);
      let { _jsFn1 } = this._jsFn;
      "main thread";
      runOnBackground(_jsFn1)(true);
  });
  registerWorklet("57ba11b2", function(event) {
      const elementOnTextLayout2 = lynxWorkletImpl._workletMap["57ba11b2"].bind(this);
      let { _jsFn1 } = this._jsFn;
      "main thread";
      runOnBackground(_jsFn1)(true);
  });
}
    "#
  );
}
