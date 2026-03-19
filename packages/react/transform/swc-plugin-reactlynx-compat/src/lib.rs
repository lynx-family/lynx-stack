use swc_core::{
  ecma::{ast::*, visit::visit_mut_pass},
  plugin::{plugin_transform, proxies::TransformPluginProgramMetadata},
};

use swc_plugin_compat::{CompatVisitor, CompatVisitorConfig};

#[plugin_transform]
pub fn process_transform(program: Program, metadata: TransformPluginProgramMetadata) -> Program {
  let config_json = metadata.get_transform_plugin_config().unwrap_or_default();
  let config: CompatVisitorConfig = serde_json::from_str(&config_json).unwrap_or_default();
  let comments = metadata.comments.as_ref();

  program.apply(&mut visit_mut_pass(CompatVisitor::new(config, comments)))
}
