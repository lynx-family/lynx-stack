use std::collections::HashMap;

use swc_core::{
  common::Mark,
  ecma::{
    ast::Module,
    visit::{VisitMut, VisitMutWith},
  },
};

use crate::{
  swc_plugin_compat::{CompatVisitorConfig, DarkModeConfig},
  swc_plugin_inject::{InjectAs, InjectVisitor, InjectVisitorConfig},
};

pub struct CompatPostVisitor {
  // opts: CompatVisitorConfig,
  inject_plugin: Option<InjectVisitor>,
}

impl CompatPostVisitor {
  pub fn new_inject_plugin(
    opts: &CompatVisitorConfig,
    unresolved_mark: Mark,
    top_level_mark: Mark,
  ) -> Option<InjectVisitor> {
    Some(InjectVisitor::new(
      InjectVisitorConfig {
        inject: HashMap::from([
          (
            "__SetClasses".into(),
            InjectAs::ImportNamed(
              // NOTE: this is a self-import, but bundler SHOULD have taken care of this
              "@lynx-js/react/src/compat/darkMode".into(),
              "__SetClassesDarkMode".into(),
            ),
          ),
          (
            "__globalProps".into(), // compat with directly usage of `__globalProps`
            InjectAs::Expr("lynx.__globalProps".into()),
          ),
          (
            "__DARK_MODE_THEME__".into(),
            InjectAs::Expr(match opts.dark_mode.clone()? {
              napi::Either::A(false) => None,
              napi::Either::A(true) => Some("__globalProps.theme".into()),
              napi::Either::B(DarkModeConfig { theme_expr }) => Some(theme_expr),
            }?),
          ),
        ]),
      },
      unresolved_mark,
      top_level_mark,
    ))
  }

  pub fn new(opts: CompatVisitorConfig, unresolved_mark: Mark, top_level_mark: Mark) -> Self {
    CompatPostVisitor {
      inject_plugin: Self::new_inject_plugin(&opts, unresolved_mark, top_level_mark),
      // opts,
    }
  }
}

impl VisitMut for CompatPostVisitor {
  fn visit_mut_module(&mut self, n: &mut Module) {
    match &mut self.inject_plugin {
      Some(ref mut inject_plugin) => n.visit_mut_with(inject_plugin),
      None => {}
    }
  }
}

#[cfg(test)]
mod tests {
  use swc_core::{
    common::Mark,
    ecma::{
      parser::{EsSyntax, Syntax},
      transforms::{base::resolver, testing::test},
      visit::visit_mut_pass,
    },
  };

  use crate::{
    swc_plugin_compat::{CompatVisitorConfig, DarkModeConfig},
    swc_plugin_compat_post::CompatPostVisitor,
  };

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
        visit_mut_pass(CompatPostVisitor::new(
          CompatVisitorConfig {
            dark_mode: Some(napi::Either::A(true)),
            ..Default::default()
          },
          unresolved_mark,
          top_level_mark,
        )),
      )
    },
    should_compat_dark_mode,
    r#"
    __DARK_MODE_THEME__.toString()
    __SetClasses(a,b);
    "#
  );

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
        visit_mut_pass(CompatPostVisitor::new(
          CompatVisitorConfig {
            dark_mode: Some(napi::Either::B(DarkModeConfig {
              theme_expr: "__globalProps.xxx ?? __globalProps.yyy ?? 'zzz'".into(),
            })),
            ..Default::default()
          },
          unresolved_mark,
          top_level_mark,
        )),
      )
    },
    should_compat_dark_mode_custom_theme_expr,
    r#"
    __DARK_MODE_THEME__.toString();
    __SetClasses(a,b);
    "#
  );
}
