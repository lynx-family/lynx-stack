use std::path::PathBuf;

use thiserror::Error;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
  #[error("Lynx engine error: {0}")]
  Engine(#[from] lynx::Error),
  #[error("I/O error: {0}")]
  Io(#[from] std::io::Error),
  #[error("JSON error: {0}")]
  Json(#[from] serde_json::Error),
  #[error("URL error: {0}")]
  Url(#[from] url::ParseError),
  #[error("PNG encoding error: {0}")]
  Png(#[from] png::EncodingError),
  #[error("missing lynx_core.js; set ConnectOptions::lynx_core_path or LYNX_CORE_JS_PATH")]
  MissingLynxCore,
  #[error("Lynx core resource does not exist: {0}")]
  LynxCoreNotFound(PathBuf),
  #[error("failed to fetch {url}: {message}")]
  Fetch { url: String, message: String },
  #[error("no headless Rust test runner debug-router client found")]
  ClientNotFound,
  #[error("cannot find a debug session for URL: {0}")]
  SessionNotFound(String),
  #[error("debug-router protocol error: {0}")]
  Protocol(String),
  #[error("CDP request error: {0}")]
  Cdp(String),
  #[error("operation timed out: {0}")]
  Timeout(String),
  #[error("page is not loaded; call goto().await first")]
  PageNotLoaded,
  #[error("no rendered frame is available")]
  FrameNotAvailable,
}
