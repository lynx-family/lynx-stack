use regex::Regex;
use swc_core::{
  common::{
    comments::{Comment, CommentKind, Comments},
    DUMMY_SP,
  },
  ecma::{
    ast::*,
    visit::{VisitMut, VisitMutWith},
  },
};
use swc_plugins_shared::utils::calc_hash;

pub mod napi;

/// CSSScope refers to the
///
/// - `CSSScope::All`: Similar to setting `enableRemoveCSSScope: false`. All CSS files are treated as scoped CSS.
///   This option is typically used for migrating from ReactLynx2.
/// - `CSSScope::None`: Similar to setting `enableRemoveCSSScope: true`. All CSS files are treated as global CSS.
///   This option is typically used for early ReactLynx3 projects.
/// - `CSSScope::Modules`: Only CSS Modules are treated as scoped CSS.
///   This is the recommended approach for writing CSS in ReactLynx.
///   Note that we do not determinate which file is CSS Modules by filename(e.g.: `css-loader` has `modules.auto` option).
///   Instead, we use import types to determinate if the imported CSS is a module.
///   - A sideEffects import(`import './foo.module.css`) is not considered as a CSS Module. Even it has `.module.` in filename.
///   - A named/namespace/default import is considered as a CSS Module. No matter what the `css-loader` options is given.
#[derive(Clone, Copy, Debug)]
pub enum CSSScope {
  All,
  None,
  Modules,
}

#[derive(Clone, Debug)]
pub struct CSSScopeVisitorConfig {
  pub mode: CSSScope,
  pub filename: String,
}

impl Default for CSSScopeVisitorConfig {
  fn default() -> Self {
    CSSScopeVisitorConfig {
      mode: CSSScope::None,
      filename: "index.jsx".into(),
    }
  }
}

pub struct CSSScopeVisitor<C>
where
  C: Comments,
{
  cfg: CSSScopeVisitorConfig,
  comments: Option<C>,
  css_id: usize,
  has_jsx: bool,
}

impl<C> CSSScopeVisitor<C>
where
  C: Comments,
{
  pub fn new(cfg: CSSScopeVisitorConfig, comments: Option<C>) -> Self {
    CSSScopeVisitor {
      css_id: usize::from_str_radix(&calc_hash(&cfg.filename), 16).expect("should have css id")
        + 1e6 as usize,
      comments,
      cfg,
      has_jsx: false,
    }
  }
}

impl<C> VisitMut for CSSScopeVisitor<C>
where
  C: Comments,
{
  fn visit_mut_expr(&mut self, n: &mut Expr) {
    if matches!(n, Expr::JSXElement(_) | Expr::JSXFragment(_)) {
      self.has_jsx = true;
      return;
    }
    n.visit_mut_children_with(self);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    if matches!(self.cfg.mode, CSSScope::None) {
      return;
    }

    n.visit_mut_children_with(self);

    if !self.has_jsx {
      return;
    }

    let import_decls = n
      .body
      .iter_mut()
      .filter_map(|module_item| {
        if let ModuleItem::ModuleDecl(ModuleDecl::Import(import_decl)) = module_item {
          return Some(import_decl);
        }
        None
      })
      .collect::<Vec<_>>();

    let mut has_css_import = false;
    let re = Regex::new(r"\.(scss|sass|css|less)$").unwrap();

    for import_decl in import_decls {
      if matches!(self.cfg.mode, CSSScope::Modules) && import_decl.specifiers.is_empty() {
        continue;
      }

      if re.is_match(import_decl.src.value.to_string().as_str()) {
        import_decl.src = Box::new(Str {
          span: import_decl.src.span,
          raw: None,
          value: format!("{}?cssId={}", import_decl.src.value, self.css_id).into(),
        });
        has_css_import = true;
      }
    }

    if has_css_import && matches!(self.cfg.mode, CSSScope::Modules | CSSScope::All) {
      self.comments.add_leading(
        n.span.lo,
        Comment {
          span: DUMMY_SP,
          kind: CommentKind::Block,
          text: format!("@jsxCSSId {}", self.css_id).into(),
        },
      );
    }
  }
}

#[cfg(test)]
mod tests {
  use swc_core::ecma::{
    parser::{EsSyntax, Syntax},
    transforms::testing::test,
    visit::visit_mut_pass,
  };

  use super::CSSScopeVisitor;
  use super::{CSSScope, CSSScopeVisitorConfig};

  const IMPORTS: &str = r#"
  import './foo.css'
  import styles from './bar.css'
  import * as styles2 from '@fancy-ui/main.css'
  import { clsA, clsB } from './baz.module.css'
  const jsx = <view className={`foo ${styles.bar} ${styles2.baz} ${clsA} ${clsB}`} />
  "#;

  const IMPORTS_WITHOUT_JSX: &str = r#"
  import './foo.css'
  import styles from './bar.css'
  import * as styles2 from '@fancy-ui/main.css'
  import { clsA, clsB } from './baz.module.css'
  "#;

  test!(
    // TODO(wangqingyu): deal with src that already have query(`?`)
    ignore,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      CSSScopeVisitorConfig {
        mode: CSSScope::All,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_all_transform_imports_with_query,
    IMPORTS
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      super::CSSScopeVisitorConfig {
        mode: CSSScope::None,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_none_transform_imports,
    IMPORTS
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      super::CSSScopeVisitorConfig {
        mode: CSSScope::None,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_none_transform_imports_without_jsx,
    IMPORTS_WITHOUT_JSX
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      super::CSSScopeVisitorConfig {
        mode: CSSScope::All,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_all_transform_imports,
    IMPORTS
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      super::CSSScopeVisitorConfig {
        mode: CSSScope::All,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_all_transform_imports_without_jsx,
    IMPORTS_WITHOUT_JSX
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      super::CSSScopeVisitorConfig {
        mode: CSSScope::Modules,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_modules_transform_imports,
    IMPORTS
  );

  test!(
    module,
    Syntax::Es(EsSyntax {
      jsx: true,
      ..Default::default()
    }),
    |t| visit_mut_pass(CSSScopeVisitor::new(
      super::CSSScopeVisitorConfig {
        mode: CSSScope::Modules,
        ..Default::default()
      },
      Some(t.comments.clone()),
    )),
    scoped_modules_transform_imports_without_jsx,
    IMPORTS_WITHOUT_JSX
  );
}
