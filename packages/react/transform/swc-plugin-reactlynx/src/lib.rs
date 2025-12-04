use rustc_hash::FxBuildHasher;
use serde::Deserialize;
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
use swc_plugin_list::ListVisitor;
use swc_plugin_shake::{ShakeVisitor, ShakeVisitorConfig};
use swc_plugin_snapshot::{JSXTransformer, JSXTransformerConfig};
use swc_plugin_text::TextVisitor;
use swc_plugin_worklet::{WorkletVisitor, WorkletVisitorConfig};
use swc_plugins_shared::{
  engine_version::is_engine_version_ge,
  transform_mode::TransformMode,
  utils::{get_relative_path, WEBPACK_VARS},
};

#[derive(Deserialize, Debug, Clone, PartialEq)]
#[serde(rename_all = "camelCase", untagged)]
pub enum Either<A, B> {
  A(A),
  B(B),
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct ReactLynxTransformOptions {
  pub filename: Option<String>,
  /// @internal
  /// This is used internally to make sure the test output is consistent.
  pub mode: Option<TransformMode>,

  pub css_scope: Either<bool, CSSScopeVisitorConfig>,

  pub snapshot: Option<Either<bool, JSXTransformerConfig>>,

  pub engine_version: Option<String>,

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

impl Default for ReactLynxTransformOptions {
  fn default() -> Self {
    Self {
      filename: None,
      mode: Some(TransformMode::Production),
      css_scope: Either::B(Default::default()),
      snapshot: Default::default(),
      engine_version: None,
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
  let options: ReactLynxTransformOptions = serde_json::from_str(&config_json).unwrap_or_default();

  let source_map = std::sync::Arc::new(metadata.source_map);
  let pos = source_map.lookup_char_pos(program.span().lo);

  let hash = pos.file.src_hash as u32;

  let content_hash = match options.mode {
    Some(TransformMode::Test) => "test".into(),
    _ => format!("{hash:x}"),
  };

  let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));
  let top_level_mark = Mark::new();
  let top_retain = WEBPACK_VARS.iter().map(|&s| s.into()).collect::<Vec<_>>();

  let simplify_pass_1 = Optional::new(
    simplifier(
      metadata.unresolved_mark,
      simplify::Config {
        dce: simplify::dce::Config {
          preserve_imports_with_side_effects: false,
          top_retain: top_retain.clone(),
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
        // TODO: Environment-specific filename handling
        // - Test environment: use `options.filename`
        // - Production environment: use filename from metadata
        // Affected plugins:
        // 1. snapshot_plugin
        // 2. css_scope_plugin
        // 3. worklet_plugin
        filename: options.filename.unwrap_or(filename),
        ..Default::default()
      },
      *config,
    ),
    Either::B(config) => (config.clone(), true),
  };

  let snapshot_plugin = Optional::new(
    visit_mut_pass(
      JSXTransformer::new(
        snapshot_plugin_config,
        Some(&comments),
        options.mode.unwrap_or(TransformMode::Production),
      )
      .with_content_hash(content_hash.clone()),
    ),
    enabled,
  );

  let list_plugin = Optional::new(visit_mut_pass(ListVisitor::new(Some(&comments))), enabled);

  let is_ge_3_1: bool = is_engine_version_ge(&options.engine_version, "3.1");
  let text_plugin = Optional::new(visit_mut_pass(TextVisitor {}), enabled && is_ge_3_1);

  let shake_plugin = match options.shake.clone() {
    Either::A(config) => Optional::new(visit_mut_pass(ShakeVisitor::default()), config),
    Either::B(config) => Optional::new(visit_mut_pass(ShakeVisitor::new(config)), true),
  };

  let simplify_pass = simplifier(
    metadata.unresolved_mark,
    simplify::Config {
      dce: simplify::dce::Config {
        preserve_imports_with_side_effects: false,
        top_retain: top_retain.clone(),
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
    dynamic_import_plugin,
    worklet_plugin,
    css_scope_plugin,
    (text_plugin, list_plugin, snapshot_plugin),
    directive_dce_plugin,
    define_dce_plugin,
    simplify_pass_1, // do simplify after DCE above to make shake below works better
    shake_plugin,
    simplify_pass,
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
  use std::collections::HashMap;
  use swc_plugin_css_scope::CSSScope;
  use swc_plugin_inject::InjectAs;
  use swc_plugins_shared::target::TransformTarget;

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

    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();

    assert_eq!(options.filename, None);
    assert_eq!(options.mode, Some(TransformMode::Production));
    assert_eq!(options.css_scope, Either::A(true));
    assert_eq!(options.snapshot, None);
    assert_eq!(options.shake, Either::A(true));
    assert_eq!(options.define_dce, Either::A(true));
    assert_eq!(options.directive_dce, Either::A(true));
    assert_eq!(options.worklet, Either::A(true));
    assert_eq!(options.dynamic_import, Some(Either::B(Default::default())));
    assert_eq!(options.inject, Some(Either::A(false)));
    assert_eq!(options.engine_version, None);
  }

  #[test]
  fn test_css_scope() {
    let json_data = r#"
    {
       "cssScope":{
          "mode": "all",
          "filename": "test.js"
       }
    }"#;
    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(
      options.css_scope,
      Either::B(CSSScopeVisitorConfig {
        mode: CSSScope::All,
        filename: "test.js".into(),
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
    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();
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
    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();
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

  #[test]
  fn test_dce_directive() {
    let json_data = r#"
    {
      "directiveDCE":{      
        "target": "JS"
      }
    }"#;
    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(
      options.directive_dce,
      Either::B(DirectiveDCEVisitorConfig {
        target: TransformTarget::JS,
      })
    );
  }

  #[test]
  fn test_mode() {
    let json_data = r#"
    {
      "mode": "development"
    }"#;
    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(options.mode, Some(TransformMode::Development));
  }

  #[test]
  fn test_worklet() {
    let json_data = r#"
    {
      "worklet": {
        "customGlobalIdentNames": ["globalVar1", "globalVar2", "customGlobal"],
        "filename": "test.js",
        "target": "LEPUS",
        "runtimePkg": "@lynx-js/react"
      }
    }"#;

    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();

    if let Either::B(worklet) = options.worklet {
      assert_eq!(
        worklet.custom_global_ident_names,
        Some(vec![
          "globalVar1".to_string(),
          "globalVar2".to_string(),
          "customGlobal".to_string()
        ])
      );
      assert_eq!(worklet.filename, "test.js");
      assert_eq!(worklet.target, TransformTarget::LEPUS);
      assert_eq!(worklet.runtime_pkg, "@lynx-js/react");
    } else {
      panic!("Expected worklet config, got boolean");
    }
  }

  #[test]
  fn test_snapshot() {
    let json_data = r#"
  {
    "snapshot": {
      "preserveJsx": true,
      "runtimePkg": "@lynx-js/react",
      "jsxImportSource": "@lynx-js/react",
      "filename": "test.js",
      "target": "LEPUS",
      "isDynamicComponent": false
    }
  }"#;

    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();

    if let Some(Either::B(snapshot)) = options.snapshot {
      assert!(snapshot.preserve_jsx);
      assert_eq!(snapshot.runtime_pkg, "@lynx-js/react");
      assert_eq!(
        snapshot.jsx_import_source,
        Some("@lynx-js/react".to_string())
      );
      assert_eq!(snapshot.filename, "test.js");
      assert_eq!(snapshot.target, TransformTarget::LEPUS);
      assert_eq!(snapshot.is_dynamic_component, Some(false));
    } else {
      panic!("Expected snapshot config, got boolean or None");
    }
  }

  #[test]
  fn test_engine_version() {
    let json_data = r#"
    {
      "engineVersion": "3.2"
    }"#;
    let options: ReactLynxTransformOptions = serde_json::from_str(json_data).unwrap();
    assert_eq!(options.engine_version, Some("3.2".to_string()));
  }
}
