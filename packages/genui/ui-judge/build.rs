// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::env;
use std::fs;
use std::io;
use std::path::PathBuf;

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

  let out_dir = PathBuf::from(env::var_os("OUT_DIR").expect("Cargo must set OUT_DIR"));
  let profile_dir = out_dir
    .ancestors()
    .nth(3)
    .expect("OUT_DIR must be inside a Cargo profile directory");
  let start_script = profile_dir.join("start.sh");

  fs::write(&start_script, START_SCRIPT)?;

  #[cfg(unix)]
  {
    use std::os::unix::fs::PermissionsExt;

    fs::set_permissions(&start_script, fs::Permissions::from_mode(0o755))?;
  }

  Ok(())
}
