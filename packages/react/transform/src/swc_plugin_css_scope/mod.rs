use crate::calc_hash;
use napi_derive::napi;
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

impl napi::bindgen_prelude::FromNapiValue for CSSScope {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let val = <&str>::from_napi_value(env, napi_val).map_err(|e| {
      napi::bindgen_prelude::error!(
        e.status,
        "Failed to convert napi value into enum `{}`. {}",
        "RemoveCSSScope",
        e,
      )
    })?;
    match val {
      "all" => Ok(CSSScope::All),
      "none" => Ok(CSSScope::None),
      "modules" => Ok(CSSScope::Modules),
      _ => Err(napi::bindgen_prelude::error!(
        napi::bindgen_prelude::Status::InvalidArg,
        "value `{}` does not match any variant of enum `{}`",
        val,
        "RemoveCSSScope"
      )),
    }
  }
}

impl napi::bindgen_prelude::ToNapiValue for CSSScope {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    match val {
      CSSScope::All => <&str>::to_napi_value(env, "all"),
      CSSScope::None => <&str>::to_napi_value(env, "none"),
      CSSScope::Modules => <&str>::to_napi_value(env, "modules"),
    }
  }
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct CSSScopeVisitorConfig {
  #[napi(ts_type = "'all' | 'none' | 'modules'")]
  /// @public
  pub mode: CSSScope,

  /// @public
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
        // cssId for `@file` starts from `1` and auto increases one by one
        // to avoid cssId collision, we start our cssId from `1e6`, so that
        // we will never collide with `cssId` of `@file` if user have less than 1e6 css files
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

      // No need to traverse children if we already know it is JSX
      return;
    }
    n.visit_mut_children_with(self);
  }

  fn visit_mut_module(&mut self, n: &mut Module) {
    if matches!(self.cfg.mode, CSSScope::None) {
      // css scope is removed, nothing to do
      return;
    }

    n.visit_mut_children_with(self);

    if !self.has_jsx {
      // No JSX found, do not modify CSS imports
      return;
    }

    let import_decls = n
      .body
      .iter_mut()
      .filter_map(|module_item| {
        if let ModuleItem::ModuleDecl(decl) = module_item {
          if let ModuleDecl::Import(import_decl) = decl {
            return Some(import_decl);
          }
        }

        None
      })
      .collect::<Vec<_>>();

    let mut has_css_import = false;

    for import_decl in import_decls {
      if matches!(self.cfg.mode, CSSScope::Modules) && import_decl.specifiers.is_empty() {
        // Is named/default/namespace import, nothing to do
        continue;
      }
      // Is sideEffects import or force scoped

      let re = Regex::new(r"\.(scss|sass|css|less)$").unwrap();
      if re.is_match(import_decl.src.value.to_string().as_str()) {
        // Is CSS files
        //
        // Add cssId to the import
        import_decl.src = Box::new(Str {
          span: import_decl.src.span,
          raw: None,
          // TODO(wangqingyu): deal with src that already have query(`?`)
          value: format!(
            "{}?cssId={}",
            import_decl.src.value.to_string(),
            self.css_id.to_string()
          )
          .into(),
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
