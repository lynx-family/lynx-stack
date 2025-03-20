#![deny(clippy::all)]

mod css;
mod css_property;
mod swc_plugin_css_scope;
mod swc_plugin_define_dce;
mod swc_plugin_directive_dce;
mod swc_plugin_dynamic_import;
mod swc_plugin_extract_str;
mod swc_plugin_inject;
mod swc_plugin_shake;
mod swc_plugin_snapshot;
mod swc_plugin_worklet;
mod swc_plugin_worklet_post_process;
mod target;
mod utils;

use rustc_hash::FxBuildHasher;
use serde::{Deserialize, Deserializer};
use std::vec;
use ts_rs::TS;

use swc_core::{
  base::config::GlobalPassOption,
  common::{
    errors::{DiagnosticBuilder, Emitter, HANDLER},
    pass::Optional,
    sync::Lrc,
    FilePathMapping, Mark, SourceMap, SourceMapper, Spanned,
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
use utils::calc_hash;

#[derive(TS, Deserialize, Debug, Clone, PartialEq)]
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
      _ => {
        return Err(serde::de::Error::custom(format!(
          "value `{}` does not match any variant of TransformMode",
          s
        )));
      }
    }
  }
}

#[derive(TS, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
#[ts(export, export_to = "index.d.ts")]
pub struct TransformNodiffOptions {
  /// @internal
  /// This is used internally to make sure the test output is consistent.
  #[ts(optional, type = "'production' | 'development' | 'test'")]
  pub mode: Option<TransformMode>,

  pub plugin_name: String,

  pub filename: String,

  #[ts(optional)]
  pub source_file_name: Option<String>,

  #[ts(inline)]
  pub sourcemap: Either<bool, String>,

  #[ts(optional)]
  pub source_map_columns: Option<bool>,

  #[ts(optional)]
  pub inline_sources_content: Option<bool>,

  #[ts(inline)]
  pub css_scope: Either<bool, CSSScopeVisitorConfig>,

  #[ts(optional, inline)]
  pub snapshot: Option<Either<bool, JSXTransformerConfig>>,

  #[ts(inline)]
  pub shake: Either<bool, ShakeVisitorConfig>,

  #[ts(inline)]
  #[serde(rename = "defineDCE")]
  pub define_dce: Either<bool, DefineDCEVisitorConfig>,

  #[ts(inline)]
  #[serde(rename = "directiveDCE")]
  pub directive_dce: Either<bool, DirectiveDCEVisitorConfig>,

  #[ts(inline)]
  pub worklet: Either<bool, WorkletVisitorConfig>,

  #[ts(optional, inline)]
  pub dynamic_import: Option<Either<bool, DynamicImportVisitorConfig>>,

  /// @internal
  #[ts(optional, inline)]
  pub inject: Option<Either<bool, InjectVisitorConfig>>,
}

impl Default for TransformNodiffOptions {
  fn default() -> Self {
    Self {
      mode: Some(TransformMode::Production),
      plugin_name: Default::default(),
      filename: Default::default(),
      source_file_name: Default::default(),
      sourcemap: Either::A(false),
      source_map_columns: None,
      inline_sources_content: None,
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

/// A multi emitter that forwards to multiple emitters.
pub struct MultiEmitter {
  emitters: Vec<Box<dyn Emitter>>,
}

impl MultiEmitter {
  pub fn new(emitters: Vec<Box<dyn Emitter>>) -> Self {
    Self { emitters }
  }
}

impl Emitter for MultiEmitter {
  fn emit(&mut self, db: &DiagnosticBuilder<'_>) {
    for emitter in &mut self.emitters {
      emitter.emit(db);
    }
  }
}

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
  let comments = metadata.comments.as_ref();

  let config_json = metadata.get_transform_plugin_config().unwrap_or_default();
  let options: TransformNodiffOptions = serde_json::from_str(&config_json).unwrap_or_default();

  let source_map = std::sync::Arc::new(metadata.source_map);
  let pos = source_map.lookup_char_pos(program.span().lo);

  let hash = pos.file.src_hash as u32;

  let content_hash = match options.mode {
    Some(val) if val == TransformMode::Test => "test".into(),
    _ => format!("{:x}", hash),
  };

  let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));

  let unresolved_mark = Mark::new();
  let top_level_mark = Mark::new();

  let simplify_pass_1 = Optional::new(
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
            map.insert(key.as_str().into(), value.as_str().into());
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
        Some(&comments),
      )),
      enabled,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(CSSScopeVisitor::new(config, Some(&comments))),
      true,
    ),
  };

  let (snapshot_plugin_config, enabled) = match &options.snapshot.unwrap_or(Either::A(true)) {
    Either::A(config) => (
      JSXTransformerConfig {
        filename: options.filename,
        ..Default::default()
      },
      *config,
    ),
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
        cm.clone(),
        Some(&comments),
        top_level_mark,
        unresolved_mark,
        options.mode.unwrap_or(TransformMode::Production),
      )
      .with_content_hash(content_hash.clone()),
    ),
    enabled,
  );

  let shake_plugin = match options.shake.clone() {
    Either::A(config) => Optional::new(visit_mut_pass(ShakeVisitor::default()), config),
    Either::B(config) => Optional::new(visit_mut_pass(ShakeVisitor::new(config)), true),
  };

  let simplify_pass = simplifier(
    top_level_mark,
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
      visit_mut_pass(WorkletVisitor::default().with_content_hash(content_hash)),
      config,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(
        WorkletVisitor::new(options.mode.unwrap_or(TransformMode::Production), config)
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
        unresolved_mark,
        top_level_mark,
      )),
      config,
    ),
    Either::B(config) => Optional::new(
      visit_mut_pass(InjectVisitor::new(config, unresolved_mark, top_level_mark)),
      true,
    ),
  };

  let pass = (
    resolver(unresolved_mark, top_level_mark, true),
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
    snapshot_plugin,
    directive_dce_plugin,
    define_dce_plugin,
    simplify_pass_1, // do simplify after DCE above to make shake below works better
    shake_plugin,
    simplify_pass,
    // react_transformer,

    // TODO(hongzhiyuan.hzy): if `ident` we added above is correctly marked, this pass will be unnecessary
    resolver(unresolved_mark, top_level_mark, true),
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
          "pluginName": "test-plugin",
          "filename": "test.js",
          "sourcemap": true,
          "shake": true,
          "cssScope":true,
          "defineDCE": true,
          "directiveDCE": true,
          "worklet": true
      }"#;

    let options: TransformNodiffOptions = serde_json::from_str(json_data).unwrap();

    assert_eq!(options.mode, Some(TransformMode::Production));
    assert_eq!(options.plugin_name, "test-plugin");
    assert_eq!(options.filename, "test.js");
    assert_eq!(options.source_file_name, None);
    assert_eq!(options.sourcemap, Either::A(true));
    assert_eq!(options.source_map_columns, None);
    assert_eq!(options.inline_sources_content, None);
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
          "mode": "all",
          "filename":"test.js"
       }
    }"#;
    let options: TransformNodiffOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(
      options.css_scope,
      Either::B(CSSScopeVisitorConfig {
        mode: CSSScope::All,
        filename: "test.js".into()
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
}
