// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#[cfg(feature = "server")]
#[tokio::main]
async fn main() -> Result<(), ui_judge::server::ServerError> {
  let port = resolve_port(
    std::env::var("LYNX_USE_PORT").ok(),
    std::env::var("PORT").ok(),
  );
  ui_judge::server::serve(&port).await
}

#[cfg(feature = "server")]
fn resolve_port(lynx_use_port: Option<String>, port: Option<String>) -> String {
  lynx_use_port.or(port).unwrap_or_else(|| "8080".to_string())
}

#[cfg(all(test, feature = "server"))]
mod tests {
  use super::resolve_port;

  #[test]
  fn lynx_use_port_takes_priority() {
    assert_eq!(
      resolve_port(Some("4321".to_string()), Some("8080".to_string())),
      "4321",
    );
  }

  #[test]
  fn port_remains_a_compatibility_fallback() {
    assert_eq!(resolve_port(None, Some("9090".to_string())), "9090");
  }

  #[test]
  fn default_port_is_8080() {
    assert_eq!(resolve_port(None, None), "8080");
  }
}
