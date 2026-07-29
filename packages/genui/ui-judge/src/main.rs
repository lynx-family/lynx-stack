// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#[cfg(feature = "server")]
#[tokio::main]
async fn main() -> Result<(), ui_judge::server::ServerError> {
  let (host, port) = resolve_listen_options(std::env::var("HOST").ok(), std::env::var("PORT").ok());
  ui_judge::server::serve(&host, &port).await
}

#[cfg(feature = "server")]
fn resolve_listen_options(host: Option<String>, port: Option<String>) -> (String, String) {
  (
    host.unwrap_or_else(|| "0.0.0.0".to_string()),
    port.unwrap_or_else(|| "8080".to_string()),
  )
}

#[cfg(all(test, feature = "server"))]
mod tests {
  use super::resolve_listen_options;

  #[test]
  fn reads_host_and_port() {
    assert_eq!(
      resolve_listen_options(Some("127.0.0.1".to_string()), Some("4321".to_string())),
      ("127.0.0.1".to_string(), "4321".to_string()),
    );
  }

  #[test]
  fn uses_default_listen_options() {
    assert_eq!(
      resolve_listen_options(None, None),
      ("0.0.0.0".to_string(), "8080".to_string()),
    );
  }
}
