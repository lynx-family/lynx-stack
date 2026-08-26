// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::env;
use std::path::PathBuf;

#[allow(dead_code)]
#[path = "../engine-bridge/tools/runtime_build.rs"]
mod runtime_build;

fn main() {
  println!("cargo:rerun-if-changed=build.rs");

  let manifest_dir =
    PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("Cargo must set CARGO_MANIFEST_DIR"));
  let engine_bridge_dir = manifest_dir.join("../engine-bridge");
  runtime_build::prepare_lynx_core_for(&engine_bridge_dir);
}
