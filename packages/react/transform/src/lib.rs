#![deny(clippy::all)]

#[macro_use]
extern crate napi_derive;
mod bundle;
mod css;
mod esbuild;
mod swc_plugin_compat;
mod swc_plugin_compat_post;
mod swc_plugin_css_scope;
mod swc_plugin_define_dce;
mod swc_plugin_directive_dce;
mod swc_plugin_dynamic_import;
mod swc_plugin_extract_str;
mod swc_plugin_inject;
mod swc_plugin_refresh;
mod swc_plugin_shake;
mod swc_plugin_snapshot;
mod swc_plugin_worklet;
mod swc_plugin_worklet_post_process;
mod target;
mod utils;

use std::vec;

use napi::{bindgen_prelude::AsyncTask, Either, Env, Task};

use rustc_hash::FxBuildHasher;

use swc_core::{
  atoms::Atom,
  base::{
    config::{GlobalPassOption, IsModule, SourceMapsConfig},
    Compiler, PrintArgs,
  },
  common::{
    comments::SingleThreadedComments,
    errors::{DiagnosticBuilder, Emitter, Handler, HANDLER},
    pass::Optional,
    sync::Lrc,
    FileName, FilePathMapping, Mark, SourceMap, GLOBALS,
  },
  ecma::{
    ast::*,
    codegen,
    parser::{Syntax, TsSyntax},
    transforms::{
      base::{
        fixer::fixer,
        helpers,
        hygiene::{hygiene_with_config, Config},
        resolver,
      },
      optimization::{simplifier, simplify},
      react, typescript,
    },
    visit::visit_mut_pass,
  },
};

// currently `use xxx as yyy` is not supported by napi-rs
// So we have to use different name
use swc_plugin_compat::{CompatVisitor, CompatVisitorConfig};
use swc_plugin_compat_post::CompatPostVisitor;
use swc_plugin_css_scope::{CSSScopeVisitor, CSSScopeVisitorConfig};
use swc_plugin_define_dce::DefineDCEVisitorConfig;
use swc_plugin_directive_dce::{DirectiveDCEVisitor, DirectiveDCEVisitorConfig};
use swc_plugin_dynamic_import::{DynamicImportVisitor, DynamicImportVisitorConfig};
use swc_plugin_inject::{InjectVisitor, InjectVisitorConfig};
use swc_plugin_refresh::{RefreshVisitor, RefreshVisitorConfig};
use swc_plugin_shake::{ShakeVisitor, ShakeVisitorConfig};
use swc_plugin_snapshot::{JSXTransformer, JSXTransformerConfig};
use swc_plugin_worklet::{WorkletVisitor, WorkletVisitorConfig};
use utils::calc_hash;

#[derive(Debug, PartialEq, Clone, Copy)]
pub enum TransformMode {
  /// Transform for production.
  Production,
  /// Transform for development.
  Development,
  /// Transform for testing.
  Test,
}

impl napi::bindgen_prelude::FromNapiValue for TransformMode {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let val = <&str>::from_napi_value(env, napi_val).map_err(|e| {
      napi::bindgen_prelude::error!(
        e.status,
        "Failed to convert napi value into enum `{}`. {}",
        "TransformMode",
        e,
      )
    })?;
    match val {
      "production" => Ok(TransformMode::Production),
      "development" => Ok(TransformMode::Development),
      "test" => Ok(TransformMode::Test),
      _ => Err(napi::bindgen_prelude::error!(
        napi::bindgen_prelude::Status::InvalidArg,
        "value `{}` does not match any variant of enum `{}`",
        val,
        "TransformMode"
      )),
    }
  }
}

impl napi::bindgen_prelude::ToNapiValue for TransformMode {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    let val = match val {
      TransformMode::Production => "production",
      TransformMode::Development => "development",
      TransformMode::Test => "test",
    };
    <&str>::to_napi_value(env, val)
  }
}

#[derive(Debug, Clone, Copy)]
pub struct SyntaxConfig(Syntax);

impl From<SyntaxConfig> for Syntax {
  fn from(value: SyntaxConfig) -> Self {
    value.0
  }
}

impl Default for SyntaxConfig {
  fn default() -> Self {
    // override default
    Self(Syntax::Typescript(TsSyntax {
      tsx: true,
      decorators: true,
      ..Default::default()
    }))
  }
}

impl napi::bindgen_prelude::FromNapiValue for SyntaxConfig {
  unsafe fn from_napi_value(
    env: napi::sys::napi_env,
    napi_val: napi::sys::napi_value,
  ) -> napi::Result<Self> {
    Ok(SyntaxConfig(
      serde_json::from_str(<&str>::from_napi_value(env, napi_val)?).map_err(|err| {
        napi::bindgen_prelude::error!(
          napi::bindgen_prelude::Status::InvalidArg,
          "SyntaxConfig: {}",
          err,
        )
      })?,
    ))
  }
}

impl napi::bindgen_prelude::ToNapiValue for SyntaxConfig {
  unsafe fn to_napi_value(
    env: napi::sys::napi_env,
    val: Self,
  ) -> napi::Result<napi::sys::napi_value> {
    <&str>::to_napi_value(
      env,
      &serde_json::to_string(&val.0).map_err(|err| {
        napi::bindgen_prelude::error!(
          napi::bindgen_prelude::Status::InvalidArg,
          "SyntaxConfig: {}",
          err,
        )
      })?,
    )
  }
}

#[derive(Debug, PartialEq, Clone, Copy, Default)]
pub struct IsModuleConfig(IsModule);

impl From<IsModuleConfig> for IsModule {
  fn from(value: IsModuleConfig) -> Self {
    value.0
  }
}

impl napi::bindgen_prelude::FromNapiValue for IsModuleConfig {
  unsafe fn from_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    napi_val: napi::bindgen_prelude::sys::napi_value,
  ) -> napi::bindgen_prelude::Result<Self> {
    let bool_val = <bool>::from_napi_value(env, napi_val);
    if bool_val.is_ok() {
      return Ok(IsModuleConfig(IsModule::Bool(bool_val.unwrap())));
    }

    let str_val = <&str>::from_napi_value(env, napi_val);
    if str_val.is_ok() {
      match str_val.unwrap() {
        "unknown" => return Ok(IsModuleConfig(IsModule::Unknown)),
        _ => {}
      }
    }

    Err(napi::bindgen_prelude::error!(
      napi::bindgen_prelude::Status::InvalidArg,
      "value does not match any variant of enum `{}`",
      "IsModuleConfig"
    ))
  }
}

impl napi::bindgen_prelude::ToNapiValue for IsModuleConfig {
  unsafe fn to_napi_value(
    env: napi::bindgen_prelude::sys::napi_env,
    val: Self,
  ) -> napi::bindgen_prelude::Result<napi::bindgen_prelude::sys::napi_value> {
    match val.0 {
      IsModule::Bool(v) => <bool>::to_napi_value(env, v),
      IsModule::Unknown => <&str>::to_napi_value(env, "unknown"),
    }
  }
}

#[napi(object)]
#[derive(Clone, Debug)]
pub struct TransformNodiffOptions {
  /// @internal
  /// This is used internally to make sure the test output is consistent.
  #[napi(ts_type = "'production' | 'development' | 'test'")]
  pub mode: Option<TransformMode>,
  pub plugin_name: String,
  pub filename: String,
  pub source_file_name: Option<String>,
  pub sourcemap: Either<bool, String>,
  pub source_map_columns: Option<bool>,
  pub inline_sources_content: Option<bool>,
  /// @public
  /// This is swc syntax config in JSON format
  #[napi(ts_type = "string")]
  pub syntax_config: Option<SyntaxConfig>,
  #[napi(ts_type = "boolean | 'unknown'")]
  pub is_module: Option<IsModuleConfig>,
  pub css_scope: Either<bool, CSSScopeVisitorConfig>,
  pub snapshot: Option<Either<bool, JSXTransformerConfig>>,
  pub shake: Either<bool, ShakeVisitorConfig>,
  pub compat: Either<bool, CompatVisitorConfig>,
  pub refresh: Either<bool, RefreshVisitorConfig>,
  #[napi(js_name = "defineDCE")]
  pub define_dce: Either<bool, DefineDCEVisitorConfig>,
  #[napi(js_name = "directiveDCE")]
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
      plugin_name: Default::default(),
      filename: Default::default(),
      source_file_name: Default::default(),
      sourcemap: Either::A(false),
      source_map_columns: None,
      inline_sources_content: None,
      syntax_config: None,
      is_module: Default::default(),
      css_scope: Either::B(Default::default()),
      snapshot: Default::default(),
      shake: Either::A(false),
      compat: Either::A(false),
      refresh: Either::A(false),
      define_dce: Either::A(false),
      directive_dce: Either::A(false),
      worklet: Either::A(false),
      dynamic_import: Some(Either::B(Default::default())),
      inject: Some(Either::A(false)),
    }
  }
}

#[napi(object)]
pub struct TransformNodiffOutput {
  pub code: String,
  pub map: Option<String>,

  // #[napi(ts_type = "Array<import('esbuild').PartialMessage>")]
  pub errors: Vec<esbuild::PartialMessage>,
  // #[napi(ts_type = "Array<import('esbuild').PartialMessage>")]
  pub warnings: Vec<esbuild::PartialMessage>,
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
  fn emit(&mut self, db: &mut DiagnosticBuilder<'_>) {
    for emitter in &mut self.emitters {
      emitter.emit(db);
    }
  }
}

pub struct TransformTask {
  pub code: String,
  pub options: TransformNodiffOptions,
}

fn transform_react_lynx_inner(
  code: String,
  options: TransformNodiffOptions,
) -> TransformNodiffOutput {
  let content_hash = match options.mode {
    Some(val) if val == TransformMode::Test => "test".into(),
    _ => calc_hash(code.as_str()),
  };
  let comments = SingleThreadedComments::default();
  let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));
  let fm = cm.new_source_file(FileName::Real(options.filename.clone().into()).into(), code);

  let c = Compiler::new(cm.clone());

  let (esbuild_emitter, errors, warnings) =
    esbuild::EsbuildEmitter::new(options.plugin_name.clone(), Some(c.cm.clone()));
  let esbuild_emitter = Box::new(esbuild_emitter);
  let emitter = Box::new(MultiEmitter::new(vec![esbuild_emitter]));
  let handler = Handler::with_emitter(true, false, emitter);

  let result = GLOBALS.set(&Default::default(), || {
    let program = c.parse_js(
      fm,
      &handler,
      EsVersion::latest(),
      options.syntax_config.unwrap_or_default().into(),
      options.is_module.unwrap_or_default().into(),
      Some(&comments),
    );
    let program = match program {
      Ok(program) => program,
      Err(_) => {
        return TransformNodiffOutput {
          code: "".into(),
          map: None,
          errors: errors.read().unwrap().clone(),
          warnings: warnings.read().unwrap().clone(),
        };
      }
    };

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

      Optional::new(
        opts.build(&cm, &handler),
        matches!(options.define_dce, Either::B(_)),
      )
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

    let react_transformer = Optional::new(
      react::react(
        cm.clone(),
        Some(&comments),
        react::Options {
          next: Some(false),
          runtime: Some(react::Runtime::Automatic),
          import_source: snapshot_plugin_config
            .jsx_import_source
            .clone()
            .map(|s| Atom::from(s)),
          pragma: None,
          pragma_frag: None,
          // We may want `main-thread:foo={fooMainThreadFunc}` to work
          throw_if_namespace: Some(false),
          development: Some(matches!(options.mode, Some(TransformMode::Development))),
          refresh: None,
          ..Default::default()
        },
        top_level_mark,
        unresolved_mark,
      ),
      enabled && !snapshot_plugin_config.preserve_jsx,
    );

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

    let compat_plugin = match options.compat.clone() {
      Either::A(config) => Optional::new(
        visit_mut_pass(CompatVisitor::new(
          CompatVisitorConfig::default(),
          Some(&comments),
        )),
        config,
      ),
      Either::B(config) => Optional::new(
        visit_mut_pass(CompatVisitor::new(config, Some(&comments))),
        true,
      ),
    };

    let compat_post_plugin = match options.compat {
      Either::A(config) => Optional::new(
        visit_mut_pass(CompatPostVisitor::new(
          Default::default(),
          unresolved_mark,
          top_level_mark,
        )),
        config,
      ),
      Either::B(config) => Optional::new(
        visit_mut_pass(CompatPostVisitor::new(
          config,
          unresolved_mark,
          top_level_mark,
        )),
        true,
      ),
    };

    let refresh_plugin = match options.refresh {
      Either::A(config) => Optional::new(
        visit_mut_pass(RefreshVisitor::new(
          RefreshVisitorConfig::default(),
          content_hash.clone(),
        )),
        config,
      ),
      Either::B(config) => Optional::new(
        visit_mut_pass(RefreshVisitor::new(config, content_hash.clone())),
        true,
      ),
    };

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
      &mut fixer(Some(&comments)),
      resolver(unresolved_mark, top_level_mark, true),
      typescript::typescript(
        typescript::Config {
          verbatim_module_syntax: false,
          import_not_used_as_values: typescript::ImportsNotUsedAsValues::Remove,
          ..Default::default()
        },
        unresolved_mark,
        top_level_mark,
      ),
      dynamic_import_plugin,
      refresh_plugin,
      compat_plugin,
      worklet_plugin,
      css_scope_plugin,
      snapshot_plugin,
      directive_dce_plugin,
      define_dce_plugin,
      simplify_pass_1, // do simplify after DCE above to make shake below works better
      (
        shake_plugin,
        simplify_pass,
        react_transformer,
        // TODO(hongzhiyuan.hzy): if `ident` we added above is correctly marked, this pass will be unnecessary
        resolver(unresolved_mark, top_level_mark, true),
        compat_post_plugin,
        inject_plugin,
        hygiene_with_config(Config {
          top_level_mark,
          ..Default::default()
        }),
        &mut fixer(Some(&comments)),
      ),
    );

    let program = helpers::HELPERS.set(&helpers::Helpers::new(true), || {
      HANDLER.set(&handler, || program.apply(pass))
    });

    let result = c.print(
      &program,
      PrintArgs {
        output: None,
        source_root: "".into(), // TODO: add root
        source_file_name: options.source_file_name.as_ref().map(String::as_str),
        source_map_url: None,
        output_path: None,
        inline_sources_content: options.inline_sources_content.unwrap_or(true),
        source_map: match options.sourcemap {
          Either::A(b) => SourceMapsConfig::Bool(b),
          Either::B(s) => SourceMapsConfig::Str(s),
        },
        source_map_names: &Default::default(),
        orig: None,
        comments: Some(&comments),
        emit_source_map_columns: options.source_map_columns.unwrap_or(true),
        preamble: "".into(),
        codegen_config: codegen::Config::default()
          .with_target(EsVersion::latest())
          .with_minify(false)
          .with_ascii_only(false),
      },
    );

    match result {
      Ok(result) => TransformNodiffOutput {
        code: result.code,
        map: result.map,
        errors: vec![],
        warnings: vec![],
      },
      Err(_) => {
        return TransformNodiffOutput {
          code: "".into(),
          map: None,
          errors: errors.read().unwrap().clone(),
          warnings: warnings.read().unwrap().clone(),
        };
      }
    }
  });

  let r = TransformNodiffOutput {
    code: result.code,
    map: result.map,
    errors: errors.read().unwrap().clone(),
    warnings: warnings.read().unwrap().clone(),
  };

  r
}

#[napi]
pub fn transform_react_lynx_sync(
  _env: Env,
  code: String,
  options: Option<TransformNodiffOptions>,
) -> napi::Result<TransformNodiffOutput> {
  let out = transform_react_lynx_inner(code, options.unwrap_or_default());
  napi::Result::Ok(out)
}

#[napi]
impl Task for TransformTask {
  type Output = TransformNodiffOutput;
  type JsValue = TransformNodiffOutput;
  fn compute(&mut self) -> napi::Result<Self::Output> {
    let out = transform_react_lynx_inner(self.code.clone(), self.options.clone());
    Ok(out)
  }
  fn resolve(&mut self, _: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    napi::Result::Ok(output)
  }
}

#[napi]
pub fn transform_react_lynx(
  _env: Env,
  code: String,
  options: Option<TransformNodiffOptions>,
) -> napi::Result<AsyncTask<TransformTask>> {
  Ok(AsyncTask::new(TransformTask {
    code,
    options: options.unwrap_or_default(),
  }))
}

pub struct BundleTransformTask {
  pub code: String,
  pub options: bundle::TransformNodiffBundleOptions,
}

#[napi]
impl Task for BundleTransformTask {
  type Output = bundle::TransformNodiffBundleOutput;
  type JsValue = bundle::TransformNodiffBundleOutput;
  fn compute(&mut self) -> napi::Result<Self::Output> {
    let out = bundle::transform_bundle_result_inner(self.code.clone(), self.options.clone());
    Ok(out)
  }
  fn resolve(&mut self, _: napi::Env, output: Self::Output) -> napi::Result<Self::JsValue> {
    napi::Result::Ok(output)
  }
}

#[napi]
pub fn transform_bundle_result_sync(
  _env: Env,
  code: String,
  options: Option<bundle::TransformNodiffBundleOptions>,
) -> napi::Result<bundle::TransformNodiffBundleOutput> {
  let out = bundle::transform_bundle_result_inner(code, options.unwrap_or_default());
  napi::Result::Ok(out)
}

#[napi]
pub fn transform_bundle_result(
  _env: Env,
  code: String,
  options: Option<bundle::TransformNodiffBundleOptions>,
) -> napi::Result<AsyncTask<BundleTransformTask>> {
  Ok(AsyncTask::new(BundleTransformTask {
    code,
    options: options.unwrap_or_default(),
  }))
}

#[cfg(all(target_arch = "wasm32", target_os = "unknown"))]
mod wasm {
  use getrandom::register_custom_getrandom;
  use getrandom::Error;

  #[link(wasm_import_module = "getrandom")]
  extern "C" {
    fn random_fill_sync(offset: *mut u8, size: usize);
  }

  fn custom_getrandom(buf: &mut [u8]) -> Result<(), Error> {
    unsafe {
      random_fill_sync(buf.as_mut_ptr(), buf.len());
    }
    Ok(())
  }

  register_custom_getrandom!(custom_getrandom);

  use ::napi::{JsObject, NapiValue};

  const fn max(a: usize, b: usize) -> usize {
    [a, b][(a < b) as usize]
  }

  const ALIGN: usize = max(
    8, // wasm32 max_align_t
    max(std::mem::size_of::<usize>(), std::mem::align_of::<usize>()),
  );

  #[no_mangle]
  pub unsafe extern "C" fn malloc(size: usize) -> *mut u8 {
    let layout = match std::alloc::Layout::from_size_align(size + ALIGN, ALIGN) {
      Ok(layout) => layout,
      Err(_) => return core::ptr::null_mut(),
    };

    let ptr = std::alloc::alloc(layout);
    if ptr.is_null() {
      return core::ptr::null_mut();
    }

    *(ptr as *mut usize) = size;
    ptr.offset(ALIGN as isize)
  }

  #[no_mangle]
  pub unsafe extern "C" fn free(ptr: *mut u8) {
    let ptr = ptr.offset(-(ALIGN as isize));
    let size = *(ptr as *mut usize);
    let layout = std::alloc::Layout::from_size_align_unchecked(size + ALIGN, ALIGN);

    std::alloc::dealloc(ptr, layout);
  }

  #[no_mangle]
  pub unsafe extern "C" fn napi_register_wasm_v1(
    raw_env: napi::sys::napi_env,
    raw_exports: napi::sys::napi_value,
  ) {
    // let env = Env::from_raw(raw_env);
    let mut exports = JsObject::from_raw_unchecked(raw_env, raw_exports);

    #[cfg_attr(rustfmt, rustfmt_skip)]
    {
      let _ = exports.create_named_method("transformReactLynxSync", crate::__napi__transform_react_lynx_sync);
      let _ = exports.create_named_method("transformBundleResultSync", crate::__napi__transform_bundle_result_sync);
      let _ = exports.create_named_method("transformReactLynx", crate::__napi__transform_react_lynx);
      let _ = exports.create_named_method("transformBundleResult", crate::__napi__transform_bundle_result);
    }
  }
}

#[cfg(test)]
mod tests {
  #[test]
  fn test_syntax_serialize_and_deserialize() {
    use super::*;
    use serde_json::json;

    let json = json!({
      "syntax": "typescript",
      "tsx": true,
    });
    let s: Syntax = serde_json::from_value(json).unwrap();

    // println!("{:?}", serde_json::to_string(&s));

    assert_eq!(s.typescript(), true);
    assert_eq!(s.decorators(), false); // default to false
  }
}
