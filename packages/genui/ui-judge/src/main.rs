// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

#[cfg(feature = "server")]
#[tokio::main]
async fn main() -> Result<(), ui_judge::server::ServerError> {
  let port = std::env::var("PORT").unwrap_or_else(|_| "8080".to_string());
  ui_judge::server::serve(&port).await
}
