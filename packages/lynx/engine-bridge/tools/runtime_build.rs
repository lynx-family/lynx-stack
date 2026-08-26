// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use fs2::FileExt;
use sha2::{Digest, Sha256};
use std::env;
use std::ffi::OsStr;
use std::fs::{self, File, OpenOptions};
use std::io;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::process::Command;

const MACOS_AARCH64_RUNTIME_URL: &str = concat!(
  "https://github.com/PupilTong/playground/releases/download/",
  "lynx-runtime-clay-manual-0.0.4/macos-arm64-libLynx_clay.dylib"
);
const MACOS_AARCH64_RUNTIME_SHA256: &str =
  "dfbf7848b03b5fcf145a5445f57f771c5175a551fb3cfa106bd03d924c7d025e";
const LINUX_X86_64_RUNTIME_URL: &str = concat!(
  "https://github.com/PupilTong/playground/releases/download/",
  "lynx-runtime-clay-manual-0.0.4/linux-amd64-libLynx_clay.so"
);
const LINUX_X86_64_RUNTIME_SHA256: &str =
  "db12b6d6e61a8fb378f6517b7c4df7f017304c52c54a6bd604c362a7d5f517a4";
const LYNX_CORE_JS_URL: &str = concat!(
  "https://github.com/PupilTong/playground/releases/download/",
  "lynx-runtime-clay-manual-0.0.4/lynx_core.js"
);
const LYNX_CORE_JS_SHA256: &str =
  "81f0b9dbf51684872de0489b037110eab448e42039f5ac69d6ebe18371ea3efa";

pub(crate) fn prepare_runtime_for(root: &Path) -> Option<PathBuf> {
  println!("cargo:rerun-if-env-changed=LYNX_LIB_PATH");
  println!("cargo:rerun-if-env-changed=LYNX_SDK_DIR");
  println!("cargo:rerun-if-env-changed=LYNX_RUNTIME_URL");
  println!("cargo:rerun-if-env-changed=LYNX_RUNTIME_SHA256");
  println!("cargo:rerun-if-env-changed=LYNX_DOWNLOAD_RUNTIME");
  println!("cargo:rerun-if-env-changed=LYNX_SKIP_ADHOC_SIGN");

  if let Some(lib_path) = env::var_os("LYNX_LIB_PATH") {
    let lib_path = PathBuf::from(lib_path);
    emit_path_env("LYNX_LIB_PATH", &lib_path);
    return Some(lib_path);
  }
  if let Some(sdk_dir) = env::var_os("LYNX_SDK_DIR") {
    let sdk_dir = PathBuf::from(sdk_dir);
    emit_path_env("LYNX_SDK_DIR", &sdk_dir);
    return target_library_name().map(|library_name| sdk_dir.join("lib").join(library_name));
  }

  let library_name = target_library_name()?;
  if !should_download_runtime() {
    return None;
  }

  let build_helper = root.join("tools/runtime_build.rs");
  println!("cargo:rerun-if-changed={}", build_helper.display());

  let sdk_dir = root.join("target/lynx-engine-bridge-sdk");
  let runtime_path = sdk_dir.join("lib").join(library_name);
  let url = runtime_url();
  let sha256 = runtime_sha256(&url);
  prepare_runtime(&sdk_dir, &runtime_path, &url, &sha256);

  emit_path_env("LYNX_SDK_DIR", sdk_dir);
  Some(runtime_path)
}

pub(crate) fn prepare_lynx_core_for(root: &Path) -> Option<PathBuf> {
  println!("cargo:rerun-if-env-changed=LYNX_CORE_JS_PATH");
  println!("cargo:rerun-if-env-changed=LYNX_CORE_JS_URL");
  println!("cargo:rerun-if-env-changed=LYNX_CORE_JS_SHA256");
  println!("cargo:rerun-if-env-changed=LYNX_DOWNLOAD_RUNTIME");

  let build_helper = root.join("tools/runtime_build.rs");
  println!("cargo:rerun-if-changed={}", build_helper.display());

  if let Some(core_path) = env::var_os("LYNX_CORE_JS_PATH") {
    let core_path = PathBuf::from(core_path);
    println!("cargo:rerun-if-changed={}", core_path.display());
    emit_path_env("LYNX_CORE_JS_PATH", &core_path);
    return Some(core_path);
  }
  if !should_download_lynx_core() {
    return None;
  }

  let sdk_dir = root.join("target/lynx-engine-bridge-sdk");
  let core_path = sdk_dir.join("resources/lynx_core.js");
  let url = lynx_core_url();
  let sha256 = lynx_core_sha256(&url);
  prepare_lynx_core(&sdk_dir, &core_path, &url, &sha256);

  emit_path_env("LYNX_CORE_JS_PATH", &core_path);
  Some(core_path)
}

pub(crate) fn target_library_name() -> Option<&'static str> {
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

fn should_download_lynx_core() -> bool {
  if let Some(value) = env::var_os("LYNX_DOWNLOAD_RUNTIME") {
    return enabled_env_flag(&value);
  }
  default_runtime_url().is_some() || env::var_os("LYNX_CORE_JS_URL").is_some()
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

fn runtime_sha256(url: &str) -> String {
  if let Some(sha256) = env::var_os("LYNX_RUNTIME_SHA256") {
    return sha256.to_string_lossy().into_owned();
  }
  match url {
    MACOS_AARCH64_RUNTIME_URL => MACOS_AARCH64_RUNTIME_SHA256.to_string(),
    LINUX_X86_64_RUNTIME_URL => LINUX_X86_64_RUNTIME_SHA256.to_string(),
    _ => panic!("LYNX_RUNTIME_SHA256 must be set when LYNX_RUNTIME_URL is customized"),
  }
}

fn lynx_core_url() -> String {
  env::var_os("LYNX_CORE_JS_URL")
    .map(|url| url.to_string_lossy().into_owned())
    .unwrap_or_else(|| LYNX_CORE_JS_URL.to_string())
}

fn lynx_core_sha256(url: &str) -> String {
  if let Some(sha256) = env::var_os("LYNX_CORE_JS_SHA256") {
    return sha256.to_string_lossy().into_owned();
  }
  if url == LYNX_CORE_JS_URL {
    return LYNX_CORE_JS_SHA256.to_string();
  }
  panic!("LYNX_CORE_JS_SHA256 must be set when LYNX_CORE_JS_URL is customized");
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

fn prepare_runtime(sdk_dir: &Path, runtime_path: &Path, url: &str, sha256: &str) {
  fs::create_dir_all(sdk_dir).unwrap_or_else(|error| {
    panic!(
      "failed to create Lynx artifact cache directory {}: {error}",
      sdk_dir.display()
    )
  });

  let lock_path = sdk_dir.join(".download.lock");
  let _lock = ArtifactDownloadLock::acquire(&lock_path);

  let runtime_existed = has_existing_runtime(runtime_path, url, sha256);
  if !runtime_existed {
    download_artifact("Lynx runtime", url, runtime_path, sha256);
    adhoc_sign_if_needed(runtime_path);
    write_artifact_url_marker("Lynx runtime", runtime_path, url);
    write_artifact_sha256_marker("Lynx runtime", runtime_path, sha256);
  } else {
    eprintln!("Using existing Lynx runtime at {}", runtime_path.display());
  }
}

fn prepare_lynx_core(sdk_dir: &Path, core_path: &Path, url: &str, sha256: &str) {
  fs::create_dir_all(sdk_dir).unwrap_or_else(|error| {
    panic!(
      "failed to create Lynx artifact cache directory {}: {error}",
      sdk_dir.display()
    )
  });

  let lock_path = sdk_dir.join(".download.lock");
  let _lock = ArtifactDownloadLock::acquire(&lock_path);

  if !has_existing_downloaded_artifact(core_path, url, sha256) {
    download_artifact("Lynx core script", url, core_path, sha256);
    write_artifact_url_marker("Lynx core script", core_path, url);
    write_artifact_sha256_marker("Lynx core script", core_path, sha256);
  } else {
    eprintln!("Using existing Lynx core script at {}", core_path.display());
  }
}

fn has_existing_runtime(runtime_path: &Path, url: &str, sha256: &str) -> bool {
  match fs::metadata(runtime_path) {
    Ok(metadata)
      if metadata.is_file()
        && metadata.len() > 0
        && artifact_url_matches(runtime_path, url)
        && artifact_sha256_marker_matches(runtime_path, sha256) =>
    {
      if existing_runtime_matches_downloaded_bytes() {
        verify_artifact_checksum("Lynx runtime", runtime_path, sha256);
      }
      true
    }
    _ => false,
  }
}

fn has_existing_downloaded_artifact(artifact_path: &Path, url: &str, sha256: &str) -> bool {
  match fs::metadata(artifact_path) {
    Ok(metadata)
      if metadata.is_file()
        && metadata.len() > 0
        && artifact_url_matches(artifact_path, url)
        && artifact_sha256_marker_matches(artifact_path, sha256) =>
    {
      verify_artifact_checksum("Lynx core script", artifact_path, sha256);
      true
    }
    _ => false,
  }
}

fn download_artifact(kind: &str, url: &str, artifact_path: &Path, sha256: &str) {
  let parent = artifact_path
    .parent()
    .expect("artifact path has parent directory");
  fs::create_dir_all(parent).unwrap_or_else(|error| {
    panic!(
      "failed to create {kind} directory {}: {error}",
      parent.display()
    )
  });

  let mut response = reqwest::blocking::get(url)
    .and_then(reqwest::blocking::Response::error_for_status)
    .unwrap_or_else(|error| panic!("failed to download {kind} from {url}: {error}"));
  let mut tmp_file = tempfile::Builder::new()
    .prefix(
      artifact_path
        .file_name()
        .and_then(OsStr::to_str)
        .unwrap_or("lynx-artifact"),
    )
    .suffix(".tmp")
    .tempfile_in(parent)
    .unwrap_or_else(|error| {
      panic!(
        "failed to create temporary {kind} file in {}: {error}",
        parent.display()
      )
    });
  io::copy(&mut response, &mut tmp_file).unwrap_or_else(|error| {
    panic!(
      "failed to write downloaded {kind} to {}: {error}",
      tmp_file.path().display()
    )
  });
  verify_artifact_checksum(kind, tmp_file.path(), sha256);
  tmp_file.persist(artifact_path).unwrap_or_else(|error| {
    panic!(
      "failed to move downloaded {kind} to {}: {}",
      artifact_path.display(),
      error.error
    )
  });
}

fn existing_runtime_matches_downloaded_bytes() -> bool {
  env::var("CARGO_CFG_TARGET_OS").as_deref() != Ok("macos")
    || env::var_os("LYNX_SKIP_ADHOC_SIGN")
      .as_deref()
      .is_some_and(enabled_env_flag)
}

fn verify_artifact_checksum(kind: &str, artifact_path: &Path, expected_sha256: &str) {
  let actual_sha256 = file_sha256(artifact_path);
  if actual_sha256 != expected_sha256.trim().to_ascii_lowercase() {
    panic!(
      "{kind} checksum mismatch for {}: expected {}, got {}",
      artifact_path.display(),
      expected_sha256,
      actual_sha256
    );
  }
}

fn file_sha256(path: &Path) -> String {
  let mut file = File::open(path).unwrap_or_else(|error| {
    panic!(
      "failed to open artifact for checksum {}: {error}",
      path.display()
    )
  });
  // sha2 0.11 dropped the `io::Write` impl (digest 0.11 has no `std` feature at
  // all), and `finalize` now returns an `Array` that is not `LowerHex`.
  let mut hasher = Sha256::new();
  let mut buffer = [0u8; 64 * 1024];
  loop {
    let read = file.read(&mut buffer).unwrap_or_else(|error| {
      panic!(
        "failed to read artifact for checksum {}: {error}",
        path.display()
      )
    });
    if read == 0 {
      break;
    }
    hasher.update(&buffer[..read]);
  }
  hex::encode(hasher.finalize())
}

fn artifact_url_matches(artifact_path: &Path, url: &str) -> bool {
  fs::read_to_string(artifact_url_marker_path(artifact_path))
    .map(|stored_url| stored_url.trim() == url)
    .unwrap_or(false)
}

fn write_artifact_url_marker(kind: &str, artifact_path: &Path, url: &str) {
  let marker_path = artifact_url_marker_path(artifact_path);
  fs::write(&marker_path, format!("{url}\n")).unwrap_or_else(|error| {
    panic!(
      "failed to write {kind} URL marker {}: {error}",
      marker_path.display()
    )
  });
}

fn artifact_sha256_marker_matches(artifact_path: &Path, sha256: &str) -> bool {
  fs::read_to_string(artifact_sha256_marker_path(artifact_path))
    .map(|stored_sha256| stored_sha256.trim() == sha256.trim().to_ascii_lowercase())
    .unwrap_or(false)
}

fn write_artifact_sha256_marker(kind: &str, artifact_path: &Path, sha256: &str) {
  let marker_path = artifact_sha256_marker_path(artifact_path);
  fs::write(
    &marker_path,
    format!("{}\n", sha256.trim().to_ascii_lowercase()),
  )
  .unwrap_or_else(|error| {
    panic!(
      "failed to write {kind} SHA256 marker {}: {error}",
      marker_path.display()
    )
  });
}

fn artifact_url_marker_path(artifact_path: &Path) -> PathBuf {
  let filename = artifact_path
    .file_name()
    .expect("artifact path has filename")
    .to_string_lossy();
  artifact_path.with_file_name(format!("{filename}.url"))
}

fn artifact_sha256_marker_path(artifact_path: &Path) -> PathBuf {
  let filename = artifact_path
    .file_name()
    .expect("artifact path has filename")
    .to_string_lossy();
  artifact_path.with_file_name(format!("{filename}.sha256"))
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

fn emit_path_env(key: &str, value: impl AsRef<Path>) {
  println!("cargo:rustc-env={key}={}", value.as_ref().display());
}

struct ArtifactDownloadLock {
  file: File,
}

impl ArtifactDownloadLock {
  fn acquire(path: &Path) -> Self {
    let parent = path.parent().expect("lock path has parent directory");
    fs::create_dir_all(parent).unwrap_or_else(|error| {
      panic!(
        "failed to create Lynx artifact lock directory {}: {error}",
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
          "failed to open Lynx artifact download lock {}: {error}",
          path.display()
        )
      });
    file.lock_exclusive().unwrap_or_else(|error| {
      panic!(
        "failed to lock Lynx artifact download lock {}: {error}",
        path.display()
      )
    });
    Self { file }
  }
}

impl Drop for ArtifactDownloadLock {
  fn drop(&mut self) {
    let _ = self.file.unlock();
  }
}
