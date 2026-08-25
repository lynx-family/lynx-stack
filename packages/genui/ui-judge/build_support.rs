// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::ffi::OsStr;
use std::path::{Path, PathBuf};

pub(crate) fn lynx_core_source(manifest_dir: &Path, configured: Option<&OsStr>) -> PathBuf {
  configured.map(PathBuf::from).unwrap_or_else(|| {
    manifest_dir.join("../../lynx/headless-rust-test-runner/fixtures/react/lynx_core.js")
  })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn uses_configured_lynx_core_source() {
    let source = lynx_core_source(
      Path::new("/workspace/packages/genui/ui-judge"),
      Some(OsStr::new("/tmp/lynx_kernal.js")),
    );

    assert_eq!(source, Path::new("/tmp/lynx_kernal.js"));
  }

  #[test]
  fn falls_back_to_the_runner_fixture() {
    let source = lynx_core_source(Path::new("/workspace/packages/genui/ui-judge"), None);

    assert_eq!(
      source,
      Path::new(
        "/workspace/packages/genui/ui-judge/../../lynx/headless-rust-test-runner/fixtures/react/lynx_core.js"
      )
    );
  }
}
