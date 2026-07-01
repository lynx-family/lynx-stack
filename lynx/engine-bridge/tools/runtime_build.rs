// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::env;
use std::ffi::OsStr;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

const MACOS_RUNTIME_URL: &str = concat!(
  "https://github.com/PupilTong/playground/releases/download/",
  "lynx-runtime-clay-manual-0.0.1/libLynx_clay.dylib"
);

fn main() {
  println!("cargo:rerun-if-env-changed=LYNX_LIB_PATH");
  println!("cargo:rerun-if-env-changed=LYNX_SDK_DIR");
  println!("cargo:rerun-if-env-changed=LYNX_RUNTIME_URL");
  println!("cargo:rerun-if-env-changed=LYNX_DOWNLOAD_RUNTIME");
  println!("cargo:rerun-if-env-changed=LYNX_SKIP_ADHOC_SIGN");

  if let Some(lib_path) = env::var_os("LYNX_LIB_PATH") {
    emit_runtime_env("LYNX_LIB_PATH", PathBuf::from(lib_path));
    return;
  }
  if let Some(sdk_dir) = env::var_os("LYNX_SDK_DIR") {
    emit_runtime_env("LYNX_SDK_DIR", PathBuf::from(sdk_dir));
    return;
  }

  let Some(library_name) = target_library_name() else {
    return;
  };
  if !should_download_runtime() {
    return;
  }

  let root = engine_bridge_root();
  let build_helper = root.join("tools/runtime_build.rs");
  println!("cargo:rerun-if-changed={}", build_helper.display());

  let sdk_dir = root.join("target/lynx-engine-bridge-sdk");
  let runtime_path = sdk_dir.join("lib").join(library_name);
  prepare_runtime(&sdk_dir, &runtime_path, runtime_url(library_name));

  emit_runtime_env("LYNX_SDK_DIR", sdk_dir);
}

fn target_library_name() -> Option<&'static str> {
  match env::var("CARGO_CFG_TARGET_OS").as_deref() {
    Ok("macos") => Some("libLynx_clay.dylib"),
    Ok("linux") => Some("libLynx_clay.so"),
    _ => None,
  }
}

fn should_download_runtime() -> bool {
  if let Some(value) = env::var_os("LYNX_DOWNLOAD_RUNTIME") {
    return enabled_env_flag(&value);
  }
  env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos")
    || env::var_os("LYNX_RUNTIME_URL").is_some()
}

fn enabled_env_flag(value: &OsStr) -> bool {
  !matches!(
    value.to_string_lossy().to_ascii_lowercase().as_str(),
    "0" | "false" | "no" | "off"
  )
}

fn runtime_url(library_name: &str) -> String {
  if let Some(url) = env::var_os("LYNX_RUNTIME_URL") {
    return url.to_string_lossy().into_owned();
  }
  if library_name.ends_with(".dylib") {
    return MACOS_RUNTIME_URL.to_string();
  }
  panic!("no default Lynx runtime URL is configured; set LYNX_RUNTIME_URL");
}

fn prepare_runtime(sdk_dir: &Path, runtime_path: &Path, url: String) {
  if has_existing_runtime(runtime_path) {
    adhoc_sign_if_needed(runtime_path);
    return;
  }

  fs::create_dir_all(sdk_dir).unwrap_or_else(|error| {
    panic!(
      "failed to create Lynx runtime SDK directory {}: {error}",
      sdk_dir.display()
    )
  });

  let lock_dir = sdk_dir.join(".download-lock");
  let _lock = RuntimeDownloadLock::acquire(&lock_dir);

  if !has_existing_runtime(runtime_path) {
    download_runtime(&url, runtime_path);
  }
  adhoc_sign_if_needed(runtime_path);
}

fn has_existing_runtime(runtime_path: &Path) -> bool {
  match fs::metadata(runtime_path) {
    Ok(metadata) if metadata.is_file() && metadata.len() > 0 => {
      eprintln!("Using existing Lynx runtime at {}", runtime_path.display());
      true
    }
    _ => false,
  }
}

fn download_runtime(url: &str, runtime_path: &Path) {
  let parent = runtime_path
    .parent()
    .expect("runtime path has parent directory");
  fs::create_dir_all(parent).unwrap_or_else(|error| {
    panic!(
      "failed to create Lynx runtime library directory {}: {error}",
      parent.display()
    )
  });

  let tmp_path = runtime_path.with_extension(format!(
    "{}.{}.tmp",
    runtime_path
      .extension()
      .and_then(OsStr::to_str)
      .unwrap_or("download"),
    std::process::id()
  ));
  let status = Command::new("curl")
    .arg("-L")
    .arg("--silent")
    .arg("--show-error")
    .arg("--fail")
    .arg("--retry")
    .arg("5")
    .arg("--retry-connrefused")
    .arg("-o")
    .arg(&tmp_path)
    .arg(url)
    .status()
    .unwrap_or_else(|error| panic!("failed to start curl for Lynx runtime download: {error}"));
  if !status.success() {
    let _ = fs::remove_file(&tmp_path);
    panic!("failed to download Lynx runtime from {url}: {status}");
  }
  fs::rename(&tmp_path, runtime_path).unwrap_or_else(|error| {
    let _ = fs::remove_file(&tmp_path);
    panic!(
      "failed to move downloaded Lynx runtime to {}: {error}",
      runtime_path.display()
    )
  });
}

fn adhoc_sign_if_needed(runtime_path: &Path) {
  if env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos") {
    return;
  }
  match env::var_os("LYNX_SKIP_ADHOC_SIGN") {
    Some(value) if enabled_env_flag(&value) => return,
    _ => {}
  }

  let status = Command::new("codesign")
    .arg("--force")
    .arg("--sign")
    .arg("-")
    .arg(runtime_path)
    .status()
    .unwrap_or_else(|error| panic!("failed to start codesign for Lynx runtime: {error}"));
  if !status.success() {
    panic!(
      "failed to ad-hoc sign Lynx runtime {}: {status}",
      runtime_path.display()
    );
  }
}

fn engine_bridge_root() -> PathBuf {
  let mut directory =
    PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set"));
  loop {
    if directory.join("tools/runtime_build.rs").is_file() {
      return directory;
    }
    if !directory.pop() {
      panic!("failed to find engine-bridge root from CARGO_MANIFEST_DIR");
    }
  }
}

fn emit_runtime_env(key: &str, value: impl AsRef<Path>) {
  println!("cargo:rustc-env={key}={}", value.as_ref().display());
}

struct RuntimeDownloadLock {
  path: PathBuf,
}

impl RuntimeDownloadLock {
  fn acquire(path: &Path) -> Self {
    for _ in 0..600 {
      match fs::create_dir(path) {
        Ok(()) => {
          return Self {
            path: path.to_path_buf(),
          };
        }
        Err(error) if error.kind() == ErrorKind::AlreadyExists => {
          thread::sleep(Duration::from_millis(500));
        }
        Err(error) => {
          panic!(
            "failed to create Lynx runtime download lock {}: {error}",
            path.display()
          );
        }
      }
    }
    panic!(
      "timed out waiting for Lynx runtime download lock {}",
      path.display()
    );
  }
}

impl Drop for RuntimeDownloadLock {
  fn drop(&mut self) {
    let _ = fs::remove_dir(&self.path);
  }
}
