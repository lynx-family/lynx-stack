mod css;
mod swc_plugin_css_scope;
mod swc_plugin_define_dce;
mod swc_plugin_directive_dce;
mod swc_plugin_dynamic_import;
mod swc_plugin_inject;
mod swc_plugin_list;
mod swc_plugin_shake;
mod swc_plugin_snapshot;
mod swc_plugin_worklet;
mod target;
mod utils;

use rustc_hash::FxBuildHasher;
use serde::{Deserialize, Deserializer};
use std::collections::HashSet;

use swc_core::{
  base::config::GlobalPassOption,
  common::{
    errors::HANDLER, pass::Optional, plugin::metadata::TransformPluginMetadataContextKind,
    sync::Lrc, FilePathMapping, Mark, SourceMap, SourceMapper, Spanned,
  },
  ecma::{
    ast::*,
    transforms::{
      base::{
        hygiene::{hygiene_with_config, Config},
        resolver,
      },
      optimization::{simplifier, simplify},
    },
    visit::visit_mut_pass,
  },
  plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

use swc_plugin_css_scope::{CSSScopeVisitor, CSSScopeVisitorConfig};
use swc_plugin_define_dce::DefineDCEVisitorConfig;
use swc_plugin_directive_dce::{DirectiveDCEVisitor, DirectiveDCEVisitorConfig};
use swc_plugin_dynamic_import::{DynamicImportVisitor, DynamicImportVisitorConfig};
use swc_plugin_inject::{InjectVisitor, InjectVisitorConfig};
use swc_plugin_shake::{ShakeVisitor, ShakeVisitorConfig};
use swc_plugin_snapshot::{JSXTransformer, JSXTransformerConfig};
use swc_plugin_worklet::{WorkletVisitor, WorkletVisitorConfig};
use utils::{calc_hash, get_relative_path, resolve_value};

#[derive(Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase", untagged)]
pub enum Either<A, B> {
  A(A),
  B(B),
}

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformMode {
  /// Transform for production.
  Production,
  /// Transform for development.
  Development,
  /// Transform for testing.
  Test,
}

impl<'de> Deserialize<'de> for TransformMode {
  fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
  where
    D: Deserializer<'de>,
  {
    let s = String::deserialize(deserializer)?;
    match s.as_str() {
      "production" => Ok(TransformMode::Production),
      "development" => Ok(TransformMode::Development),
      "test" => Ok(TransformMode::Test),
      _ => Err(serde::de::Error::custom(format!(
        "value `{s}` does not match any variant of TransformMode"
      ))),
    }
  }
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct TransformNodiffOptions {
  /// @internal
  /// This is used internally to make sure the test output is consistent.
  pub mode: Option<TransformMode>,

  pub css_scope: Either<bool, CSSScopeVisitorConfig>,

  pub snapshot: Option<Either<bool, JSXTransformerConfig>>,

  pub shake: Either<bool, ShakeVisitorConfig>,

  #[serde(rename = "defineDCE")]
  pub define_dce: Either<bool, DefineDCEVisitorConfig>,

  #[serde(rename = "directiveDCE")]
  pub directive_dce: Either<bool, DirectiveDCEVisitorConfig>,

  pub worklet: Either<bool, WorkletVisitorConfig>,

  pub dynamic_import: Option<Either<bool, DynamicImportVisitorConfig>>,

  /// @internal
  pub inject: Option<Either<bool, InjectVisitorConfig>>,
}

impl Default for TransformNodiffOptions {
  fn default() -> Self {
    Self {
      mode: Some(TransformMode::Production),
      css_scope: Either::B(Default::default()),
      snapshot: Default::default(),
      shake: Either::A(false),
      define_dce: Either::A(false),
      directive_dce: Either::A(false),
      worklet: Either::A(false),
      dynamic_import: Some(Either::B(Default::default())),
      inject: Some(Either::A(false)),
    }
  }
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
  let comments = metadata.comments.as_ref();

  let cwd = metadata
    .get_context(&TransformPluginMetadataContextKind::Cwd)
    .unwrap_or("/".to_string());
  let absolute_filename = metadata
    .get_context(&TransformPluginMetadataContextKind::Filename)
    .unwrap_or("test.js".to_string());
  let filename = get_relative_path(&cwd, &absolute_filename);

  let config_json = metadata.get_transform_plugin_config().unwrap_or_default();
  let options: TransformNodiffOptions = serde_json::from_str(&config_json).unwrap_or_default();

  let source_map = std::sync::Arc::new(metadata.source_map);
  let pos = source_map.lookup_char_pos(program.span().lo);

  let hash = pos.file.src_hash as u32;

  let content_hash = match options.mode {
    Some(TransformMode::Test) => "test".into(),
    _ => format!("{hash:x}"),
  };

  let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));

  let top_level_mark = Mark::new();

  let simplify_pass_1 = Optional::new(
    simplifier(
      metadata.unresolved_mark,
      simplify::Config {
        dce: simplify::dce::Config {
          preserve_imports_with_side_effects: false,
          ..Default::default()
        },
        ..Default::default()
      },
    ),
    match &options.directive_dce {
      Either::A(config) => *config,
      Either::B(_) => true,
    } || match &options.define_dce {
      Either::A(config) => *config,
      Either::B(_) => true,
    },
  );

  let directive_dce_plugin = match options.directive_dce {
    Either::A(config) => Optional::new(
      visit_mut_pass(DirectiveDCEVisitor::new(Default::default())),
      config,
    ),
    Either::B(config) => Optional::new(visit_mut_pass(DirectiveDCEVisitor::new(config)), true),
  };

  let define_dce_plugin = {
    let opts = GlobalPassOption {
      vars: match &options.define_dce {
        Either::A(_) => Default::default(),
        Either::B(config) => {
          let mut map = indexmap::IndexMap::<_, _, FxBuildHasher>::default();
          for (key, value) in &config.define {
            let mut visited = HashSet::new();
            let resolved_value = if config.define.contains_key(value) {
              resolve_value(value, &config.define, &mut visited).unwrap_or_else(|| value.clone())
            } else {
              value.clone()
            };

            map.insert(key.as_str().into(), resolved_value.into());
          }
          map
        }
      },
      envs: Default::default(),
      typeofs: Default::default(),
    };

    HANDLER.with(|handler| {
      Optional::new(
        opts.build(&cm, handler),
        matches!(options.define_dce, Either::B(_)),
      )
    })
  };

  let css_scope_plugin = match options.css_scope {
    Either::A(enabled) => Optional::new(
      visit_mut_pass(CSSScopeVisitor::new(
        CSSScopeVisitorConfig::default(),
        filename.clone(),
        Some(&comments),
      )),
      enabled,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(CSSScopeVisitor::new(
        config,
        filename.clone(),
        Some(&comments),
      )),
      true,
    ),
  };

  let (snapshot_plugin_config, enabled) = match &options.snapshot.unwrap_or(Either::A(true)) {
    Either::A(config) => (JSXTransformerConfig::default(), *config),
    Either::B(config) => (config.clone(), true),
  };

  // let react_transformer = Optional::new(
  //   react::react(
  //     cm.clone(),
  //     Some(&comments),
  //     react::Options {
  //       next: Some(false),
  //       runtime: Some(react::Runtime::Automatic),
  //       import_source: snapshot_plugin_config.jsx_import_source.clone(),
  //       pragma: None,
  //       pragma_frag: None,
  //       // We may want `main-thread:foo={fooMainThreadFunc}` to work
  //       throw_if_namespace: Some(false),
  //       development: Some(matches!(options.mode, Some(TransformMode::Development))),
  //       refresh: None,
  //       ..Default::default()
  //     },
  //     top_level_mark,
  //     unresolved_mark,
  //   ),
  //   enabled && !snapshot_plugin_config.preserve_jsx,
  // );

  let snapshot_plugin = Optional::new(
    visit_mut_pass(
      JSXTransformer::new(
        snapshot_plugin_config,
        Some(&comments),
        filename.clone(),
        options.mode.unwrap_or(TransformMode::Production),
      )
      .with_content_hash(content_hash.clone()),
    ),
    enabled,
  );

  let list_plugin = Optional::new(
    visit_mut_pass(swc_plugin_list::ListVisitor::new(Some(&comments))),
    enabled,
  );

  let shake_plugin = match options.shake.clone() {
    Either::A(config) => Optional::new(visit_mut_pass(ShakeVisitor::default()), config),
    Either::B(config) => Optional::new(visit_mut_pass(ShakeVisitor::new(config)), true),
  };

  let simplify_pass = simplifier(
    metadata.unresolved_mark,
    simplify::Config {
      dce: simplify::dce::Config {
        preserve_imports_with_side_effects: false,
        ..Default::default()
      },
      ..Default::default()
    },
  );

  let worklet_plugin = match options.worklet {
    Either::A(config) => Optional::new(
      visit_mut_pass(
        WorkletVisitor::default()
          .with_filename(filename)
          .with_content_hash(content_hash),
      ),
      config,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(
        WorkletVisitor::new(
          options.mode.unwrap_or(TransformMode::Production),
          filename,
          config,
        )
        .with_content_hash(content_hash),
      ),
      true,
    ),
  };

  let dynamic_import_plugin = match options.dynamic_import.unwrap_or(Either::A(true)) {
    Either::A(config) => Optional::new(
      visit_mut_pass(DynamicImportVisitor::new(
        Default::default(),
        Some(&comments),
      )),
      config,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(DynamicImportVisitor::new(config, Some(&comments))),
      true,
    ),
  };

  let inject_plugin = match options.inject.unwrap_or(Either::A(false)) {
    Either::A(config) => Optional::new(
      visit_mut_pass(InjectVisitor::new(
        Default::default(),
        metadata.unresolved_mark,
        top_level_mark,
      )),
      config,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(InjectVisitor::new(
        config,
        metadata.unresolved_mark,
        top_level_mark,
      )),
      true,
    ),
  };

  let pass = (
    resolver(metadata.unresolved_mark, top_level_mark, true),
    // typescript::typescript(
    //   typescript::Config {
    //     verbatim_module_syntax: false,
    //     import_not_used_as_values: typescript::ImportsNotUsedAsValues::Remove,
    //     ..Default::default()
    //   },
    //   unresolved_mark,
    //   top_level_mark
    // ),
    dynamic_import_plugin,
    worklet_plugin,
    css_scope_plugin,
    (list_plugin, snapshot_plugin),
    directive_dce_plugin,
    define_dce_plugin,
    simplify_pass_1, // do simplify after DCE above to make shake below works better
    shake_plugin,
    simplify_pass,
    // react_transformer,

    // TODO(hongzhiyuan.hzy): if `ident` we added above is correctly marked, this pass will be unnecessary
    resolver(metadata.unresolved_mark, top_level_mark, true),
    inject_plugin,
    hygiene_with_config(Config {
      top_level_mark,
      ..Default::default()
    }),
  );

  program.apply(pass)
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::swc_plugin_css_scope::CSSScope;
  use crate::swc_plugin_inject::InjectAs;
  use std::collections::HashMap;

  #[test]
  fn test_transform_mode_production() {
    let json = r#""production""#;
    let mode: TransformMode = serde_json::from_str(json).unwrap();
    assert_eq!(mode, TransformMode::Production);
  }

  #[test]
  fn test_transform_mode_development() {
    let json = r#""development""#;
    let mode: TransformMode = serde_json::from_str(json).unwrap();
    assert_eq!(mode, TransformMode::Development);
  }

  #[test]
  fn test_transform_mode_test() {
    let json = r#""test""#;
    let mode: TransformMode = serde_json::from_str(json).unwrap();
    assert_eq!(mode, TransformMode::Test);
  }

  #[test]
  fn test_transform_mode_unknown() {
    let json = r#""unknown""#;
    let result: Result<TransformMode, _> = serde_json::from_str(json);

    assert!(result.is_err());

    if let Err(err) = result {
      assert_eq!(
        err.to_string(),
        "value `unknown` does not match any variant of TransformMode"
      );
    }
  }

  #[test]
  fn test_optional_fields() {
    let json_data = r#"
      {
          "shake": true,
          "cssScope":true,
          "defineDCE": true,
          "directiveDCE": true,
          "worklet": true
      }"#;

    let options: TransformNodiffOptions = serde_json::from_str(json_data).unwrap();

    assert_eq!(options.mode, Some(TransformMode::Production));
    assert_eq!(options.css_scope, Either::A(true));
    assert_eq!(options.snapshot, None);
    assert_eq!(options.shake, Either::A(true));
    assert_eq!(options.define_dce, Either::A(true));
    assert_eq!(options.directive_dce, Either::A(true));
    assert_eq!(options.worklet, Either::A(true));
    assert_eq!(options.dynamic_import, Some(Either::B(Default::default())));
    assert_eq!(options.inject, Some(Either::A(false)));
  }

  #[test]
  fn test_css_scope() {
    let json_data = r#"
    {
       "cssScope":{
          "mode": "all"
       }
    }"#;
    let options: TransformNodiffOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(
      options.css_scope,
      Either::B(CSSScopeVisitorConfig {
        mode: CSSScope::All,
      })
    );
  }

  #[test]
  fn test_inject() {
    let json_data = r#"
    {
      "inject":{
        "inject":{
           "__SOME__": ["expr", "__globalProps.xxx ?? __globalProps.yyy ?? 'zzz'"]
        }
      }
    }"#;
    let options: TransformNodiffOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(
      options.inject,
      Some(Either::B(InjectVisitorConfig {
        inject: HashMap::from([(
          "__SOME__".into(),
          InjectAs::Expr("__globalProps.xxx ?? __globalProps.yyy ?? 'zzz'".into()),
        ),])
      }))
    );
  }

  #[test]
  fn test_dce_define() {
    let json_data = r#"
    {
      "defineDCE":{
        "define":{
           "__LEPUS__": "true",
           "__JS__": "false",
           "__NON_EXISTS__": "__LEPUS__"
        }
      }
    }"#;
    let options: TransformNodiffOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(
      options.define_dce,
      Either::B(DefineDCEVisitorConfig {
        define: HashMap::from([
          ("__LEPUS__".into(), "true".into()),
          ("__JS__".into(), "false".into()),
          ("__NON_EXISTS__".into(), "__LEPUS__".into()),
        ])
      })
    );
  }
}
