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
  #[error("LynxML source at {url} is not valid UTF-8: {source}")]
  InvalidLynxMlUtf8 {
    url: String,
    #[source]
    source: std::str::Utf8Error,
  },
  #[error(
    "GotoOptions::global_props_json is not supported for LynxML; the public LynxML load API does not accept global properties"
  )]
  UnsupportedLynxMlGlobalProps,
  #[error(
    "missing lynx_core.js; rebuild with automatic artifact downloads enabled, set ContainerOptions::lynx_core_path or LYNX_CORE_JS_PATH, or place it at $LYNX_SDK_DIR/resources/lynx_core.js"
  )]
  MissingLynxCore,
  #[error("Lynx core resource does not exist: {0}")]
  LynxCoreNotFound(PathBuf),
  #[error("failed to fetch {url}: {message}")]
  Fetch { url: String, message: String },
  #[error(
    "the loaded Lynx runtime does not expose a DevTools target for this page; DOM APIs require a runtime with lynx_view_get_devtool_target"
  )]
  DevtoolTargetUnavailable,
  #[error("debug-router protocol error: {0}")]
  Protocol(String),
  #[error("CDP request error: {0}")]
  Cdp(String),
  #[error("operation timed out: {0}")]
  Timeout(String),
  #[error("page is not loaded; call goto() first")]
  PageNotLoaded,
  #[error("no rendered frame is available")]
  FrameNotAvailable,
}
