// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use fs4::FileExt;
use std::env;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use std::process::Command;

const MACOS_AARCH64_RUNTIME_URL: &str = concat!(
  "https://github.com/PupilTong/playground/releases/download/",
  "lynx-runtime-clay-manual-0.0.2/macos-arm64-libLynx_clay.dylib"
);
const LINUX_X86_64_RUNTIME_URL: &str = concat!(
  "https://github.com/PupilTong/playground/releases/download/",
  "lynx-runtime-clay-manual-0.0.2/linux-amd64-libLynx_clay.so"
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
  prepare_runtime(&sdk_dir, &runtime_path, runtime_url());

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
  default_runtime_url().is_some() || env::var_os("LYNX_RUNTIME_URL").is_some()
}

fn enabled_env_flag(value: &OsStr) -> bool {
  !matches!(
    value.to_string_lossy().to_ascii_lowercase().as_str(),
    "0" | "false" | "no" | "off"
  )
}

fn runtime_url() -> String {
  if let Some(url) = env::var_os("LYNX_RUNTIME_URL") {
    return url.to_string_lossy().into_owned();
  }
  if let Some(url) = default_runtime_url() {
    return url.to_string();
  }
  panic!(
    "no default Lynx runtime URL is configured for target {}; set LYNX_RUNTIME_URL",
    target_triple_name()
  );
}

fn default_runtime_url() -> Option<&'static str> {
  match (
    env::var("CARGO_CFG_TARGET_OS").as_deref(),
    env::var("CARGO_CFG_TARGET_ARCH").as_deref(),
  ) {
    (Ok("macos"), Ok("aarch64")) => Some(MACOS_AARCH64_RUNTIME_URL),
    (Ok("linux"), Ok("x86_64")) => Some(LINUX_X86_64_RUNTIME_URL),
    _ => None,
  }
}

fn target_triple_name() -> String {
  let arch = env::var("CARGO_CFG_TARGET_ARCH").unwrap_or_else(|_| "unknown".into());
  let os = env::var("CARGO_CFG_TARGET_OS").unwrap_or_else(|_| "unknown".into());
  format!("{arch}-{os}")
}

fn prepare_runtime(sdk_dir: &Path, runtime_path: &Path, url: String) {
  fs::create_dir_all(sdk_dir).unwrap_or_else(|error| {
    panic!(
      "failed to create Lynx runtime SDK directory {}: {error}",
      sdk_dir.display()
    )
  });

  let lock_path = sdk_dir.join(".download.lock");
  let _lock = RuntimeDownloadLock::acquire(&lock_path);

  if !has_existing_runtime(runtime_path, &url) {
    download_runtime(&url, runtime_path);
  }
  adhoc_sign_if_needed(runtime_path);
}

fn has_existing_runtime(runtime_path: &Path, url: &str) -> bool {
  match fs::metadata(runtime_path) {
    Ok(metadata)
      if metadata.is_file() && metadata.len() > 0 && runtime_url_matches(runtime_path, url) =>
    {
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

  let mut response = ureq::get(url)
    .call()
    .unwrap_or_else(|error| panic!("failed to download Lynx runtime from {url}: {error}"));
  let mut response_body = response.body_mut().as_reader();
  let mut tmp_file = tempfile::Builder::new()
    .prefix(
      runtime_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("libLynx_clay"),
    )
    .suffix(".tmp")
    .tempfile_in(parent)
    .unwrap_or_else(|error| {
      panic!(
        "failed to create temporary Lynx runtime file in {}: {error}",
        parent.display()
      )
    });
  io::copy(&mut response_body, &mut tmp_file).unwrap_or_else(|error| {
    panic!(
      "failed to write downloaded Lynx runtime to {}: {error}",
      tmp_file.path().display()
    )
  });
  tmp_file.persist(runtime_path).unwrap_or_else(|error| {
    panic!(
      "failed to move downloaded Lynx runtime to {}: {}",
      runtime_path.display(),
      error.error
    )
  });
  write_runtime_url_marker(runtime_path, url);
}

fn runtime_url_matches(runtime_path: &Path, url: &str) -> bool {
  fs::read_to_string(runtime_url_marker_path(runtime_path))
    .map(|stored_url| stored_url.trim() == url)
    .unwrap_or(false)
}

fn write_runtime_url_marker(runtime_path: &Path, url: &str) {
  let marker_path = runtime_url_marker_path(runtime_path);
  fs::write(&marker_path, format!("{url}\n")).unwrap_or_else(|error| {
    panic!(
      "failed to write Lynx runtime URL marker {}: {error}",
      marker_path.display()
    )
  });
}

fn runtime_url_marker_path(runtime_path: &Path) -> PathBuf {
  let filename = runtime_path
    .file_name()
    .expect("runtime path has filename")
    .to_string_lossy();
  runtime_path.with_file_name(format!("{filename}.url"))
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
  file: File,
}

impl RuntimeDownloadLock {
  fn acquire(path: &Path) -> Self {
    let parent = path.parent().expect("lock path has parent directory");
    fs::create_dir_all(parent).unwrap_or_else(|error| {
      panic!(
        "failed to create Lynx runtime lock directory {}: {error}",
        parent.display()
      )
    });
    let file = OpenOptions::new()
      .create(true)
      .read(true)
      .truncate(false)
      .write(true)
      .open(path)
      .unwrap_or_else(|error| {
        panic!(
          "failed to open Lynx runtime download lock {}: {error}",
          path.display()
        )
      });
    FileExt::lock(&file).unwrap_or_else(|error| {
      panic!(
        "failed to lock Lynx runtime download lock {}: {error}",
        path.display()
      )
    });
    Self { file }
  }
}

impl Drop for RuntimeDownloadLock {
  fn drop(&mut self) {
    let _ = FileExt::unlock(&self.file);
  }
}
