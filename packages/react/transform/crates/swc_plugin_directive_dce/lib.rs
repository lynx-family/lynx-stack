use rustc_hash::FxHashSet;
use serde::Deserialize;
use std::fmt::Debug;
use swc_core::{
  common::{errors::HANDLER, Span, SyntaxContext, DUMMY_SP},
  ecma::{
    ast::*,
    utils::collect_decls,
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
      // Expression-bodied arrow (`() => <jsx/>`): drop the JSX by replacing
      // the body with `null`. Logic-only references become unreferenced and
      // are shaken from the main-thread bundle; the *component* references the
      // body held are preserved separately (harvested before elimination into
      // the module-level keep-alive), because the modules they point at carry
      // the snapshot/worklet definitions hydration still needs.
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

/// The callee name of the module-level keep-alive probe emitted after
/// component bodies are emptied on the main thread:
///
/// ```js
/// typeof __ifrKeepComponentRefs === "function" && __ifrKeepComponentRefs(Feed, UI);
/// ```
///
/// No runtime ever defines it — the `typeof` guard makes the statement inert —
/// but a call to an unresolved global can never be proven side-effect free, so
/// the statement (and the component references it carries) survives every
/// later dead-code-elimination layer: this pipeline's `simplify::dce` (which
/// removes now-unused imports, `preserve_imports_with_side_effects: false`),
/// and the bundler's tree shaking. That keeps the referenced modules — and the
/// module-scope snapshot/worklet definitions hydration needs — in the
/// main-thread bundle even though the render bodies that referenced them are
/// gone.
pub const KEEP_COMPONENT_REFS_PROBE: &str = "__ifrKeepComponentRefs";

fn is_capitalized(sym: &str) -> bool {
  sym.chars().next().is_some_and(char::is_uppercase)
}

/// Collects the *component* references a render body holds, so a body about to
/// be emptied can hand them over to the module-level keep-alive instead of
/// severing them. Severed references let the unused-import DCE downstream drop
/// the referenced modules — and with them the hoisted snapshot/worklet
/// definitions that first-screen hydration still needs (the cross-module
/// hydration break of a whole-program strip).
///
/// "Component reference" is deliberately narrow, so logic-only imports (call
/// targets, hook arguments, …) still shake out of the main-thread bundle:
/// - a capitalized JSX element name (`<Feed/>`) — the JSX
///   intrinsic-vs-component convention, which also skips the hoisted
///   `__snapshot_*` element references, or
/// - the root object of a JSX member-expression name (`<UI.Card/>`; member
///   names are always components, whatever their casing), or
/// - a capitalized bare identifier used directly as a JSX attribute value
///   (`<Layout header={Header}/>` — a component passed as a prop).
///
/// It descends into nested functions (`items.map(it => <Card/>)` renders
/// `Card` all the same), unlike the `ReturnsJsxFinder` discriminator.
#[derive(Default)]
struct ComponentRefCollector {
  refs: Vec<Ident>,
}

impl ComponentRefCollector {
  fn push_component(&mut self, ident: &Ident) {
    self.refs.push(ident.clone());
  }
}

impl Visit for ComponentRefCollector {
  fn visit_jsx_element_name(&mut self, n: &JSXElementName) {
    match n {
      JSXElementName::Ident(ident) => {
        if is_capitalized(ident.sym.as_str()) {
          self.push_component(ident);
        }
      }
      JSXElementName::JSXMemberExpr(member) => {
        let mut obj = &member.obj;
        loop {
          match obj {
            JSXObject::Ident(ident) => {
              self.push_component(ident);
              break;
            }
            JSXObject::JSXMemberExpr(inner) => obj = &inner.obj,
          }
        }
      }
      JSXElementName::JSXNamespacedName(_) => {}
      #[cfg(swc_ast_unknown)]
      _ => {}
    }
  }

  fn visit_jsx_attr(&mut self, n: &JSXAttr) {
    if let Some(JSXAttrValue::JSXExprContainer(container)) = &n.value {
      if let JSXExpr::Expr(expr) = &container.expr {
        if let Expr::Ident(ident) = &**expr {
          if is_capitalized(ident.sym.as_str()) {
            self.push_component(ident);
          }
        }
      }
    }
    // Still descend: an attribute value may nest JSX (`fallback={<Spin/>}`).
    n.visit_children_with(self);
  }
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
  ///
  /// Emptying a body must not sever the component references it held: the
  /// modules they point at carry the snapshot/worklet definitions that
  /// first-screen hydration builds the real tree from. Every emptied body
  /// therefore hands its component references over to a module-level
  /// keep-alive statement (see [`KEEP_COMPONENT_REFS_PROBE`]), while its
  /// logic-only references still shake out.
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
  /// Component references harvested from bodies emptied on the `LEPUS` target,
  /// in source order, awaiting the module-level keep-alive flush.
  kept_refs: Vec<Ident>,
  /// Dedup index over `kept_refs` (`Id` = symbol + syntax context).
  kept_ref_ids: FxHashSet<Id>,
}

impl DirectiveDCEVisitor {
  pub fn new(opts: DirectiveDCEVisitorConfig) -> Self {
    DirectiveDCEVisitor {
      opts,
      kept_refs: Vec::new(),
      kept_ref_ids: FxHashSet::default(),
    }
  }

  /// Whether "strip every component render body" is active for this pass.
  fn strip_all_active(&self) -> bool {
    self.opts.strip_all_components && self.opts.target == TransformTarget::LEPUS
  }

  /// Harvest the component references of a function-like that is about to be
  /// eliminated, minus the bindings local to it (a body-local component dies
  /// with the body — there is nothing left to reference).
  ///
  /// Only the `LEPUS` target harvests: an eliminated body's component subtree
  /// still hydrates on the main thread (background render → main-thread
  /// element construction through the module-scope snapshot/worklet
  /// definitions), so those modules must stay referenced there. On the `JS`
  /// target (`'use lepus only'` elimination) no such obligation exists.
  fn harvest_component_refs<N>(&mut self, n: &N)
  where
    N: VisitWith<ComponentRefCollector> + VisitWith<swc_core::ecma::utils::BindingCollector<Id>>,
  {
    if self.opts.target != TransformTarget::LEPUS {
      return;
    }
    let mut collector = ComponentRefCollector::default();
    n.visit_with(&mut collector);
    if collector.refs.is_empty() {
      return;
    }
    let locals: FxHashSet<Id> = collect_decls(n);
    for ident in collector.refs {
      let id = ident.to_id();
      if locals.contains(&id) {
        continue;
      }
      if self.kept_ref_ids.insert(id) {
        self.kept_refs.push(ident);
      }
    }
  }

  /// Append the keep-alive statement carrying every harvested component
  /// reference of this module:
  ///
  /// ```js
  /// typeof __ifrKeepComponentRefs === "function" && __ifrKeepComponentRefs(Feed, UI);
  /// ```
  ///
  /// Inert at runtime (the probe is never defined), un-eliminable at compile
  /// time (a call to an unresolved global is never provably pure) — see
  /// [`KEEP_COMPONENT_REFS_PROBE`].
  fn flush_kept_refs(&mut self) -> Option<Stmt> {
    if self.kept_refs.is_empty() {
      return None;
    }
    self.kept_ref_ids.clear();
    let probe = Ident::new(
      KEEP_COMPONENT_REFS_PROBE.into(),
      DUMMY_SP,
      SyntaxContext::empty(),
    );
    let probe_is_function = Expr::Bin(BinExpr {
      span: DUMMY_SP,
      op: BinaryOp::EqEqEq,
      left: Box::new(Expr::Unary(UnaryExpr {
        span: DUMMY_SP,
        op: UnaryOp::TypeOf,
        arg: Box::new(Expr::Ident(probe.clone())),
      })),
      right: Box::new(Expr::Lit(Lit::Str(Str {
        span: DUMMY_SP,
        value: "function".into(),
        raw: None,
      }))),
    });
    let keep_call = Expr::Call(CallExpr {
      span: DUMMY_SP,
      ctxt: SyntaxContext::empty(),
      callee: Callee::Expr(Box::new(Expr::Ident(probe))),
      args: self
        .kept_refs
        .drain(..)
        .map(|ident| ExprOrSpread {
          spread: None,
          expr: Box::new(Expr::Ident(ident)),
        })
        .collect(),
      type_args: None,
    });
    Some(Stmt::Expr(ExprStmt {
      span: DUMMY_SP,
      expr: Box::new(Expr::Bin(BinExpr {
        span: DUMMY_SP,
        op: BinaryOp::LogicalAnd,
        left: Box::new(probe_is_function),
        right: Box::new(keep_call),
      })),
    }))
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
            self.harvest_component_refs(&**function);
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
      self.harvest_component_refs(&*n.function);
      n.function.eliminate();
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
      self.harvest_component_refs(&*arrow);
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
      self.harvest_component_refs(&*n.function);
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
            self.harvest_component_refs(&**function);
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

  fn visit_mut_module(&mut self, n: &mut Module) {
    n.visit_mut_children_with(self);
    if let Some(stmt) = self.flush_kept_refs() {
      n.body.push(ModuleItem::Stmt(stmt));
    }
  }

  fn visit_mut_script(&mut self, n: &mut Script) {
    n.visit_mut_children_with(self);
    if let Some(stmt) = self.flush_kept_refs() {
      n.body.push(stmt);
    }
  }
}

#[cfg(test)]
mod tests {
  use crate::{DirectiveDCEVisitor, DirectiveDCEVisitorConfig};
  use swc_core::{
    common::Mark,
    ecma::parser::Syntax,
    ecma::transforms::base::resolver,
    ecma::transforms::optimization::{simplifier, simplify},
    ecma::visit::visit_mut_pass,
    ecma::{parser::EsSyntax, transforms::testing::test},
  };
  use swc_plugins_shared::target::TransformTarget;

  // use crate::{DirectiveDCEVisitor, DirectiveDCEVisitorConfig};

  // ---------------------------------------------------------------------------
  // Keep-alive component references: emptying a body must not sever the
  // component references it held (their modules carry the snapshot/worklet
  // definitions first-screen hydration needs), while logic-only references
  // must still shake out.
  // ---------------------------------------------------------------------------

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
      target: TransformTarget::LEPUS,
      strip_all_components: true,
    })),
    strip_all_components_keeps_cross_module_component_refs,
    r#"
    import { Feed } from './Feed.jsx';
    import { Header } from './Header.jsx';
    import * as UI from './ui.jsx';
    import { formatFeed } from './heavy-format.js';

    export function App() {
      const items = formatFeed(1, 2, 3);
      const Local = () => <text>local</text>;
      return (
        <view>
          <Feed />
          <Feed />
          <UI.Card />
          <Local />
          {items.map((it) => <Header key={it} />)}
        </view>
      );
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
      strip_all_components: true,
    })),
    strip_all_components_keeps_component_valued_attr_refs,
    r#"
    import { Layout } from './Layout.jsx';
    import { Hero } from './Hero.jsx';

    export const Page = () => <Layout header={Hero} />;
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
      strip_all_components: true,
    })),
    strip_all_components_emits_no_keep_alive_without_component_refs,
    r#"
    export function App() {
      return (
        <view>
          <text>host elements only</text>
        </view>
      );
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
    background_only_component_keeps_child_component_refs,
    r#"
    import { Wrapped } from './Wrapped.jsx';

    export function Card() {
      'background only';
      return <Wrapped />;
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
      target: TransformTarget::JS,
      strip_all_components: false,
    })),
    lepus_only_elimination_on_js_target_emits_no_keep_alive,
    r#"
    import { Gadget } from './Gadget.jsx';

    export function lepusOnly() {
      'use lepus only';
      return <Gadget />;
    }
    "#
  );

  // The regression proof for the cross-module hydration break: compose the
  // strip with the same `simplify::dce` configuration the real pipeline runs
  // right after it (`preserve_imports_with_side_effects: false` — the pass
  // that severed the child modules). The keep-alive must carry the component
  // import through, while the logic-only import still shakes out.
  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |_| {
      let unresolved_mark = Mark::new();
      let top_level_mark = Mark::new();
      (
        resolver(unresolved_mark, top_level_mark, true),
        visit_mut_pass(DirectiveDCEVisitor::new(DirectiveDCEVisitorConfig {
          target: TransformTarget::LEPUS,
          strip_all_components: true,
        })),
        simplifier(
          top_level_mark,
          simplify::Config {
            dce: simplify::dce::Config {
              preserve_imports_with_side_effects: false,
              ..Default::default()
            },
            ..Default::default()
          },
        ),
      )
    },
    strip_keep_alive_survives_simplify_dce,
    r#"
    import { Feed } from './Feed.jsx';
    import { formatFeed } from './heavy-format.js';

    export function App() {
      const items = formatFeed(1, 2, 3);
      return (
        <view>
          <Feed items={items} />
        </view>
      );
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
