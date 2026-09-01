// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#[cfg(feature = "server")]
fn main() -> Result<(), ui_judge::server::ServerError> {
  configure_packaged_runtime();
  if ui_judge::server::run_zip_capture_child()? {
    return Ok(());
  }
  let port = std::env::var("LYNX_USE_PORT").unwrap_or_else(|_| "8080".to_string());
  tokio::runtime::Builder::new_multi_thread()
    .enable_all()
    .build()?
    .block_on(ui_judge::server::serve(&port))
}

#[cfg(feature = "server")]
fn configure_packaged_runtime() {
  let Some(executable_dir) = std::env::current_exe()
    .ok()
    .and_then(|executable| executable.parent().map(ToOwned::to_owned))
  else {
    return;
  };
  let (runtime_name, lynx_core_path) = if cfg!(target_os = "macos") {
    (
      "libLynx_clay.dylib",
      executable_dir.join("LynxResources.bundle/lynx_core.js"),
    )
  } else if cfg!(target_os = "linux") {
    ("libLynx_clay.so", executable_dir.join("lynx_core.js"))
  } else {
    return;
  };

  if std::env::var_os("LYNX_LIB_PATH").is_none() && std::env::var_os("LYNX_SDK_DIR").is_none() {
    let runtime_path = executable_dir.join("lib").join(runtime_name);
    if runtime_path.is_file() {
      std::env::set_var("LYNX_LIB_PATH", runtime_path);
    }
  }
  if std::env::var_os("LYNX_CORE_JS_PATH").is_none()
    && std::env::var_os("LYNX_SDK_DIR").is_none()
    && lynx_core_path.is_file()
  {
    std::env::set_var("LYNX_CORE_JS_PATH", lynx_core_path);
  }
}
