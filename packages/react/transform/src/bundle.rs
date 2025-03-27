#![deny(clippy::all)]

use crate::esbuild::{EsbuildEmitter, PartialMessage};
use napi::Either;
use std::vec;
use swc_core::common::pass::Optional;
use swc_core::{
  base::{
    config::{IsModule, SourceMapsConfig},
    Compiler, PrintArgs,
  },
  common::{
    comments::SingleThreadedComments,
    errors::{DiagnosticBuilder, Emitter, Handler, HANDLER},
    sync::Lrc,
    FileName, FilePathMapping, Mark, SourceMap, GLOBALS,
  },
  ecma::{
    ast::*,
    codegen,
    parser::{EsSyntax, Syntax},
    transforms::base::{helpers, hygiene::hygiene_with_config, resolver},
    visit::visit_mut_pass,
  },
};

// currently `use xxx as yyy` is not supported by napi-rs
// So we have to use different name
use crate::swc_plugin_extract_str::{ExtractStrConfig, ExtractStrVisitor};
use crate::swc_plugin_worklet_post_process::WorkletPostProcessorVisitor;

#[napi(object)]
#[derive(Clone, Debug)]
pub struct TransformNodiffBundleOptions {
  pub filename: String,
  pub plugin_name: String,
  pub source_file_name: Option<String>,
  pub sourcemap: Either<bool, String>,
  pub extract_str: Either<bool, ExtractStrConfig>,
  pub minify: Option<bool>,
}

impl Default for TransformNodiffBundleOptions {
  fn default() -> Self {
    Self {
      plugin_name: Default::default(),
      filename: Default::default(),
      source_file_name: Default::default(),
      sourcemap: Either::A(false),
      extract_str: Either::A(false),
      minify: Some(false),
    }
  }
}

#[napi(object)]
pub struct TransformNodiffBundleOutput {
  pub code: String,
  pub map: Option<String>,
  pub select_str_vec: Option<Vec<String>>,
  pub use_worklet: Option<bool>,

  // #[napi(ts_type = "Array<import('esbuild').PartialMessage>")]
  pub errors: Vec<PartialMessage>,
  // #[napi(ts_type = "Array<import('esbuild').PartialMessage>")]
  pub warnings: Vec<PartialMessage>,
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

pub fn transform_bundle_result_inner(
  code: String,
  options: TransformNodiffBundleOptions,
) -> TransformNodiffBundleOutput {
  let comments = SingleThreadedComments::default();
  let cm = Lrc::new(SourceMap::new(FilePathMapping::empty()));
  let fm = cm.new_source_file(FileName::Real(options.filename.clone().into()).into(), code);

  let c = Compiler::new(cm);

  let (esbuild_emitter, errors, warnings) =
    EsbuildEmitter::new(options.plugin_name.clone(), Some(c.cm.clone()));
  let esbuild_emitter = Box::new(esbuild_emitter);
  let emitter = Box::new(MultiEmitter::new(vec![esbuild_emitter]));
  let handler = Handler::with_emitter(true, false, emitter);

  let result = GLOBALS.set(&Default::default(), || {
    let program = c.parse_js(
      fm,
      &handler,
      EsVersion::latest(),
      Syntax::Es(EsSyntax::default()),
      IsModule::Bool(true),
      Some(&comments),
    );
    let should_extract_str = match options.extract_str {
      Either::A(config) => config,
      Either::B(_) => true,
    };
    let program = match program {
      Ok(program) => program,
      Err(_) => {
        return TransformNodiffBundleOutput {
          code: "".into(),
          map: None,
          errors: errors.read().unwrap().clone(),
          warnings: warnings.read().unwrap().clone(),
          select_str_vec: match should_extract_str {
            true => Some(vec!["".to_string()]),
            false => None,
          },
          use_worklet: None,
        };
      }
    };

    let mut extract_str_vis: ExtractStrVisitor = match options.extract_str {
      Either::A(_) => ExtractStrVisitor::default(),
      Either::B(config) => ExtractStrVisitor::new(config),
    };
    let extract_str_plugin =
      Optional::new(visit_mut_pass(&mut extract_str_vis), should_extract_str);
    let mut worklet_post_process_vis = WorkletPostProcessorVisitor::default();
    let worklet_post_process_plugin = visit_mut_pass(&mut worklet_post_process_vis);

    let pass = (
      resolver(Mark::new(), Mark::new(), true),
      extract_str_plugin,
      worklet_post_process_plugin,
      hygiene_with_config(Default::default()),
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
        output_path: None,
        inline_sources_content: true,
        source_map: match options.sourcemap {
          Either::A(b) => SourceMapsConfig::Bool(b),
          Either::B(s) => SourceMapsConfig::Str(s),
        },
        source_map_names: &Default::default(),
        orig: None,
        comments: Some(&comments),
        emit_source_map_columns: true,
        preamble: "".into(),
        codegen_config: codegen::Config::default()
          .with_target(EsVersion::latest())
          .with_minify(options.minify.unwrap_or(false))
          .with_ascii_only(false),
      },
    );
    match result {
      Ok(result) => TransformNodiffBundleOutput {
        code: result.code,
        map: result.map,
        errors: vec![],
        warnings: vec![],
        select_str_vec: match should_extract_str {
          true => Some(extract_str_vis.select_str_vec),
          false => None,
        },
        use_worklet: Some(worklet_post_process_vis.result.has_worklet),
      },
      Err(_) => {
        return TransformNodiffBundleOutput {
          code: "".into(),
          map: None,
          errors: errors.read().unwrap().clone(),
          warnings: warnings.read().unwrap().clone(),
          select_str_vec: match should_extract_str {
            true => Some(vec!["".to_string()]),
            false => None,
          },
          use_worklet: None,
        };
      }
    }
  });

  let r = TransformNodiffBundleOutput {
    code: result.code,
    map: result.map,
    errors: errors.read().unwrap().clone(),
    warnings: warnings.read().unwrap().clone(),
    select_str_vec: result.select_str_vec,
    use_worklet: result.use_worklet,
  };

  r
}

// #[cfg(test)]
// mod tests {
//     use crate::bundle::transform_bundle_result_inner;
//     use crate::bundle::ExtractStrConfig;
//     use crate::bundle::TransformNodiffBundleOptions;
//     use napi::Either;
//     use std::io::Read;

//     #[test]
//     fn it_works() {
//       let mut file = std::fs::File::open("data.js").unwrap();
//       let mut contents = String::new();
//       file.read_to_string(&mut contents).unwrap();
//       let result = transform_bundle_result_inner(
//         contents,
//             TransformNodiffBundleOptions {
//                 plugin_name: Default::default(),
//                 filename: Default::default(),
//                 source_file_name: Default::default(),
//                 sourcemap: Either::A(false),
//                 extract_str: ExtractStrConfig {
//                     str_length: 1,
//                     extracted_str_arr: Some(vec!["c230e9ac4259909e9e83419cbd2a9960".to_string()]),
//                 },
//             },
//         );
//         println!("{}", result.code);
//         println!("{:?}", result.select_str_vec);
//     }
// }
