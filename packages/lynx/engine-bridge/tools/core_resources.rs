// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::fs;
use std::io;
use std::path::Path;

/// The Linux desktop loader requests this filename when DevTools is enabled.
/// Keep a supplied dev script, otherwise follow the installed production core.
pub(crate) fn install_lynx_core_dev_fallback(core: &Path) -> io::Result<()> {
  let destination = core.with_file_name("lynx_core_dev.js");
  match fs::symlink_metadata(&destination) {
    Ok(_) => return Ok(()),
    Err(error) if error.kind() == io::ErrorKind::NotFound => {}
    Err(error) => return Err(error),
  }
  // A relative symlink survives moving a packaged server and follows atomic
  // replacements of lynx_core.js without keeping an outdated fallback copy.
  match std::os::unix::fs::symlink("lynx_core.js", destination) {
    Ok(()) => Ok(()),
    // Another process may have installed the fallback or a real dev script.
    Err(error) if error.kind() == io::ErrorKind::AlreadyExists => Ok(()),
    Err(error) => Err(error),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn missing_dev_core_follows_the_installed_core() {
    let directory = tempfile::tempdir().unwrap();
    let core = directory.path().join("lynx_core.js");
    let dev = directory.path().join("lynx_core_dev.js");
    fs::write(&core, b"production core").unwrap();

    install_lynx_core_dev_fallback(&core).unwrap();

    assert_eq!(fs::read_link(&dev).unwrap(), Path::new("lynx_core.js"));
    assert_eq!(fs::read(&dev).unwrap(), b"production core");
    let replacement = directory.path().join("replacement.js");
    fs::write(&replacement, b"updated core").unwrap();
    fs::rename(replacement, &core).unwrap();
    assert_eq!(fs::read(&dev).unwrap(), b"updated core");
    install_lynx_core_dev_fallback(&core).unwrap();
  }

  #[test]
  fn existing_dev_core_is_preserved() {
    let directory = tempfile::tempdir().unwrap();
    let core = directory.path().join("lynx_core.js");
    let dev = directory.path().join("lynx_core_dev.js");
    fs::write(&core, b"production core").unwrap();
    fs::write(&dev, b"dedicated dev core").unwrap();

    install_lynx_core_dev_fallback(&core).unwrap();

    assert!(!fs::symlink_metadata(&dev).unwrap().is_symlink());
    assert_eq!(fs::read(dev).unwrap(), b"dedicated dev core");
  }

  #[test]
  fn packaged_fallback_works_after_relocation_without_directory_writes() {
    use std::os::unix::fs::PermissionsExt;

    let directory = tempfile::tempdir().unwrap();
    let original = directory.path().join("original");
    let relocated = directory.path().join("relocated");
    fs::create_dir(&original).unwrap();
    let core = original.join("lynx_core.js");
    fs::write(&core, b"packaged core").unwrap();
    install_lynx_core_dev_fallback(&core).unwrap();
    fs::rename(&original, &relocated).unwrap();
    fs::set_permissions(&relocated, fs::Permissions::from_mode(0o555)).unwrap();

    let result = install_lynx_core_dev_fallback(&relocated.join("lynx_core.js"));
    let bytes = fs::read(relocated.join("lynx_core_dev.js"));
    fs::set_permissions(&relocated, fs::Permissions::from_mode(0o755)).unwrap();
    result.unwrap();
    assert_eq!(bytes.unwrap(), b"packaged core");
  }

  #[test]
  fn concurrent_fallback_installations_publish_a_complete_core() {
    let directory = tempfile::tempdir().unwrap();
    let core = directory.path().join("lynx_core.js");
    fs::write(&core, b"production core").unwrap();
    let barrier = std::sync::Barrier::new(4);
    std::thread::scope(|scope| {
      for _ in 0..4 {
        scope.spawn(|| {
          barrier.wait();
          install_lynx_core_dev_fallback(&core).unwrap();
          assert_eq!(
            fs::read(core.with_file_name("lynx_core_dev.js")).unwrap(),
            b"production core"
          );
        });
      }
    });
  }
}
