// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::env;
use std::ffi::{OsStr, OsString};
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
  println!("cargo:rerun-if-env-changed=LYNX_LIB_PATH");
  println!("cargo:rerun-if-env-changed=LYNX_SDK_DIR");
  println!("cargo:rerun-if-env-changed=LYNX_RUNTIME_URL");
  println!("cargo:rerun-if-env-changed=LYNX_DOWNLOAD_RUNTIME");
  println!("cargo:rerun-if-env-changed=PYTHON");

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
  let download_script = root.join("tools/download_runtime.py");
  let signing_script = root.join("tools/adhoc_sign_macos_sdk.py");
  println!("cargo:rerun-if-changed={}", download_script.display());
  println!("cargo:rerun-if-changed={}", signing_script.display());

  let sdk_dir = root.join("target/lynx-engine-bridge-sdk");
  let mut command =
    Command::new(env::var_os("PYTHON").unwrap_or_else(|| OsString::from("python3")));
  command
    .arg(&download_script)
    .arg("--sdk-dir")
    .arg(&sdk_dir)
    .arg("--library-name")
    .arg(library_name);
  if let Some(url) = env::var_os("LYNX_RUNTIME_URL") {
    command.arg("--url").arg(url);
  }

  let status = command.status().unwrap_or_else(|error| {
    panic!(
      "failed to start Lynx runtime downloader {}: {error}",
      download_script.display()
    )
  });
  if !status.success() {
    panic!(
      "failed to prepare Lynx runtime SDK with {}: {status}",
      download_script.display()
    );
  }

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

fn engine_bridge_root() -> PathBuf {
  let mut directory =
    PathBuf::from(env::var_os("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is set"));
  loop {
    if directory.join("tools/download_runtime.py").is_file() {
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
