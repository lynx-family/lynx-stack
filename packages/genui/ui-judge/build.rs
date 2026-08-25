// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::env;
use std::fs;
use std::io;
use std::path::Path;
use std::path::PathBuf;

mod build_support;

#[path = "../../lynx/engine-bridge/tools/runtime_build.rs"]
mod runtime_build;

use build_support::lynx_core_source;

const START_SCRIPT: &str = r#"#!/bin/sh

set -eu

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec "${SCRIPT_DIR}/ui-judge-server" "$@"
"#;

fn main() -> io::Result<()> {
  println!("cargo:rerun-if-changed=build.rs");

  if env::var_os("CARGO_FEATURE_SERVER").is_none() {
    return Ok(());
  }
  println!("cargo:rerun-if-env-changed=LYNX_CORE_JS_PATH");

  let manifest_dir =
    PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("Cargo must set CARGO_MANIFEST_DIR"));
  let engine_bridge_dir = manifest_dir.join("../../lynx/engine-bridge");
  let runtime_source = runtime_build::prepare_runtime_for(&engine_bridge_dir)
    .ok_or_else(|| io::Error::other("no Lynx runtime is configured for this target"))?;
  let runtime_name = runtime_build::target_library_name()
    .ok_or_else(|| io::Error::other("the Lynx runtime is not supported on this target"))?;

  let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo must set OUT_DIR"));
  let profile_dir = out_dir
    .ancestors()
    .nth(3)
    .expect("OUT_DIR must be inside a Cargo profile directory")
    .to_path_buf();
  let start_script = profile_dir.join("start.sh");
  let runtime_destination = profile_dir.join("lib").join(runtime_name);
  let configured_lynx_core = env::var_os("LYNX_CORE_JS_PATH");
  let lynx_core_source = lynx_core_source(&manifest_dir, configured_lynx_core.as_deref());
  let lynx_core_destination = if env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
    profile_dir.join("LynxResources.bundle/lynx_core.js")
  } else {
    profile_dir.join("lynx_core.js")
  };

  copy_file(&runtime_source, &runtime_destination)?;
  copy_file(&lynx_core_source, &lynx_core_destination)?;
  fs::write(&start_script, START_SCRIPT)?;

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(&start_script, fs::Permissions::from_mode(0o755))?;
  }

  Ok(())
}

fn copy_file(source: &Path, destination: &Path) -> io::Result<()> {
  println!("cargo:rerun-if-changed={}", source.display());
  fs::create_dir_all(
    destination
      .parent()
      .expect("packaged runtime asset must have a parent directory"),
  )?;
  fs::copy(source, destination)?;
  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(destination, fs::Permissions::from_mode(0o644))?;
  }
  Ok(())
}
