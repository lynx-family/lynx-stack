// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::io;
use std::io::{BufReader, BufWriter, Read, Write};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr, ToSocketAddrs};
use std::num::{NonZeroU16, ParseIntError};
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::extract::multipart::{Field, Multipart, MultipartError};
use axum::extract::{DefaultBodyLimit, FromRequest, Request, State};
use axum::http::{
  header::{CACHE_CONTROL, CONTENT_LENGTH, CONTENT_TYPE},
  StatusCode,
};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use lynx_headless_rust_test_runner::{
  ContainerOptions, GotoOptions, LynxContainer, ScreenshotOptions,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use socket2::{Domain, Protocol, SockAddr, Socket, Type};
use thiserror::Error;
use tokio::net::TcpListener;
use tokio::process::{Child, Command};
use tokio::sync::{oneshot, watch, Notify, OwnedSemaphorePermit, Semaphore};

use crate::capture::{shared_workers, CaptureError, CaptureWorkers, WorkerPanicked};
use crate::headless::PageLoadOptions;
use crate::ssrf::{fetch_http_resource, HttpFetchError};
use crate::visual::{
  compare_uploaded_images, ReferenceImageComparison, VisualEvaluationError, MAX_IMAGE_BYTES,
};
use crate::{CapturePageError, CapturePageRequest};

#[path = "zip/mod.rs"]
pub mod zip;

const DEFAULT_SCREENSHOT_SETTLE_MS: u64 = 16;
const DEFAULT_SCREENSHOT_WIDTH: usize = 800;
const DEFAULT_SCREENSHOT_HEIGHT: usize = 600;
const MAX_SCREENSHOT_DIMENSION: usize = 8_192;
const MAX_SCREENSHOT_PIXELS: usize = MAX_IMAGE_BYTES / 4;
// The runner's lossless BMP adds a small fixed header to the RGBA pixel buffer.
const MAX_CAPTURE_BMP_BYTES: usize = MAX_IMAGE_BYTES + 1_024;
const DEFAULT_TIMEOUT_MS: u64 = 60_000;
const LYNXML_UPLOAD_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_LYNXML_UPLOAD_BYTES: usize = 10 * 1024 * 1024;
const MAX_SCREENSHOT_FORM_BYTES: usize = 10 * 1024 * 1024;
const MAX_SCREENSHOT_REQUEST_BYTES: usize = MAX_SCREENSHOT_FORM_BYTES + 64 * 1024;
const MAX_REMOTE_URL_BYTES: usize = 8 * 1024;
const REMOTE_FETCH_TIMEOUT: Duration = Duration::from_secs(10);
const MAX_REQUEST_BYTES: usize = MAX_IMAGE_BYTES * 2 + 64 * 1024;
const TCP_BACKLOG: i32 = 1_024;
const ZIP_CAPTURE_CHILD_ENV: &str = "UI_JUDGE_INTERNAL_ZIP_CAPTURE_CHILD";
const ZIP_CAPTURE_BASE_DIR_ENV: &str = "UI_JUDGE_INTERNAL_ZIP_CAPTURE_BASE_DIR";
const ZIP_CAPTURE_OUTPUT_ENV: &str = "UI_JUDGE_INTERNAL_ZIP_CAPTURE_OUTPUT";
const ZIP_CAPTURE_URL_ENV: &str = "UI_JUDGE_INTERNAL_ZIP_CAPTURE_URL";
const ZIP_CAPTURE_WIDTH_ENV: &str = "UI_JUDGE_INTERNAL_ZIP_CAPTURE_WIDTH";
const ZIP_CAPTURE_HEIGHT_ENV: &str = "UI_JUDGE_INTERNAL_ZIP_CAPTURE_HEIGHT";
const ISOLATED_CAPTURE_CONFIG_ARG: &str = "--ui-judge-isolated-capture-config-file";
const ZIP_CAPTURE_PROCESS_GRACE: Duration = Duration::from_secs(5);
const ZIP_CAPTURE_FATAL_EXIT_CODE: i32 = 75;
const MAX_CONCURRENT_ZIP_RENDERERS: usize = 4;
const ZIP_SCREENSHOT_SETTLE_MS: u64 = 500;
static NEXT_ZIP_JOB_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy)]
enum ZipCaptureBackend {
  IsolatedProcess,
  #[cfg(test)]
  SharedWorker,
}

#[derive(Debug, Deserialize, PartialEq, Eq, Serialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct IsolatedCaptureConfig {
  global_props_json: Option<String>,
  initial_data_json: Option<String>,
  screenshot_settle_ms: u64,
  timeout_ms: u64,
}

impl Default for IsolatedCaptureConfig {
  fn default() -> Self {
    Self {
      global_props_json: None,
      initial_data_json: None,
      screenshot_settle_ms: ZIP_SCREENSHOT_SETTLE_MS,
      timeout_ms: DEFAULT_TIMEOUT_MS,
    }
  }
}

#[derive(Clone)]
struct ZipCaptureProcesses {
  inner: Arc<ZipCaptureProcessInner>,
}

struct ZipCaptureProcessInner {
  idle: Notify,
  render_slots: Arc<Semaphore>,
  state: Mutex<ZipCaptureProcessState>,
}

struct ZipCaptureProcessState {
  accepting: bool,
  active: usize,
}

struct ZipCaptureProcessActivity {
  deadline: tokio::time::Instant,
  inner: Arc<ZipCaptureProcessInner>,
  _render_slot: OwnedSemaphorePermit,
  started: Instant,
}

impl ZipCaptureProcesses {
  fn new() -> Self {
    Self::with_capacity(MAX_CONCURRENT_ZIP_RENDERERS)
  }

  fn with_capacity(capacity: usize) -> Self {
    Self {
      inner: Arc::new(ZipCaptureProcessInner {
        idle: Notify::new(),
        render_slots: Arc::new(Semaphore::new(capacity)),
        state: Mutex::new(ZipCaptureProcessState {
          accepting: true,
          active: 0,
        }),
      }),
    }
  }

  async fn begin(
    &self,
    deadline: tokio::time::Instant,
  ) -> Result<ZipCaptureProcessActivity, ApiError> {
    let started = Instant::now();
    let render_slot = match tokio::time::timeout_at(
      deadline,
      Arc::clone(&self.inner.render_slots).acquire_owned(),
    )
    .await
    {
      Ok(Ok(render_slot)) => render_slot,
      Ok(Err(_)) => {
        return Err(ApiError::new(
          StatusCode::SERVICE_UNAVAILABLE,
          "The isolated ZIP renderer is shutting down.",
        ))
      }
      Err(_) => return Err(zip_render_timeout_error()),
    };
    let mut state = self
      .inner
      .state
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    if !state.accepting {
      return Err(ApiError::new(
        StatusCode::SERVICE_UNAVAILABLE,
        "The isolated ZIP renderer is shutting down.",
      ));
    }
    state.active += 1;
    Ok(ZipCaptureProcessActivity {
      deadline,
      inner: Arc::clone(&self.inner),
      _render_slot: render_slot,
      started,
    })
  }

  async fn capture<T: Send + 'static>(
    &self,
    activity: ZipCaptureProcessActivity,
    staging_guard: T,
    base_dir: PathBuf,
    url: String,
    viewport: ScreenshotViewport,
    job_id: u64,
    config: IsolatedCaptureConfig,
  ) -> Result<Vec<u8>, ApiError> {
    let deadline = activity.deadline;
    let started = activity.started;
    let (mut reply, response) = oneshot::channel();
    tokio::spawn(async move {
      let result =
        supervise_zip_capture_process(&base_dir, &url, viewport, config, &mut reply, deadline)
          .await;
      let outcome = if reply.is_closed() {
        "cancelled"
      } else {
        zip_render_outcome(&result)
      };
      log_zip_render(job_id, outcome, started.elapsed());
      let _ = reply.send(result);
      drop(staging_guard);
      drop(activity);
    });
    response.await.map_err(|_| isolated_zip_worker_error())?
  }

  async fn close_and_wait(&self) {
    loop {
      let notified = self.inner.idle.notified();
      tokio::pin!(notified);
      notified.as_mut().enable();
      let is_idle = {
        let mut state = self
          .inner
          .state
          .lock()
          .unwrap_or_else(|poisoned| poisoned.into_inner());
        state.accepting = false;
        self.inner.render_slots.close();
        state.active == 0
      };
      if is_idle {
        return;
      }
      notified.await;
    }
  }
}

impl Drop for ZipCaptureProcessActivity {
  fn drop(&mut self) {
    let is_idle = {
      let mut state = self
        .inner
        .state
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
      state.active = state.active.saturating_sub(1);
      state.active == 0
    };
    if is_idle {
      self.inner.idle.notify_waiters();
    }
  }
}

#[derive(Debug, Error)]
pub enum ServerError {
  #[error("LYNX_USE_PORT must be an integer from 1 through 65535, got {port:?}: {source}")]
  InvalidPort { port: String, source: ParseIntError },
  #[error("UI Judge headless worker panicked")]
  HeadlessWorkerPanicked,
  #[error("UI Judge headless worker is unavailable: {0}")]
  HeadlessWorkerUnavailable(String),
  #[error("UI Judge server I/O failed: {0}")]
  Io(#[from] io::Error),
  #[error("isolated ZIP capture failed")]
  IsolatedZipCapture,
}

impl From<WorkerPanicked> for ServerError {
  fn from(_: WorkerPanicked) -> Self {
    Self::HeadlessWorkerPanicked
  }
}

#[derive(Clone)]
struct AppState {
  headless: Arc<CaptureWorkers>,
  zip_capture_backend: ZipCaptureBackend,
  zip_capture_processes: ZipCaptureProcesses,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct TemplateScreenshotRequest {
  #[serde(default, alias = "global_props")]
  global_props: Option<Value>,
  #[serde(default, alias = "initial_data")]
  initial_data: Option<Value>,
  #[serde(default, alias = "screenshot_settle_ms")]
  screenshot_settle_ms: Option<u64>,
  #[serde(default, alias = "timeout_ms")]
  timeout_ms: Option<u64>,
  url: String,
}

#[derive(Debug)]
struct HttpCaptureRequest {
  load_options: PageLoadOptions,
  request: CapturePageRequest,
}

#[derive(Debug)]
struct ScreenshotForm {
  entry: ScreenshotEntry,
  viewport: ScreenshotViewport,
  load_options: PageLoadOptions,
  source: Vec<u8>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ScreenshotViewport {
  height: usize,
  width: usize,
}

impl ScreenshotViewport {
  fn new(width: usize, height: usize) -> Result<Self, ApiError> {
    if width == 0 || height == 0 {
      return Err(ApiError::new(
        StatusCode::BAD_REQUEST,
        "width and height must be greater than zero.",
      ));
    }
    let pixels = width
      .checked_mul(height)
      .ok_or_else(invalid_screenshot_dimensions)?;
    if width > MAX_SCREENSHOT_DIMENSION
      || height > MAX_SCREENSHOT_DIMENSION
      || pixels > MAX_SCREENSHOT_PIXELS
    {
      return Err(invalid_screenshot_dimensions());
    }
    Ok(Self { height, width })
  }
}

fn invalid_screenshot_dimensions() -> ApiError {
  ApiError::new(
    StatusCode::BAD_REQUEST,
    format!(
      "width and height must each be at most {MAX_SCREENSHOT_DIMENSION} and describe no more than {MAX_SCREENSHOT_PIXELS} pixels.",
    ),
  )
}

#[derive(Debug)]
struct ScreenshotEntry {
  path: PathBuf,
  url: String,
}

impl ScreenshotEntry {
  fn parse(input: &str) -> Result<Self, ApiError> {
    let input = input.trim();
    let relative = match input.split_once("://") {
      Some((scheme, path)) if scheme.eq_ignore_ascii_case("zip") => path.trim_start_matches('/'),
      Some(_) => return Err(invalid_screenshot_entry()),
      None => input,
    };
    if relative.is_empty()
      || relative.len() > 4096
      || relative.starts_with('/')
      || relative.contains(['\0', '\\', '?', '#'])
      || is_windows_absolute_path(relative)
    {
      return Err(invalid_screenshot_entry());
    }
    let relative = percent_decode_entry(relative).ok_or_else(invalid_screenshot_entry)?;
    if relative.contains(['\0', '\\']) || is_windows_absolute_path(&relative) {
      return Err(invalid_screenshot_entry());
    }
    let mut path = PathBuf::new();
    let mut url = reqwest::Url::parse("zip:///").expect("the internal ZIP URL is valid");
    let mut segment_count = 0;
    {
      let mut url_segments = url
        .path_segments_mut()
        .expect("the internal ZIP URL supports path segments");
      url_segments.pop_if_empty();
      for component in Path::new(&relative).components() {
        let Component::Normal(component) = component else {
          return Err(invalid_screenshot_entry());
        };
        let component = component.to_str().ok_or_else(invalid_screenshot_entry)?;
        if component.is_empty() || component.len() > 255 {
          return Err(invalid_screenshot_entry());
        }
        segment_count += 1;
        if segment_count > 20 {
          return Err(invalid_screenshot_entry());
        }
        path.push(component);
        url_segments.push(component);
      }
    }
    if path.as_os_str().is_empty() {
      return Err(invalid_screenshot_entry());
    }
    Ok(Self {
      path,
      url: url.into(),
    })
  }
}

#[derive(Clone, Copy)]
enum StagedSourceKind {
  Lynxml,
  Template,
}

impl StagedSourceKind {
  fn label(self) -> &'static str {
    match self {
      Self::Lynxml => "LynXML source",
      Self::Template => "remote template",
    }
  }

  fn prefix(self) -> &'static str {
    match self {
      Self::Lynxml => "ui-judge-lynxml-",
      Self::Template => "ui-judge-template-",
    }
  }
}

fn invalid_screenshot_entry() -> ApiError {
  ApiError::new(
    StatusCode::BAD_REQUEST,
    "entry must identify a safe relative file path inside the staged source.",
  )
}

fn is_windows_absolute_path(input: &str) -> bool {
  let bytes = input.as_bytes();
  bytes.len() >= 3
    && bytes[0].is_ascii_alphabetic()
    && bytes[1] == b':'
    && matches!(bytes[2], b'/' | b'\\')
}

fn percent_decode_entry(input: &str) -> Option<String> {
  let input = input.as_bytes();
  let mut output = Vec::with_capacity(input.len());
  let mut index = 0;
  while index < input.len() {
    if input[index] != b'%' {
      output.push(input[index]);
      index += 1;
      continue;
    }
    if index + 2 >= input.len() {
      return None;
    }
    let high = hex_value(input[index + 1])?;
    let low = hex_value(input[index + 2])?;
    output.push((high << 4) | low);
    index += 3;
  }
  String::from_utf8(output).ok()
}

fn hex_value(value: u8) -> Option<u8> {
  match value {
    b'0'..=b'9' => Some(value - b'0'),
    b'a'..=b'f' => Some(value - b'a' + 10),
    b'A'..=b'F' => Some(value - b'A' + 10),
    _ => None,
  }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct HttpCompareImagesResponse {
  #[serde(skip_serializing_if = "Option::is_none")]
  alignment_score: Option<f64>,
  diff_image_base64: String,
  different_blocks: usize,
  total_blocks: usize,
  visual_similarity: f64,
  #[serde(skip_serializing_if = "Vec::is_empty")]
  warnings: Vec<String>,
}

impl From<ReferenceImageComparison> for HttpCompareImagesResponse {
  fn from(comparison: ReferenceImageComparison) -> Self {
    Self {
      alignment_score: comparison.alignment_score,
      diff_image_base64: comparison.diff_image_base64,
      different_blocks: comparison.different_blocks,
      total_blocks: comparison.total_blocks,
      visual_similarity: comparison.similarity,
      warnings: comparison.warnings,
    }
  }
}

impl TemplateScreenshotRequest {
  fn into_capture_request(self) -> Result<HttpCaptureRequest, ApiError> {
    let timeout_ms = self.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
    if timeout_ms == 0 {
      return Err(ApiError::new(
        StatusCode::BAD_REQUEST,
        "timeoutMs must be greater than zero.",
      ));
    }
    let global_props_json = page_data_json("globalProps", self.global_props)?;
    let initial_data_json = page_data_json("initialData", self.initial_data)?;
    Ok(HttpCaptureRequest {
      load_options: PageLoadOptions {
        base_dir: None,
        global_props_json,
        initial_data_json,
      },
      request: CapturePageRequest {
        screenshot_settle: Duration::from_millis(
          self
            .screenshot_settle_ms
            .unwrap_or(DEFAULT_SCREENSHOT_SETTLE_MS),
        ),
        timeout: Duration::from_millis(timeout_ms),
        url: self.url,
        ..CapturePageRequest::default()
      },
    })
  }
}

fn page_data_json(name: &str, value: Option<Value>) -> Result<Option<String>, ApiError> {
  match value {
    Some(value @ Value::Object(_)) => Ok(Some(value.to_string())),
    Some(_) => Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      format!("{name} must be a JSON object."),
    )),
    None => Ok(None),
  }
}

#[derive(Debug)]
struct ApiError {
  message: String,
  status: StatusCode,
}

impl ApiError {
  fn new(status: StatusCode, message: impl Into<String>) -> Self {
    Self {
      message: message.into(),
      status,
    }
  }
}

impl From<CaptureError> for ApiError {
  fn from(error: CaptureError) -> Self {
    let status = if matches!(error, CaptureError::TimedOut) {
      StatusCode::REQUEST_TIMEOUT
    } else {
      StatusCode::SERVICE_UNAVAILABLE
    };
    Self::new(status, error.to_string())
  }
}

impl From<VisualEvaluationError> for ApiError {
  fn from(error: VisualEvaluationError) -> Self {
    let status = StatusCode::from_u16(error.status).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    Self::new(status, error.to_string())
  }
}

#[derive(Serialize)]
struct ApiErrorBody {
  error: CapturePageError,
}

impl IntoResponse for ApiError {
  fn into_response(self) -> Response {
    (
      self.status,
      Json(ApiErrorBody {
        error: CapturePageError {
          message: self.message,
        },
      }),
    )
      .into_response()
  }
}

/// Runs one internal staged-source capture child when the private mode marker is set.
///
/// The server executable calls this before creating Tokio or any shared native
/// state. User-controlled ZIP and LynXML pages therefore never share Clay's
/// process-wide caches with another upload.
#[doc(hidden)]
pub fn run_zip_capture_child() -> Result<bool, ServerError> {
  if std::env::var_os(ZIP_CAPTURE_CHILD_ENV).as_deref() != Some(std::ffi::OsStr::new("1")) {
    return Ok(false);
  }
  arm_zip_capture_parent_lifeline()?;
  let base_dir = std::env::var_os(ZIP_CAPTURE_BASE_DIR_ENV)
    .map(PathBuf::from)
    .ok_or(ServerError::IsolatedZipCapture)?;
  let url = std::env::var(ZIP_CAPTURE_URL_ENV).map_err(|_| ServerError::IsolatedZipCapture)?;
  if !is_zip_url(&url) {
    return Err(ServerError::IsolatedZipCapture);
  }
  let width = std::env::var(ZIP_CAPTURE_WIDTH_ENV)
    .ok()
    .and_then(|value| value.parse().ok())
    .ok_or(ServerError::IsolatedZipCapture)?;
  let height = std::env::var(ZIP_CAPTURE_HEIGHT_ENV)
    .ok()
    .and_then(|value| value.parse().ok())
    .ok_or(ServerError::IsolatedZipCapture)?;
  let viewport =
    ScreenshotViewport::new(width, height).map_err(|_| ServerError::IsolatedZipCapture)?;
  let output = std::env::var_os(ZIP_CAPTURE_OUTPUT_ENV)
    .map(PathBuf::from)
    .ok_or(ServerError::IsolatedZipCapture)?;
  let base_dir = std::fs::canonicalize(base_dir).map_err(|_| ServerError::IsolatedZipCapture)?;
  let output_parent = output
    .parent()
    .and_then(|parent| std::fs::canonicalize(parent).ok())
    .ok_or(ServerError::IsolatedZipCapture)?;
  if !base_dir.is_dir() || !output_parent.is_dir() {
    return Err(ServerError::IsolatedZipCapture);
  }
  let config = isolated_capture_config_from_args()?;
  if config.timeout_ms == 0 {
    return Err(ServerError::IsolatedZipCapture);
  }

  let container = LynxContainer::new(ContainerOptions {
    width: viewport.width,
    height: viewport.height,
    timeout: Duration::from_millis(config.timeout_ms),
    ..ContainerOptions::default()
  })
  .map_err(|_| ServerError::IsolatedZipCapture)?;
  let mut page = container
    .new_page()
    .map_err(|_| ServerError::IsolatedZipCapture)?;
  page
    .goto(
      &url,
      GotoOptions {
        base_dir: Some(base_dir),
        global_props_json: config.global_props_json,
        initial_data_json: config.initial_data_json,
        timeout: Some(Duration::from_millis(config.timeout_ms)),
      },
    )
    .map_err(|_| ServerError::IsolatedZipCapture)?;
  let bmp = page
    .screenshot(ScreenshotOptions {
      path: None,
      settle: Duration::from_millis(config.screenshot_settle_ms),
    })
    .map_err(|_| ServerError::IsolatedZipCapture)?;
  let mut output = std::fs::OpenOptions::new()
    .write(true)
    .create_new(true)
    .open(&output)
    .map_err(|_| ServerError::IsolatedZipCapture)?;
  output
    .write_all(&bmp)
    .map_err(|_| ServerError::IsolatedZipCapture)?;
  output
    .flush()
    .map_err(|_| ServerError::IsolatedZipCapture)?;
  Ok(true)
}

fn isolated_capture_config_from_args() -> Result<IsolatedCaptureConfig, ServerError> {
  parse_isolated_capture_config_args(std::env::args_os().skip(1))
}

fn parse_isolated_capture_config_args(
  args: impl IntoIterator<Item = std::ffi::OsString>,
) -> Result<IsolatedCaptureConfig, ServerError> {
  let mut args = args.into_iter();
  let flag = args.next().ok_or(ServerError::IsolatedZipCapture)?;
  if flag != std::ffi::OsStr::new(ISOLATED_CAPTURE_CONFIG_ARG) {
    return Err(ServerError::IsolatedZipCapture);
  }
  let config_path = args.next().ok_or(ServerError::IsolatedZipCapture)?;
  if args.next().is_some() {
    return Err(ServerError::IsolatedZipCapture);
  }
  let config = std::fs::File::open(config_path).map_err(|_| ServerError::IsolatedZipCapture)?;
  serde_json::from_reader(BufReader::new(config)).map_err(|_| ServerError::IsolatedZipCapture)
}

fn arm_zip_capture_parent_lifeline() -> Result<(), ServerError> {
  std::thread::Builder::new()
    .name("ui-judge-zip-parent-lifeline".into())
    .spawn(|| {
      let mut byte = [0_u8; 1];
      let _ = std::io::stdin().read(&mut byte);
      std::process::exit(75);
    })
    .map(|_| ())
    .map_err(|_| ServerError::IsolatedZipCapture)
}

/// Runs the feature-gated UI Judge HTTP server on IPv4 and IPv6 unspecified
/// addresses.
pub async fn serve(port: &str) -> Result<(), ServerError> {
  serve_on(None, port).await
}

/// Runs the feature-gated UI Judge HTTP server on the requested host, or on
/// both IPv4 and IPv6 unspecified addresses when no host is provided. Ordinary
/// native capture runs on one container-owning worker behind a bounded queue;
/// untrusted uploads use one fresh child process each. Completed captures are
/// returned as uncompressed BMP bytes.
pub async fn serve_on(host: Option<&str>, port: &str) -> Result<(), ServerError> {
  let port = parse_port(port)?;
  let (ipv4_listener, ipv6_listener) = bind_listeners(host, port)?;
  let addresses = [ipv4_listener.as_ref(), ipv6_listener.as_ref()]
    .into_iter()
    .flatten()
    .map(|listener| listener.local_addr().map(|address| address.to_string()))
    .collect::<io::Result<Vec<_>>>()?
    .join(" and ");
  let headless = shared_workers().map_err(ServerError::HeadlessWorkerUnavailable)?;
  let worker_failure = headless
    .take_failure_receiver()
    .map_err(|error| ServerError::HeadlessWorkerUnavailable(error.to_string()))?;
  let zip_capture_processes = ZipCaptureProcesses::new();
  let state = AppState {
    headless: Arc::clone(&headless),

    zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
    zip_capture_processes: zip_capture_processes.clone(),
  };
  let app = Router::new()
    .route("/health", get(health))
    .route("/compare", post(compare))
    .route("/screenshot/template", post(screenshot_template))
    .route("/screenshot/lynxml", post(screenshot_lynxml))
    .route("/screenshot/template/url", post(screenshot_template_url))
    .route("/screenshot/zip/upload", post(screenshot_zip_upload))
    .route("/screenshot/zip/url", post(screenshot_zip_url))
    .layer(DefaultBodyLimit::max(MAX_REQUEST_BYTES))
    .with_state(state);
  let (shutdown_sender, shutdown_receiver) = watch::channel(false);
  let worker_failure_task = tokio::spawn(trigger_shutdown_on_worker_failure(
    worker_failure,
    shutdown_sender.clone(),
  ));
  let signal_task = tokio::spawn(async move {
    if let Err(error) = shutdown_signal().await {
      eprintln!("[ui-judge-server] failed to listen for shutdown: {error}");
    }
    let _ = shutdown_sender.send(true);
  });

  println!("UI Judge server listening on {addresses}");
  let result = serve_listeners(ipv4_listener, ipv6_listener, app, shutdown_receiver).await;

  signal_task.abort();
  let _ = signal_task.await;
  zip_capture_processes.close_and_wait().await;
  let worker_result = headless.shutdown();
  let _ = worker_failure_task.await;
  worker_result?;
  result.map(|_| ()).map_err(ServerError::from)
}

fn parse_port(port: &str) -> Result<u16, ServerError> {
  port
    .parse::<NonZeroU16>()
    .map(NonZeroU16::get)
    .map_err(|source| ServerError::InvalidPort {
      port: port.to_string(),
      source,
    })
}

fn bind_listeners(
  host: Option<&str>,
  port: u16,
) -> io::Result<(Option<TcpListener>, Option<TcpListener>)> {
  if let Some(host) = host {
    let address = (host, port).to_socket_addrs()?.next().ok_or_else(|| {
      io::Error::new(
        io::ErrorKind::AddrNotAvailable,
        "host resolved to no address",
      )
    })?;
    let listener = bind_listener(address)?;
    return if address.is_ipv4() {
      Ok((Some(listener), None))
    } else {
      Ok((None, Some(listener)))
    };
  }

  let ipv4 = bind_listener(SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)))?;
  let ipv6 = bind_listener(SocketAddr::from((Ipv6Addr::UNSPECIFIED, port)))?;
  Ok((Some(ipv4), Some(ipv6)))
}

fn bind_listener(address: SocketAddr) -> io::Result<TcpListener> {
  let domain = if address.is_ipv4() {
    Domain::IPV4
  } else {
    Domain::IPV6
  };
  let socket = Socket::new(domain, Type::STREAM, Some(Protocol::TCP))?;
  if address.is_ipv6() {
    socket.set_only_v6(true)?;
  }
  configure_listener(socket, address)
}

async fn serve_listeners(
  ipv4_listener: Option<TcpListener>,
  ipv6_listener: Option<TcpListener>,
  app: Router,
  shutdown_receiver: watch::Receiver<bool>,
) -> io::Result<()> {
  match (ipv4_listener, ipv6_listener) {
    (Some(ipv4_listener), Some(ipv6_listener)) => {
      let ipv4_server = axum::serve(ipv4_listener, app.clone())
        .with_graceful_shutdown(wait_for_shutdown(shutdown_receiver.clone()));
      let ipv6_server = axum::serve(ipv6_listener, app)
        .with_graceful_shutdown(wait_for_shutdown(shutdown_receiver));
      tokio::try_join!(ipv4_server, ipv6_server).map(|_| ())
    }
    (Some(listener), None) | (None, Some(listener)) => {
      axum::serve(listener, app)
        .with_graceful_shutdown(wait_for_shutdown(shutdown_receiver))
        .await
    }
    (None, None) => unreachable!("at least one listener is always bound"),
  }
}

fn configure_listener(socket: Socket, address: SocketAddr) -> io::Result<TcpListener> {
  socket.set_reuse_address(true)?;
  socket.set_nonblocking(true)?;
  socket.bind(&SockAddr::from(address))?;
  socket.listen(TCP_BACKLOG)?;
  TcpListener::from_std(socket.into())
}

async fn health(State(state): State<AppState>) -> Result<Json<Value>, ApiError> {
  if state.headless.is_healthy() {
    Ok(Json(json!({
      "status": "ok"
    })))
  } else {
    Err(ApiError::new(
      StatusCode::SERVICE_UNAVAILABLE,
      "The UI Judge headless worker is unavailable.",
    ))
  }
}

async fn screenshot_template(
  State(state): State<AppState>,
  Json(input): Json<TemplateScreenshotRequest>,
) -> Result<Response, ApiError> {
  let HttpCaptureRequest {
    load_options,
    request,
  } = input.into_capture_request()?;
  let source_url = request.url.trim();
  if source_url.len() > MAX_REMOTE_URL_BYTES {
    return Err(remote_url_too_large());
  }
  let source = fetch_remote_template(source_url).await?;
  let capture = capture_staged_source(
    &state,
    ScreenshotEntry::parse("template.js").expect("the internal entry is safe"),
    source,
    StagedSourceKind::Template,
    ScreenshotViewport {
      width: DEFAULT_SCREENSHOT_WIDTH,
      height: DEFAULT_SCREENSHOT_HEIGHT,
    },
    &load_options,
    &request,
  )
  .await?;
  Ok(
    (
      [(CONTENT_TYPE, "image/bmp"), (CACHE_CONTROL, "no-store")],
      capture.into_bmp(),
    )
      .into_response(),
  )
}

async fn screenshot_lynxml(
  State(state): State<AppState>,
  request: Request,
) -> Result<Response, ApiError> {
  let ScreenshotForm {
    entry,
    viewport,
    load_options,
    source,
  } = read_screenshot_form(request, "source").await?;
  if !entry.path.to_string_lossy().ends_with(".lynxml") {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "entry must identify a .lynxml file.",
    ));
  }
  if source.is_empty() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "LynXML source must not be empty.",
    ));
  }
  if std::str::from_utf8(&source).is_err() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "LynXML source must be valid UTF-8.",
    ));
  }
  render_staged_source(
    &state,
    entry,
    source,
    StagedSourceKind::Lynxml,
    viewport,
    load_options,
  )
  .await
}

async fn read_screenshot_form(
  mut request: Request,
  source_name: &str,
) -> Result<ScreenshotForm, ApiError> {
  if request.uri().query().is_some_and(|query| !query.is_empty()) {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "Screenshot parameters must be multipart fields; query parameters are not supported.",
    ));
  }
  if let Some(length) = request.headers().get(CONTENT_LENGTH) {
    let length = length
      .to_str()
      .ok()
      .and_then(|value| value.parse::<u64>().ok())
      .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid Content-Length header."))?;
    if length > MAX_SCREENSHOT_REQUEST_BYTES as u64 {
      return Err(screenshot_form_too_large());
    }
  }
  request
    .extensions_mut()
    .insert(DefaultBodyLimit::max(MAX_SCREENSHOT_REQUEST_BYTES));
  let multipart = Multipart::from_request(request, &())
    .await
    .map_err(|error| ApiError::new(StatusCode::UNSUPPORTED_MEDIA_TYPE, error.to_string()))?;
  read_screenshot_form_with_deadline(
    parse_screenshot_form(multipart, source_name),
    LYNXML_UPLOAD_TIMEOUT,
  )
  .await
}

async fn read_screenshot_form_with_deadline(
  read: impl std::future::Future<Output = Result<ScreenshotForm, ApiError>>,
  timeout: Duration,
) -> Result<ScreenshotForm, ApiError> {
  tokio::time::timeout(timeout, read).await.map_err(|_| {
    ApiError::new(
      StatusCode::REQUEST_TIMEOUT,
      "The screenshot request body timed out.",
    )
  })?
}

async fn parse_screenshot_form(
  mut multipart: Multipart,
  source_name: &str,
) -> Result<ScreenshotForm, ApiError> {
  let mut entry = None;
  let mut width = None;
  let mut height = None;
  let mut global_props = None;
  let mut init_data = None;
  let mut source = None;
  let mut total_bytes = 0_usize;
  while let Some(mut field) = multipart.next_field().await.map_err(multipart_error)? {
    let name = field.name().unwrap_or_default().to_string();
    let slot = match name.as_str() {
      "entry" => &mut entry,
      "width" => &mut width,
      "height" => &mut height,
      "globalProps" => &mut global_props,
      "initData" => &mut init_data,
      name if name == source_name => &mut source,
      _ => {
        return Err(ApiError::new(
          StatusCode::BAD_REQUEST,
          format!("Unexpected multipart field {name:?}."),
        ))
      }
    };
    if slot.is_some() {
      return Err(ApiError::new(
        StatusCode::BAD_REQUEST,
        format!("{name} must be provided exactly once."),
      ));
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = field.chunk().await.map_err(multipart_error)? {
      total_bytes = total_bytes.saturating_add(chunk.len());
      if total_bytes > MAX_SCREENSHOT_FORM_BYTES {
        return Err(screenshot_form_too_large());
      }
      if name == "url" && bytes.len().saturating_add(chunk.len()) > MAX_REMOTE_URL_BYTES {
        return Err(remote_url_too_large());
      }
      bytes.extend_from_slice(&chunk);
    }
    *slot = Some(bytes);
  }
  let entry = ScreenshotEntry::parse(form_text("entry", &required_form_field("entry", entry)?)?)?;
  let viewport = ScreenshotViewport::new(
    form_dimension("width", width, DEFAULT_SCREENSHOT_WIDTH)?,
    form_dimension("height", height, DEFAULT_SCREENSHOT_HEIGHT)?,
  )?;
  let load_options = PageLoadOptions {
    base_dir: None,
    global_props_json: form_page_data("globalProps", global_props)?,
    initial_data_json: form_page_data("initData", init_data)?,
  };
  if entry.path.to_string_lossy().ends_with(".lynxml") && load_options.global_props_json.is_some() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "globalProps is not supported for LynXML; use initData or a compiled template.",
    ));
  }
  let source = required_form_field(source_name, source)?;
  Ok(ScreenshotForm {
    entry,
    viewport,
    load_options,
    source,
  })
}

fn required_form_field(name: &str, value: Option<Vec<u8>>) -> Result<Vec<u8>, ApiError> {
  value.ok_or_else(|| {
    ApiError::new(
      StatusCode::BAD_REQUEST,
      format!("Missing {name} multipart field."),
    )
  })
}

fn form_text<'a>(name: &str, bytes: &'a [u8]) -> Result<&'a str, ApiError> {
  std::str::from_utf8(bytes).map_err(|_| {
    ApiError::new(
      StatusCode::BAD_REQUEST,
      format!("{name} must be valid UTF-8."),
    )
  })
}

fn form_dimension(name: &str, bytes: Option<Vec<u8>>, default: usize) -> Result<usize, ApiError> {
  match bytes {
    Some(bytes) => form_text(name, &bytes)?.parse().map_err(|_| {
      ApiError::new(
        StatusCode::BAD_REQUEST,
        format!("{name} must be a positive integer."),
      )
    }),
    None => Ok(default),
  }
}

fn form_page_data(name: &str, bytes: Option<Vec<u8>>) -> Result<Option<String>, ApiError> {
  match bytes {
    Some(bytes) => {
      let value = serde_json::from_slice(&bytes).map_err(|_| {
        ApiError::new(
          StatusCode::BAD_REQUEST,
          format!("{name} must be a JSON object."),
        )
      })?;
      page_data_json(name, Some(value))
    }
    None => Ok(None),
  }
}

fn screenshot_form_too_large() -> ApiError {
  ApiError::new(StatusCode::PAYLOAD_TOO_LARGE, format!("Screenshot multipart fields exceed the {MAX_SCREENSHOT_FORM_BYTES}-byte limit (64 KiB additional framing allowed)."))
}

async fn screenshot_template_url(
  State(state): State<AppState>,
  request: Request,
) -> Result<Response, ApiError> {
  let ScreenshotForm {
    entry,
    viewport,
    load_options,
    source,
  } = read_screenshot_form(request, "url").await?;
  if !entry.path.to_string_lossy().ends_with(".js") {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "entry must identify a template.js file.",
    ));
  }
  let url = remote_url(&source)?;
  let source = fetch_remote_template(&url).await?;
  render_staged_source(
    &state,
    entry,
    source,
    StagedSourceKind::Template,
    viewport,
    load_options,
  )
  .await
}

async fn fetch_remote_template(url: &str) -> Result<Vec<u8>, ApiError> {
  let resource = fetch_http_resource(url, MAX_LYNXML_UPLOAD_BYTES, REMOTE_FETCH_TIMEOUT)
    .await
    .map_err(remote_fetch_api_error)?;
  if resource.bytes.is_empty() {
    return Err(ApiError::new(
      StatusCode::UNPROCESSABLE_ENTITY,
      "The remote template is empty.",
    ));
  }
  Ok(resource.bytes)
}

async fn screenshot_zip_upload(
  State(state): State<AppState>,
  request: Request,
) -> Result<Response, ApiError> {
  let ScreenshotForm {
    entry,
    viewport,
    load_options,
    source,
  } = read_screenshot_form(request, "file").await?;
  render_zip(&state, entry, source, viewport, load_options).await
}

async fn screenshot_zip_url(
  State(state): State<AppState>,
  request: Request,
) -> Result<Response, ApiError> {
  let ScreenshotForm {
    entry,
    viewport,
    load_options,
    source,
  } = read_screenshot_form(request, "url").await?;
  let url = remote_url(&source)?;
  let resource = fetch_http_resource(&url, zip::MAX_ZIP_UPLOAD_BYTES, REMOTE_FETCH_TIMEOUT)
    .await
    .map_err(remote_fetch_api_error)?;
  render_zip(&state, entry, resource.bytes, viewport, load_options).await
}

async fn render_zip(
  state: &AppState,
  entry: ScreenshotEntry,
  upload: Vec<u8>,
  viewport: ScreenshotViewport,
  load_options: PageLoadOptions,
) -> Result<Response, ApiError> {
  let job_id = NEXT_ZIP_JOB_ID.fetch_add(1, Ordering::Relaxed);
  if upload.is_empty() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "ZIP upload must not be empty.",
    ));
  }

  // Wait in this request future instead of rejecting a busy renderer. An
  // outer middleware is responsible for any eager admission control.
  let zip_process_activity = match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let render_wait_started = Instant::now();
      let deadline = tokio::time::Instant::now()
        + Duration::from_millis(DEFAULT_TIMEOUT_MS)
        + ZIP_CAPTURE_PROCESS_GRACE;
      match state.zip_capture_processes.begin(deadline).await {
        Ok(activity) => Some(activity),
        Err(error) => {
          let outcome = if error.status == StatusCode::REQUEST_TIMEOUT {
            "timed-out"
          } else {
            "rejected"
          };
          log_zip_render(job_id, outcome, render_wait_started.elapsed());
          return Err(error);
        }
      }
    }
    #[cfg(test)]
    ZipCaptureBackend::SharedWorker => None,
  };

  let extraction = zip::extract_uploaded_zip(upload);
  let extracted = match zip_process_activity.as_ref() {
    Some(activity) => match tokio::time::timeout_at(activity.deadline, extraction).await {
      Ok(result) => result.map_err(|error| zip_api_error(error, job_id))?,
      Err(_) => {
        log_zip_render(job_id, "timed-out", activity.started.elapsed());
        return Err(zip_render_timeout_error());
      }
    },
    None => extraction
      .await
      .map_err(|error| zip_api_error(error, job_id))?,
  };
  let extraction_stats = extracted.stats().clone();
  let base_dir = match canonical_zip_base_dir(extracted.path()) {
    Ok(base_dir) => base_dir,
    Err(error) => {
      log_zip_extraction(job_id, "staging-unavailable", &extraction_stats, false);
      return Err(error);
    }
  };
  log_zip_extraction(job_id, "accepted", &extraction_stats, false);

  let bmp = match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let activity = zip_process_activity
        .expect("isolated ZIP capture must acquire render capacity before extraction");
      match state
        .zip_capture_processes
        .capture(
          activity,
          extracted,
          base_dir,
          entry.url,
          viewport,
          job_id,
          IsolatedCaptureConfig {
            global_props_json: load_options.global_props_json,
            initial_data_json: load_options.initial_data_json,
            ..IsolatedCaptureConfig::default()
          },
        )
        .await
      {
        Ok(bmp) => bmp,
        Err(error) => {
          log_zip_extraction(job_id, "render-failed", &extraction_stats, false);
          return Err(error);
        }
      }
    }
    #[cfg(test)]
    ZipCaptureBackend::SharedWorker => {
      let capture_response = state
        .headless
        .capture_staged_zip(
          staged_screenshot_request(&entry.url),
          PageLoadOptions {
            base_dir: Some(base_dir),
            ..load_options
          },
          extracted,
        )
        .await
        .map_err(|error| {
          log_zip_extraction(job_id, "capture-rejected", &extraction_stats, false);
          ApiError::from(error)
        })?;
      let capture = match capture_response.capture {
        Ok(capture) => capture,
        Err(_) => {
          log_zip_extraction(job_id, "render-failed", &extraction_stats, false);
          return Err(ApiError::new(
            StatusCode::UNPROCESSABLE_ENTITY,
            "The uploaded ZIP could not be rendered.",
          ));
        }
      };
      capture.into_bmp()
    }
  };
  Ok(
    (
      [(CONTENT_TYPE, "image/bmp"), (CACHE_CONTROL, "no-store")],
      bmp,
    )
      .into_response(),
  )
}

async fn render_staged_source(
  state: &AppState,
  entry: ScreenshotEntry,
  source: Vec<u8>,
  kind: StagedSourceKind,
  viewport: ScreenshotViewport,
  load_options: PageLoadOptions,
) -> Result<Response, ApiError> {
  let request = staged_screenshot_request(&entry.url);
  let capture = capture_staged_source(
    state,
    entry,
    source,
    kind,
    viewport,
    &load_options,
    &request,
  )
  .await?;
  let bmp = capture.into_bmp();
  Ok(
    (
      [(CONTENT_TYPE, "image/bmp"), (CACHE_CONTROL, "no-store")],
      bmp,
    )
      .into_response(),
  )
}

async fn capture_staged_source(
  state: &AppState,
  entry: ScreenshotEntry,
  source: Vec<u8>,
  kind: StagedSourceKind,
  viewport: ScreenshotViewport,
  load_options: &PageLoadOptions,
  request: &CapturePageRequest,
) -> Result<crate::headless::CapturedPage, ApiError> {
  let job_id = NEXT_ZIP_JOB_ID.fetch_add(1, Ordering::Relaxed);
  let zip_process_activity = match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let deadline = tokio::time::Instant::now() + request.timeout + ZIP_CAPTURE_PROCESS_GRACE;
      Some(
        state
          .zip_capture_processes
          .begin(deadline)
          .await
          .map_err(|error| staged_source_render_api_error(kind, error))?,
      )
    }
    #[cfg(test)]
    ZipCaptureBackend::SharedWorker => None,
  };
  let staging_deadline = zip_process_activity
    .as_ref()
    .map(|activity| activity.deadline);
  let staging = stage_source(source, entry.path, kind, zip_process_activity);
  let (staged, zip_process_activity) = match staging_deadline {
    Some(deadline) => match tokio::time::timeout_at(deadline, staging).await {
      Ok(result) => result?,
      Err(_) => return Err(staged_source_timeout_error(kind)),
    },
    None => match tokio::time::timeout(LYNXML_UPLOAD_TIMEOUT, staging).await {
      Ok(result) => result?,
      Err(_) => return Err(staged_source_timeout_error(kind)),
    },
  };
  let base_dir = std::fs::canonicalize(staged.path()).map_err(|_| {
    ApiError::new(
      StatusCode::INTERNAL_SERVER_ERROR,
      format!("The staged {} directory is unavailable.", kind.label()),
    )
  })?;

  match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let activity = zip_process_activity
        .expect("isolated source capture must acquire render capacity before staging");
      let config = IsolatedCaptureConfig {
        global_props_json: load_options.global_props_json.clone(),
        initial_data_json: load_options.initial_data_json.clone(),
        screenshot_settle_ms: u64::try_from(request.screenshot_settle.as_millis())
          .expect("HTTP screenshot settle originates from u64 milliseconds"),
        timeout_ms: u64::try_from(request.timeout.as_millis())
          .expect("HTTP timeout originates from u64 milliseconds"),
      };
      let bmp = state
        .zip_capture_processes
        .capture(
          activity, staged, base_dir, entry.url, viewport, job_id, config,
        )
        .await
        .map_err(|error| staged_source_render_api_error(kind, error))?;
      Ok(crate::headless::CapturedPage::from_bmp(bmp))
    }
    #[cfg(test)]
    ZipCaptureBackend::SharedWorker => {
      let mut capture_request = request.clone();
      capture_request.url = entry.url;
      let capture_response = state
        .headless
        .capture(
          capture_request,
          PageLoadOptions {
            base_dir: Some(base_dir),
            global_props_json: load_options.global_props_json.clone(),
            initial_data_json: load_options.initial_data_json.clone(),
          },
        )
        .await?;
      let capture = capture_response.capture.map_err(|_| {
        ApiError::new(
          StatusCode::UNPROCESSABLE_ENTITY,
          format!("The {} could not be rendered.", kind.label()),
        )
      })?;
      drop(staged);
      Ok(capture)
    }
  }
}

fn staged_screenshot_request(url: &str) -> CapturePageRequest {
  CapturePageRequest {
    screenshot_settle: Duration::from_millis(ZIP_SCREENSHOT_SETTLE_MS),

    timeout: Duration::from_millis(DEFAULT_TIMEOUT_MS),
    url: url.to_string(),
    ..CapturePageRequest::default()
  }
}

async fn stage_source(
  source: Vec<u8>,
  entry: PathBuf,
  kind: StagedSourceKind,
  activity: Option<ZipCaptureProcessActivity>,
) -> Result<(tempfile::TempDir, Option<ZipCaptureProcessActivity>), ApiError> {
  tokio::task::spawn_blocking(move || -> io::Result<_> {
    let directory = tempfile::Builder::new().prefix(kind.prefix()).tempdir()?;
    let path = directory.path().join(entry);
    if let Some(parent) = path.parent() {
      std::fs::create_dir_all(parent)?;
    }
    let mut file = std::fs::OpenOptions::new()
      .write(true)
      .create_new(true)
      .open(path)?;
    file.write_all(&source)?;
    file.flush()?;
    Ok((directory, activity))
  })
  .await
  .map_err(|_| {
    ApiError::new(
      StatusCode::INTERNAL_SERVER_ERROR,
      format!("The {} staging worker failed.", kind.label()),
    )
  })?
  .map_err(|_| {
    ApiError::new(
      StatusCode::INTERNAL_SERVER_ERROR,
      format!("The {} could not be staged.", kind.label()),
    )
  })
}

fn remote_url(body: &[u8]) -> Result<String, ApiError> {
  let url = std::str::from_utf8(body)
    .map_err(|_| {
      ApiError::new(
        StatusCode::BAD_REQUEST,
        "The remote URL must be valid UTF-8.",
      )
    })?
    .trim();
  if url.is_empty() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "The remote URL must not be empty.",
    ));
  }
  Ok(url.to_string())
}

fn remote_url_too_large() -> ApiError {
  ApiError::new(
    StatusCode::PAYLOAD_TOO_LARGE,
    format!("Remote URL exceeds the {MAX_REMOTE_URL_BYTES}-byte limit."),
  )
}

fn remote_fetch_api_error(error: HttpFetchError) -> ApiError {
  let status = match error {
    HttpFetchError::InvalidUrl | HttpFetchError::Credentials => StatusCode::BAD_REQUEST,
    HttpFetchError::NonPublicAddress => StatusCode::FORBIDDEN,
    HttpFetchError::TimedOut => StatusCode::GATEWAY_TIMEOUT,
    HttpFetchError::TooLarge(_) => StatusCode::PAYLOAD_TOO_LARGE,
    HttpFetchError::Resolution | HttpFetchError::Request | HttpFetchError::Status(_) => {
      StatusCode::BAD_GATEWAY
    }
  };
  ApiError::new(status, error.to_string())
}

fn staged_source_timeout_error(kind: StagedSourceKind) -> ApiError {
  ApiError::new(
    StatusCode::REQUEST_TIMEOUT,
    format!("The {} render timed out.", kind.label()),
  )
}

fn staged_source_render_api_error(kind: StagedSourceKind, error: ApiError) -> ApiError {
  match error.status {
    StatusCode::REQUEST_TIMEOUT => staged_source_timeout_error(kind),
    StatusCode::UNPROCESSABLE_ENTITY => ApiError::new(
      StatusCode::UNPROCESSABLE_ENTITY,
      format!("The {} could not be rendered.", kind.label()),
    ),
    StatusCode::INTERNAL_SERVER_ERROR => ApiError::new(
      StatusCode::INTERNAL_SERVER_ERROR,
      format!("The isolated {} renderer is unavailable.", kind.label()),
    ),
    StatusCode::SERVICE_UNAVAILABLE => ApiError::new(
      StatusCode::SERVICE_UNAVAILABLE,
      format!("The isolated {} renderer is shutting down.", kind.label()),
    ),
    _ => error,
  }
}

fn canonical_zip_base_dir(path: &std::path::Path) -> Result<PathBuf, ApiError> {
  std::fs::canonicalize(path).map_err(|_| {
    ApiError::new(
      StatusCode::INTERNAL_SERVER_ERROR,
      "The staged ZIP directory is unavailable.",
    )
  })
}

async fn supervise_zip_capture_process(
  base_dir: &Path,
  url: &str,
  viewport: ScreenshotViewport,
  config: IsolatedCaptureConfig,
  reply: &mut oneshot::Sender<Result<Vec<u8>, ApiError>>,
  deadline: tokio::time::Instant,
) -> Result<Vec<u8>, ApiError> {
  if reply.is_closed() {
    return Err(isolated_zip_worker_error());
  }
  let output_dir = tempfile::tempdir().map_err(|_| isolated_zip_worker_error())?;
  let output = output_dir.path().join("capture.bmp");
  // Keep page data out of argv: multipart JSON can exceed the OS argument limit.
  let config_path = output_dir.path().join("config.json");
  let mut config_file =
    BufWriter::new(std::fs::File::create(&config_path).map_err(|_| isolated_zip_worker_error())?);
  serde_json::to_writer(&mut config_file, &config).map_err(|_| isolated_zip_worker_error())?;
  config_file
    .flush()
    .map_err(|_| isolated_zip_worker_error())?;
  let executable = zip_capture_executable().map_err(|_| isolated_zip_worker_error())?;
  let mut command = Command::new(executable);
  command
    .arg(ISOLATED_CAPTURE_CONFIG_ARG)
    .arg(config_path)
    .env_clear()
    .env(ZIP_CAPTURE_CHILD_ENV, "1")
    .env(ZIP_CAPTURE_BASE_DIR_ENV, base_dir)
    .env(ZIP_CAPTURE_HEIGHT_ENV, viewport.height.to_string())
    .env(ZIP_CAPTURE_OUTPUT_ENV, &output)
    .env(ZIP_CAPTURE_URL_ENV, url)
    .env(ZIP_CAPTURE_WIDTH_ENV, viewport.width.to_string())
    .stdin(Stdio::piped())
    .stdout(Stdio::null())
    .stderr(Stdio::null())
    .kill_on_drop(true);
  for name in [
    "LLVM_PROFILE_FILE",
    "LYNX_CORE_JS_PATH",
    "LYNX_LIB_PATH",
    "LYNX_SDK_DIR",
    "TEMP",
    "TMP",
    "TMPDIR",
  ] {
    if let Some(value) = std::env::var_os(name) {
      command.env(name, value);
    }
  }
  let mut child = command.spawn().map_err(|_| isolated_zip_worker_error())?;
  let Some(parent_lifeline) = child.stdin.take() else {
    terminate_zip_capture_child_or_exit(&mut child).await;
    return Err(isolated_zip_worker_error());
  };
  let status = tokio::select! {
    biased;
    _ = tokio::time::sleep_until(deadline) => {
      terminate_zip_capture_child_or_exit(&mut child).await;
      return Err(zip_render_timeout_error());
    }
    _ = reply.closed() => {
      terminate_zip_capture_child_or_exit(&mut child).await;
      return Err(isolated_zip_worker_error());
    }
    status = child.wait() => match status {
      Ok(status) => status,
      Err(_) => {
        terminate_zip_capture_child_or_exit(&mut child).await;
        return Err(isolated_zip_worker_error());
      }
    },
  };
  drop(parent_lifeline);
  if !status.success() {
    return Err(ApiError::new(
      StatusCode::UNPROCESSABLE_ENTITY,
      "The uploaded ZIP could not be rendered.",
    ));
  }
  let postprocess = async move {
    let bmp = tokio::task::spawn_blocking(move || {
      // Keep the private output directory alive until this blocking read ends,
      // even if its async waiter is cancelled.
      let _output_dir = output_dir;
      let metadata = std::fs::symlink_metadata(&output)?;
      if !metadata.file_type().is_file()
        || metadata.len() == 0
        || metadata.len() > MAX_CAPTURE_BMP_BYTES as u64
      {
        return Err(io::Error::new(
          io::ErrorKind::InvalidData,
          "isolated ZIP capture returned an invalid frame",
        ));
      }
      std::fs::read(output)
    })
    .await
    .map_err(|_| isolated_zip_worker_error())?
    .map_err(|_| isolated_zip_worker_error())?;
    if bmp.is_empty() || bmp.len() > MAX_CAPTURE_BMP_BYTES {
      return Err(isolated_zip_worker_error());
    }
    Ok(bmp)
  };
  tokio::select! {
    biased;
    _ = tokio::time::sleep_until(deadline) => Err(zip_render_timeout_error()),
    _ = reply.closed() => Err(isolated_zip_worker_error()),
    result = postprocess => result,
  }
}

fn is_zip_url(url: &str) -> bool {
  url
    .split_once("://")
    .is_some_and(|(scheme, path)| scheme.eq_ignore_ascii_case("zip") && !path.is_empty())
}

async fn terminate_zip_capture_child_or_exit(child: &mut Child) {
  let termination = tokio::time::timeout(
    ZIP_CAPTURE_PROCESS_GRACE,
    terminate_zip_capture_child(child),
  )
  .await;
  if !matches!(termination, Ok(Ok(()))) {
    // Releasing the extracted tree while its child may still be using it is
    // unsafe. A process-control failure is unrecoverable, so leave guards
    // intact and let the service supervisor restart this process. `exit` does
    // not unwind Rust values and, unlike aborting, does not request a core dump.
    std::process::exit(ZIP_CAPTURE_FATAL_EXIT_CODE);
  }
}

async fn terminate_zip_capture_child(child: &mut Child) -> io::Result<()> {
  if child.try_wait()?.is_some() {
    return Ok(());
  }
  if let Err(kill_error) = child.start_kill() {
    if child.try_wait()?.is_none() {
      return Err(kill_error);
    }
  }
  child.wait().await.map(|_| ())
}

fn zip_capture_executable() -> io::Result<PathBuf> {
  let current = std::env::current_exe()?;
  #[cfg(not(test))]
  {
    let expected = format!("ui-judge-server{}", std::env::consts::EXE_SUFFIX);
    if current.file_name() == Some(std::ffi::OsStr::new(&expected)) {
      Ok(current)
    } else {
      Err(io::Error::new(
        io::ErrorKind::NotFound,
        "isolated ZIP capture requires the ui-judge-server executable",
      ))
    }
  }
  #[cfg(test)]
  {
    let profile_dir = current
      .parent()
      .and_then(|deps| deps.parent())
      .ok_or_else(|| io::Error::other("test executable has no Cargo profile directory"))?;
    let candidate = profile_dir.join(format!("ui-judge-server{}", std::env::consts::EXE_SUFFIX));
    if candidate.is_file() {
      Ok(candidate)
    } else {
      Err(io::Error::new(
        io::ErrorKind::NotFound,
        "ui-judge-server test companion was not built",
      ))
    }
  }
}

fn zip_render_timeout_error() -> ApiError {
  ApiError::new(
    StatusCode::REQUEST_TIMEOUT,
    "The uploaded ZIP render timed out.",
  )
}

fn isolated_zip_worker_error() -> ApiError {
  ApiError::new(
    StatusCode::INTERNAL_SERVER_ERROR,
    "The isolated ZIP renderer is unavailable.",
  )
}

fn zip_api_error(error: zip::ZipExtractionError, job_id: u64) -> ApiError {
  log_zip_extraction(
    job_id,
    error.kind.to_string().as_str(),
    &error.stats,
    error.cleanup_failed,
  );
  if error.cleanup_failed {
    return ApiError::new(
      StatusCode::INTERNAL_SERVER_ERROR,
      "ZIP extraction failed and its staging directory could not be cleaned up.",
    );
  }
  let status = match error.kind {
    zip::ZipRejectionKind::UploadTooLarge
    | zip::ZipRejectionKind::TooManyEntries
    | zip::ZipRejectionKind::FileTooLarge
    | zip::ZipRejectionKind::ArchiveTooLarge => StatusCode::PAYLOAD_TOO_LARGE,
    zip::ZipRejectionKind::TimedOut => StatusCode::REQUEST_TIMEOUT,
    zip::ZipRejectionKind::OutputCollision
    | zip::ZipRejectionKind::OutputIo
    | zip::ZipRejectionKind::WorkerFailed => StatusCode::INTERNAL_SERVER_ERROR,
    _ => StatusCode::UNPROCESSABLE_ENTITY,
  };
  ApiError::new(status, format!("ZIP upload rejected: {}.", error.kind))
}

fn log_zip_extraction(
  job_id: u64,
  outcome: &str,
  stats: &zip::ZipExtractionStats,
  cleanup_failed: bool,
) {
  eprintln!(
    "[ui-judge-server] zip job_id={}-{} phase=extraction outcome={outcome} archive_bytes={} entries={} declared_bytes={} actual_bytes={} elapsed_ms={} cleanup_failed={cleanup_failed}",
    std::process::id(),
    job_id,
    stats.archive_bytes,
    stats.entry_count,
    stats.declared_uncompressed_bytes,
    stats.actual_uncompressed_bytes,
    stats.elapsed.as_millis(),
  );
}

fn log_zip_render(job_id: u64, outcome: &str, elapsed: Duration) {
  eprintln!(
    "[ui-judge-server] zip job_id={}-{} phase=render outcome={outcome} elapsed_ms={}",
    std::process::id(),
    job_id,
    elapsed.as_millis(),
  );
}

fn zip_render_outcome(result: &Result<Vec<u8>, ApiError>) -> &'static str {
  match result {
    Ok(_) => "rendered",
    Err(error) if error.status == StatusCode::REQUEST_TIMEOUT => "timed-out",
    Err(error) if error.status == StatusCode::UNPROCESSABLE_ENTITY => "rejected",
    Err(_) => "failed",
  }
}

async fn compare(mut multipart: Multipart) -> Result<Json<HttpCompareImagesResponse>, ApiError> {
  let mut reference_image = None;
  let mut rendered_image = None;

  while let Some(field) = multipart.next_field().await.map_err(multipart_error)? {
    let name = field.name().unwrap_or_default().to_string();
    match name.as_str() {
      "referenceImage" | "reference_image" => {
        if reference_image.is_some() {
          return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "referenceImage must be uploaded exactly once.",
          ));
        }
        reference_image = Some(read_uploaded_image(field, "referenceImage").await?);
      }
      "renderedImage" | "rendered_image" => {
        if rendered_image.is_some() {
          return Err(ApiError::new(
            StatusCode::BAD_REQUEST,
            "renderedImage must be uploaded exactly once.",
          ));
        }
        rendered_image = Some(read_uploaded_image(field, "renderedImage").await?);
      }
      _ => {
        return Err(ApiError::new(
          StatusCode::BAD_REQUEST,
          format!("Unexpected multipart field {name:?}."),
        ))
      }
    }
  }

  let reference_image = reference_image
    .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing referenceImage upload."))?;
  let rendered_image = rendered_image
    .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Missing renderedImage upload."))?;
  let comparison = compare_uploaded_images(&reference_image, &rendered_image).await?;
  Ok(Json(comparison.into()))
}

async fn read_uploaded_image(mut field: Field<'_>, name: &str) -> Result<Vec<u8>, ApiError> {
  let mut image = Vec::new();
  while let Some(chunk) = field.chunk().await.map_err(multipart_error)? {
    if image.len().saturating_add(chunk.len()) > MAX_IMAGE_BYTES {
      return Err(ApiError::new(
        StatusCode::PAYLOAD_TOO_LARGE,
        format!("{name} exceeds the {MAX_IMAGE_BYTES}-byte image limit."),
      ));
    }
    image.extend_from_slice(&chunk);
  }
  if image.is_empty() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      format!("{name} must not be empty."),
    ));
  }
  Ok(image)
}

fn multipart_error(error: MultipartError) -> ApiError {
  ApiError::new(
    error.status(),
    format!("Invalid multipart request: {}", error.body_text()),
  )
}

async fn wait_for_shutdown(mut receiver: watch::Receiver<bool>) {
  loop {
    if *receiver.borrow() {
      return;
    }
    if receiver.changed().await.is_err() {
      return;
    }
  }
}

async fn trigger_shutdown_on_worker_failure(
  worker_failure: oneshot::Receiver<()>,
  shutdown_sender: watch::Sender<bool>,
) {
  if worker_failure.await.is_ok() {
    let _ = shutdown_sender.send(true);
  }
}

#[cfg(unix)]
async fn shutdown_signal() -> io::Result<()> {
  let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())?;
  tokio::select! {
    result = tokio::signal::ctrl_c() => result,
    _ = terminate.recv() => Ok(()),
  }
}

#[cfg(not(unix))]
async fn shutdown_signal() -> io::Result<()> {
  tokio::signal::ctrl_c().await
}

#[cfg(test)]
mod tests {
  use crate::capture::CaptureResponse;
  use std::io::{Cursor, Write};
  use std::path::Path;
  use std::sync::mpsc::Receiver;
  use std::sync::{Barrier, Mutex, MutexGuard};

  use ::zip::write::SimpleFileOptions;
  use ::zip::{CompressionMethod, ZipWriter};
  use axum::body::Body;
  use axum::extract::FromRequest;
  use axum::http::Request;
  use base64::prelude::{Engine, BASE64_STANDARD};
  use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};

  use super::*;
  use crate::capture::CaptureJob;
  use crate::headless::CapturedPage;

  const CONCURRENT_CAPTURE_REQUESTS: usize = 4;

  /// Serves a queue with one deterministic reply per job.
  fn scripted_workers<F>(reply: F) -> Arc<CaptureWorkers>
  where
    F: Fn(CaptureJob) + Clone + Send + 'static,
  {
    Arc::new(
      CaptureWorkers::with_worker_main(1, move |jobs: Arc<Mutex<Receiver<CaptureJob>>>| loop {
        let job = {
          let jobs: MutexGuard<'_, Receiver<CaptureJob>> =
            jobs.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
          jobs.recv()
        };
        let Ok(mut job) = job else { return };
        job.release_queue_slot();
        reply(job);
      })
      .expect("start a deterministic headless worker"),
    )
  }

  fn http_request(url: &str) -> TemplateScreenshotRequest {
    TemplateScreenshotRequest {
      global_props: None,

      initial_data: None,

      screenshot_settle_ms: None,

      timeout_ms: None,
      url: url.to_string(),
    }
  }

  fn sample_image(format: ImageFormat, color: Rgba<u8>) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(8, 8, color));
    let mut bytes = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut bytes), format)
      .expect("encode the sample image");
    bytes
  }

  fn sample_bmp(color: Rgba<u8>) -> Vec<u8> {
    sample_image(ImageFormat::Bmp, color)
  }

  fn zip_upload(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    for (name, contents) in entries {
      writer
        .start_file(*name, options)
        .expect("add ZIP fixture file");
      writer.write_all(contents).expect("write ZIP fixture file");
    }
    writer.finish().expect("finish ZIP fixture").into_inner()
  }

  fn zip_request(entry: &str, upload: Vec<u8>) -> Request<Body> {
    multipart_request(
      "screenshot",
      &[("entry", entry.as_bytes()), ("file", &upload)],
    )
  }

  fn lynxml_request(entry: &str, source: &[u8]) -> Request<Body> {
    multipart_request(
      "screenshot",
      &[("entry", entry.as_bytes()), ("source", source)],
    )
  }

  fn remote_url_request(entry: &str, url: &str) -> Request<Body> {
    multipart_request(
      "screenshot",
      &[("entry", entry.as_bytes()), ("url", url.as_bytes())],
    )
  }

  fn multipart_request(boundary: &str, fields: &[(&str, &[u8])]) -> Request<Body> {
    let mut body = Vec::new();
    for (name, bytes) in fields {
      body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
      body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"{name}\"; filename=\"{name}.bmp\"\r\n")
          .as_bytes(),
      );
      body.extend_from_slice(b"Content-Type: image/bmp\r\n\r\n");
      body.extend_from_slice(bytes);
      body.extend_from_slice(b"\r\n");
    }
    body.extend_from_slice(format!("--{boundary}--\r\n").as_bytes());
    let request = Request::builder()
      .header(
        CONTENT_TYPE,
        format!("multipart/form-data; boundary={boundary}"),
      )
      .body(Body::from(body))
      .expect("build multipart request");
    request
  }

  async fn multipart(boundary: &str, fields: &[(&str, &[u8])]) -> Multipart {
    Multipart::from_request(multipart_request(boundary, fields), &())
      .await
      .expect("extract multipart request")
  }

  #[test]
  fn request_defaults_match_the_library_contract() {
    let capture_request = http_request("file:///tmp/main.lynx.bundle")
      .into_capture_request()
      .expect("valid HTTP request");

    assert_eq!(
      capture_request.request.screenshot_settle,
      Duration::from_millis(16)
    );
    assert_eq!(capture_request.request.timeout, Duration::from_secs(60));
    assert_eq!(capture_request.load_options, PageLoadOptions::default());
  }

  #[test]
  fn isolated_capture_config_reads_large_page_data_from_file() {
    let expected = IsolatedCaptureConfig {
      global_props_json: Some(json!({"message": "x".repeat(256 * 1024)}).to_string()),
      initial_data_json: Some(r#"{"ready":true}"#.to_string()),
      screenshot_settle_ms: 25,
      timeout_ms: 2_000,
    };
    let config_file = tempfile::NamedTempFile::new().expect("create private capture config");
    serde_json::to_writer(config_file.as_file(), &expected).expect("write capture config");

    let actual = parse_isolated_capture_config_args([
      std::ffi::OsString::from(ISOLATED_CAPTURE_CONFIG_ARG),
      config_file.path().as_os_str().to_owned(),
    ])
    .expect("parse isolated capture startup arguments");

    assert_eq!(actual, expected);
  }

  #[test]
  fn screenshot_entry_accepts_relative_paths_and_zip_urls() {
    for input in ["pages/index.lynxml", "zip:///pages/index.lynxml"] {
      let entry = ScreenshotEntry::parse(input).expect("parse screenshot entry");
      assert_eq!(entry.path, Path::new("pages/index.lynxml"));
      assert_eq!(entry.url, "zip:///pages/index.lynxml");
    }
  }

  #[test]
  fn screenshot_entry_rejects_paths_outside_the_staging_root() {
    for input in [
      "",
      "/absolute/index.lynxml",
      "../index.lynxml",
      "%2e%2e/index.lynxml",
      "dir\\index.lynxml",
      "C:/index.lynxml",
      "https://example.com/index.lynxml",
    ] {
      assert!(ScreenshotEntry::parse(input).is_err(), "{input}");
    }
  }

  #[tokio::test]
  async fn screenshot_form_defaults_to_800_by_600() {
    let form = read_screenshot_form(lynxml_request("index.lynxml", b"<lynx/>"), "source")
      .await
      .unwrap();
    assert_eq!(
      form.viewport,
      ScreenshotViewport {
        width: 800,
        height: 600
      }
    );
    assert_eq!(form.load_options, PageLoadOptions::default());
  }

  #[tokio::test]
  async fn screenshot_form_accepts_dimensions_and_large_page_data_in_any_order() {
    let props = json!({"messages": [{"text": "x".repeat(256 * 1024)}]}).to_string();
    let request = multipart_request(
      "screenshot",
      &[
        ("globalProps", props.as_bytes()),
        ("url", b"https://example.com/template.js"),
        ("width", b"375"),
        (
          "initData",
          r#"{"nested":{"items":[1,true,null,"你好"]}}"#.as_bytes(),
        ),
        ("entry", b"pages/template.js"),
        ("height", b"812"),
      ],
    );
    let form = read_screenshot_form(request, "url").await.unwrap();
    assert_eq!(
      form.viewport,
      ScreenshotViewport {
        width: 375,
        height: 812
      }
    );
    assert_eq!(form.entry.url, "zip:///pages/template.js");
    assert_eq!(
      form.load_options.global_props_json.as_deref(),
      Some(props.as_str())
    );
    assert_eq!(
      form.load_options.initial_data_json.as_deref(),
      Some(r#"{"nested":{"items":[1,true,null,"你好"]}}"#)
    );
    assert!(form.load_options.base_dir.is_none());
  }

  #[tokio::test]
  async fn screenshot_form_rejects_missing_duplicate_unknown_and_invalid_fields() {
    let base: &[(&str, &[u8])] = &[
      ("entry", b"template.js"),
      ("url", b"https://example.com/template.js"),
    ];
    for name in ["entry", "url"] {
      let fields: Vec<_> = base
        .iter()
        .copied()
        .filter(|(key, _)| *key != name)
        .collect();
      let error = read_screenshot_form(multipart_request("screenshot", &fields), "url")
        .await
        .unwrap_err();
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
      assert!(error.message.contains(&format!("Missing {name}")));
    }
    for (name, value) in [
      ("entry", b"template.js".as_slice()),
      ("url", b"https://example.com/template.js"),
      ("width", b"375"),
      ("height", b"812"),
      ("globalProps", b"{}"),
      ("initData", b"{}"),
    ] {
      let mut fields = base.to_vec();
      if !matches!(name, "entry" | "url") {
        fields.push((name, value));
      }
      fields.push((name, value));
      let error = read_screenshot_form(multipart_request("screenshot", &fields), "url")
        .await
        .unwrap_err();
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
      assert!(error.message.contains("exactly once"));
    }
    for field in [
      ("baseDir", b"/tmp".as_slice()),
      ("steps", b"[]"),
      ("model", b"model"),
      ("source", b"<lynx/>"),
      ("file", b"zip"),
      ("initialData", b"{}"),
      ("width", b"0"),
      ("height", b"8193"),
      ("width", b"1.5"),
      ("height", b"-1"),
      ("width", b""),
      ("height", &[0xff]),
    ] {
      let mut fields = base.to_vec();
      fields.push(field);
      let error = read_screenshot_form(multipart_request("screenshot", &fields), "url")
        .await
        .unwrap_err();
      assert_eq!(error.status, StatusCode::BAD_REQUEST, "field {}", field.0);
    }
    for name in ["globalProps", "initData"] {
      for value in [
        b"[]".as_slice(),
        b"null",
        b"1",
        b"true",
        b"\"text\"",
        b"{",
        b"",
        &[0xff],
      ] {
        let mut fields = base.to_vec();
        fields.push((name, value));
        let error = read_screenshot_form(multipart_request("screenshot", &fields), "url")
          .await
          .unwrap_err();
        assert_eq!(error.status, StatusCode::BAD_REQUEST);
        assert_eq!(error.message, format!("{name} must be a JSON object."));
      }
    }
    for entry in [b"../page.js".as_slice(), b"file:///tmp/page.js", &[0xff]] {
      let error = read_screenshot_form(
        multipart_request("screenshot", &[("entry", entry), base[1]]),
        "url",
      )
      .await
      .unwrap_err();
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }
  }

  #[tokio::test]
  async fn screenshot_form_rejects_queries_raw_bodies_and_malformed_multipart() {
    let mut request = remote_url_request("template.js", "https://example.com/template.js");
    *request.uri_mut() = "/screenshot/template/url?width=375".parse().unwrap();
    assert_eq!(
      read_screenshot_form(request, "url")
        .await
        .unwrap_err()
        .status,
      StatusCode::BAD_REQUEST
    );
    for content_type in [
      "text/plain",
      "application/xml",
      "application/zip",
      "multipart/form-data",
    ] {
      let request = Request::builder()
        .header(CONTENT_TYPE, content_type)
        .body(Body::empty())
        .unwrap();
      assert_eq!(
        read_screenshot_form(request, "source")
          .await
          .unwrap_err()
          .status,
        StatusCode::UNSUPPORTED_MEDIA_TYPE
      );
    }
    let request = Request::builder()
      .header(CONTENT_TYPE, "multipart/form-data; boundary=broken")
      .body(Body::from("--broken\r\n"))
      .unwrap();
    assert_eq!(
      read_screenshot_form(request, "source")
        .await
        .unwrap_err()
        .status,
      StatusCode::BAD_REQUEST
    );
  }

  #[tokio::test]
  async fn screenshot_form_enforces_aggregate_stream_and_url_limits() {
    let mut request = lynxml_request("index.lynxml", b"<lynx/>");
    request
      .headers_mut()
      .insert(CONTENT_LENGTH, (MAX_SCREENSHOT_REQUEST_BYTES + 1).into());
    assert_eq!(
      read_screenshot_form(request, "source")
        .await
        .unwrap_err()
        .status,
      StatusCode::PAYLOAD_TOO_LARGE
    );
    // Individually valid parts must not exceed the shared budget together,
    // including when Content-Length is absent or understates the stream.
    let half = vec![b'x'; MAX_SCREENSHOT_FORM_BYTES / 2];
    for content_length in [None, Some(1)] {
      let mut request = multipart_request(
        "screenshot",
        &[
          ("entry", b"template.js"),
          ("file", &half),
          ("globalProps", &half),
        ],
      );
      if let Some(length) = content_length {
        request.headers_mut().insert(CONTENT_LENGTH, length.into());
      }
      assert_eq!(
        read_screenshot_form(request, "file")
          .await
          .unwrap_err()
          .status,
        StatusCode::PAYLOAD_TOO_LARGE
      );
    }
    let huge = vec![b'x'; MAX_SCREENSHOT_REQUEST_BYTES + 1];
    let request = multipart_request("screenshot", &[("entry", b"template.js"), ("file", &huge)]);
    assert_eq!(
      read_screenshot_form(request, "file")
        .await
        .unwrap_err()
        .status,
      StatusCode::PAYLOAD_TOO_LARGE
    );
    let long_url = "x".repeat(MAX_REMOTE_URL_BYTES + 1);
    let error = read_screenshot_form(remote_url_request("template.js", &long_url), "url")
      .await
      .unwrap_err();
    assert_eq!(error.status, StatusCode::PAYLOAD_TOO_LARGE);
  }

  #[tokio::test]
  async fn screenshot_form_body_has_a_deadline() {
    let error =
      read_screenshot_form_with_deadline(std::future::pending(), Duration::from_millis(1))
        .await
        .unwrap_err();
    assert_eq!(error.status, StatusCode::REQUEST_TIMEOUT);
  }

  #[tokio::test]
  async fn screenshot_sources_reject_invalid_inputs_before_capture() {
    let headless = scripted_workers(|_| panic!("invalid sources must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),

      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };
    for (entry, source) in [
      ("index.lynxml", b"".as_slice()),
      ("index.lynxml", &[0xff]),
      ("template.js", b"<lynx/>"),
    ] {
      let error = screenshot_lynxml(State(state.clone()), lynxml_request(entry, source))
        .await
        .unwrap_err();
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }
    let error = screenshot_zip_upload(State(state.clone()), zip_request("index.lynxml", vec![]))
      .await
      .unwrap_err();
    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    for source_name in ["source", "file", "url"] {
      let request = multipart_request(
        "screenshot",
        &[
          ("entry", b"index.lynxml"),
          (source_name, b"source"),
          ("globalProps", b"{}"),
        ],
      );
      let error = read_screenshot_form(request, source_name)
        .await
        .unwrap_err();
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
      assert!(error
        .message
        .contains("globalProps is not supported for LynXML"));
      let missing = multipart_request("screenshot", &[("entry", b"index.lynxml")]);
      assert!(read_screenshot_form(missing, source_name)
        .await
        .unwrap_err()
        .message
        .contains(&format!("Missing {source_name}")));
      let duplicate = multipart_request(
        "screenshot",
        &[
          ("entry", b"index.lynxml"),
          (source_name, b"source"),
          (source_name, b"source"),
        ],
      );
      assert!(read_screenshot_form(duplicate, source_name)
        .await
        .unwrap_err()
        .message
        .contains("exactly once"));
    }
    headless.shutdown().expect("stop unused screenshot worker");
  }

  #[test]
  fn screenshot_viewport_rejects_unsafe_dimensions() {
    for (width, height) in [(0, 600), (800, 0), (8_193, 1), (2_000, 2_000)] {
      let error = ScreenshotViewport::new(width, height).expect_err("reject unsafe viewport");
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }
  }

  #[test]
  fn remote_url_part_requires_nonempty_utf8() {
    assert_eq!(
      remote_url(b" https://example.com/page.zip \n").unwrap(),
      "https://example.com/page.zip"
    );
    for bytes in [b"".as_slice(), b" \n", &[0xff]] {
      assert_eq!(
        remote_url(bytes).unwrap_err().status,
        StatusCode::BAD_REQUEST
      );
    }
  }

  #[tokio::test]
  async fn remote_screenshot_endpoints_share_ssrf_protection() {
    let headless = scripted_workers(|_| panic!("blocked URLs must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let error = screenshot_zip_url(
      State(state.clone()),
      remote_url_request("index.lynxml", "http://127.0.0.1/archive.zip"),
    )
    .await
    .expect_err("reject a private ZIP host");
    assert_eq!(error.status, StatusCode::FORBIDDEN);

    let error = screenshot_template_url(
      State(state),
      remote_url_request("template.js", "http://[::1]/template.js"),
    )
    .await
    .expect_err("reject a private template host");
    assert_eq!(error.status, StatusCode::FORBIDDEN);
    headless.shutdown().expect("stop unused screenshot worker");
  }

  #[tokio::test]
  async fn template_url_requires_a_javascript_entry() {
    let headless = scripted_workers(|_| panic!("invalid entries must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let error = screenshot_template_url(
      State(state),
      remote_url_request("index.lynxml", "https://example.com/template.js"),
    )
    .await
    .expect_err("reject a non-JavaScript template entry");
    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    headless.shutdown().expect("stop unused screenshot worker");
  }

  #[test]
  fn rejects_scoring_model_and_interaction_fields() {
    for field in [
      "task",
      "steps",
      "includeGeqi",
      "includeScreenshot",
      "model",
      "apiKey",
      "baseURL",
      "referenceImage",
    ] {
      let mut value = json!({"url": "https://example.com/template.js"});
      value[field] = json!(null);
      assert!(
        serde_json::from_value::<TemplateScreenshotRequest>(value).is_err(),
        "accepted {field}"
      );
    }
  }

  #[test]
  fn accepts_camel_case_page_data_as_json() {
    let request: TemplateScreenshotRequest = serde_json::from_value(json!({
      "globalProps": {
        "instant": true,
        "messages": [{"beginRendering": {"surfaceId": "main"}}],
        "theme": "light"
      },
      "initialData": {
        "messages": [{"surfaceUpdate": {"surfaceId": "main"}}]
      },
      "url": "file:///tmp/a2ui.lynx.bundle"
    }))
    .expect("deserialize HTTP request");
    let capture_request = request.into_capture_request().expect("valid HTTP request");

    assert_eq!(
      capture_request
        .load_options
        .global_props_json
        .as_deref()
        .map(serde_json::from_str::<Value>)
        .transpose()
        .expect("parse forwarded global props"),
      Some(json!({
        "instant": true,
        "messages": [{"beginRendering": {"surfaceId": "main"}}],
        "theme": "light"
      }))
    );
    assert_eq!(
      capture_request
        .load_options
        .initial_data_json
        .as_deref()
        .map(serde_json::from_str::<Value>)
        .transpose()
        .expect("parse forwarded initial data"),
      Some(json!({
        "messages": [{"surfaceUpdate": {"surfaceId": "main"}}]
      }))
    );
  }

  #[tokio::test]
  async fn lynxml_screenshot_stages_source_and_cleans_it_up() {
    let source: &'static [u8] = b"<!doctype lynx><lynx><script thread=\"main\"></script></lynx>";
    let staged_path = Arc::new(Mutex::new(None::<PathBuf>));
    let worker_staged_path = Arc::clone(&staged_path);
    let bmp = sample_image(ImageFormat::Bmp, Rgba([20, 40, 60, 255]));
    let expected_bmp = bmp.clone();
    let headless = scripted_workers(move |job| {
      assert_eq!(
        job.load_options.initial_data_json.as_deref(),
        Some(r#"{"ready":true}"#)
      );
      assert!(job.load_options.global_props_json.is_none());
      assert_eq!(job.request.url, "zip:///pages/index.lynxml");
      let base_dir = job
        .load_options
        .base_dir
        .as_ref()
        .expect("LynXML capture has an internal base directory");
      assert_eq!(
        std::fs::read(base_dir.join("pages/index.lynxml")).unwrap(),
        source
      );
      *worker_staged_path
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(base_dir.clone());
      let _ = job.response.send(CaptureResponse {
        capture: Ok(CapturedPage::from_bmp(bmp.clone())),
      });
    });
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let response = screenshot_lynxml(
      State(state),
      multipart_request(
        "screenshot",
        &[
          ("entry", b"pages/index.lynxml"),
          ("source", source),
          ("initData", br#"{"ready":true}"#),
        ],
      ),
    )
    .await
    .expect("render LynXML source");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[CONTENT_TYPE], "image/bmp");
    assert_eq!(response.headers()[CACHE_CONTROL], "no-store");
    let body = axum::body::to_bytes(response.into_body(), MAX_CAPTURE_BMP_BYTES)
      .await
      .expect("read BMP screenshot response");
    assert_eq!(body.as_ref(), expected_bmp.as_slice());
    let staged_path = staged_path
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .clone()
      .expect("worker observed the staging directory");
    headless.shutdown().expect("stop LynXML screenshot worker");
    assert!(
      !staged_path.exists(),
      "the request drops the LynXML staging directory after capture"
    );
  }

  #[tokio::test]
  async fn remote_template_screenshot_stages_capture_options_and_cleans_up() {
    let source: &'static [u8] = b"globalThis.__uiJudgeTemplate = true;";
    let staged_path = Arc::new(Mutex::new(None::<PathBuf>));
    let worker_staged_path = Arc::clone(&staged_path);
    let bmp = sample_image(ImageFormat::Bmp, Rgba([20, 40, 60, 255]));
    let expected_bmp = bmp.clone();
    let headless = scripted_workers(move |job| {
      assert_eq!(job.request.url, "zip:///template.js");
      assert_eq!(
        job.load_options.global_props_json.as_deref(),
        Some(r#"{"messages":[]}"#)
      );
      assert_eq!(
        job.load_options.initial_data_json.as_deref(),
        Some(r#"{"ready":true}"#)
      );
      let base_dir = job
        .load_options
        .base_dir
        .as_ref()
        .expect("remote template capture has an internal base directory");
      assert_eq!(std::fs::read(base_dir.join("template.js")).unwrap(), source);
      *worker_staged_path
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(base_dir.clone());
      let _ = job.response.send(CaptureResponse {
        capture: Ok(CapturedPage::from_bmp(bmp.clone())),
      });
    });
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };
    let mut http_request = http_request("https://example.com/template.js");
    http_request.global_props = Some(json!({"messages": []}));
    http_request.initial_data = Some(json!({"ready": true}));
    let capture_request = http_request
      .into_capture_request()
      .expect("build remote template request");

    let capture = capture_staged_source(
      &state,
      ScreenshotEntry::parse("template.js").expect("parse staged template entry"),
      source.to_vec(),
      StagedSourceKind::Template,
      ScreenshotViewport {
        width: DEFAULT_SCREENSHOT_WIDTH,
        height: DEFAULT_SCREENSHOT_HEIGHT,
      },
      &capture_request.load_options,
      &capture_request.request,
    )
    .await
    .expect("capture staged remote template");

    let image = capture.into_bmp();
    assert_eq!(image, expected_bmp);
    let form = read_screenshot_form(
      multipart_request(
        "screenshot",
        &[
          ("entry", b"template.js"),
          ("url", b"https://example.com/template.js"),
          ("globalProps", br#"{"messages":[]}"#),
          ("initData", br#"{"ready":true}"#),
        ],
      ),
      "url",
    )
    .await
    .expect("parse template screenshot parts");
    let response = render_staged_source(
      &state,
      form.entry,
      source.to_vec(),
      StagedSourceKind::Template,
      form.viewport,
      form.load_options,
    )
    .await
    .expect("render a staged template with multipart page data");
    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[CONTENT_TYPE], "image/bmp");
    let body = axum::body::to_bytes(response.into_body(), MAX_CAPTURE_BMP_BYTES)
      .await
      .expect("read multipart BMP screenshot response");
    assert_eq!(body.as_ref(), expected_bmp.as_slice());
    let staged_path = staged_path
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .clone()
      .expect("worker observed the staging directory");
    headless.shutdown().expect("stop template capture worker");
    assert!(!staged_path.exists());
  }

  #[tokio::test]
  async fn zip_screenshot_uses_the_requested_entrypoint_until_capture_finishes() {
    let index = b"globalThis.__uiJudgeTemplate = true;";
    let upload = zip_upload(&[("pages/template.js", index)]);
    let staged_path = Arc::new(Mutex::new(None::<PathBuf>));
    let worker_staged_path = Arc::clone(&staged_path);
    let bmp = sample_image(ImageFormat::Bmp, Rgba([20, 40, 60, 255]));
    let expected_bmp = bmp.clone();
    let headless = scripted_workers(move |job| {
      assert_eq!(
        job.load_options.global_props_json.as_deref(),
        Some(r#"{"messages":[]}"#)
      );
      assert_eq!(
        job.load_options.initial_data_json.as_deref(),
        Some(r#"{"ready":true}"#)
      );
      assert_eq!(job.request.url, "zip:///pages/template.js");
      let base_dir = job
        .load_options
        .base_dir
        .as_ref()
        .expect("ZIP capture has an internal base directory");
      assert_eq!(
        std::fs::read(base_dir.join("pages/template.js")).unwrap(),
        index
      );
      *worker_staged_path
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(base_dir.clone());
      let _ = job.response.send(CaptureResponse {
        capture: Ok(CapturedPage::from_bmp(bmp.clone())),
      });
    });
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let response = screenshot_zip_upload(
      State(state),
      multipart_request(
        "screenshot",
        &[
          ("entry", b"zip:///pages/template.js"),
          ("file", &upload),
          ("globalProps", br#"{"messages":[]}"#),
          ("initData", br#"{"ready":true}"#),
        ],
      ),
    )
    .await
    .expect("render uploaded ZIP");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[CONTENT_TYPE], "image/bmp");
    assert_eq!(response.headers()[CACHE_CONTROL], "no-store");
    let body = axum::body::to_bytes(response.into_body(), MAX_CAPTURE_BMP_BYTES)
      .await
      .expect("read BMP screenshot response");
    assert_eq!(body.as_ref(), expected_bmp.as_slice());
    let staged_path = staged_path
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .clone()
      .expect("worker observed the staging directory");
    headless.shutdown().expect("stop ZIP screenshot worker");
    assert!(
      !staged_path.exists(),
      "the capture job drops the ZIP staging directory after capture"
    );
  }

  #[test]
  fn accepts_snake_case_page_data_aliases() {
    let request: TemplateScreenshotRequest = serde_json::from_value(json!({
      "global_props": {"messages": []},
      "initial_data": {"playbackMode": true},
      "url": "file:///tmp/a2ui.lynx.bundle"
    }))
    .expect("deserialize aliased HTTP request");
    let capture_request = request.into_capture_request().expect("valid HTTP request");

    assert_eq!(
      capture_request.load_options.global_props_json.as_deref(),
      Some(r#"{"messages":[]}"#)
    );
    assert_eq!(
      capture_request.load_options.initial_data_json.as_deref(),
      Some(r#"{"playbackMode":true}"#)
    );
  }

  #[test]
  fn rejects_a_zero_request_timeout() {
    let mut request = http_request("file:///tmp/main.lynx.bundle");
    request.timeout_ms = Some(0);
    let error = request
      .into_capture_request()
      .expect_err("zero timeout must fail");

    assert_eq!(error.status, StatusCode::BAD_REQUEST);
  }

  #[test]
  fn rejects_non_object_page_data() {
    let mut request = http_request("file:///tmp/main.lynx.bundle");
    request.global_props = Some(json!(["not", "an", "object"]));
    let error = request
      .into_capture_request()
      .expect_err("non-object global props must fail");

    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    assert_eq!(error.message, "globalProps must be a JSON object.");
  }

  #[test]
  fn rejects_port_zero() {
    assert!(matches!(
      parse_port("0"),
      Err(ServerError::InvalidPort { .. })
    ));
  }

  #[tokio::test]
  async fn binds_both_unspecified_addresses_by_default() {
    let (ipv4, ipv6) = bind_listeners(None, 0).expect("bind default listeners");

    assert_eq!(
      ipv4
        .expect("IPv4 listener")
        .local_addr()
        .expect("IPv4 address")
        .ip(),
      Ipv4Addr::UNSPECIFIED
    );
    assert_eq!(
      ipv6
        .expect("IPv6 listener")
        .local_addr()
        .expect("IPv6 address")
        .ip(),
      Ipv6Addr::UNSPECIFIED
    );
  }

  #[tokio::test]
  async fn binds_only_the_explicit_ipv4_host() {
    let (ipv4, ipv6) = bind_listeners(Some("127.0.0.1"), 0).expect("bind IPv4 listener");

    assert_eq!(
      ipv4
        .expect("IPv4 listener")
        .local_addr()
        .expect("IPv4 address")
        .ip(),
      Ipv4Addr::LOCALHOST
    );
    assert!(ipv6.is_none());
  }

  #[tokio::test]
  async fn binds_only_the_explicit_ipv6_host() {
    let (ipv4, ipv6) = bind_listeners(Some("::1"), 0).expect("bind IPv6 listener");

    assert!(ipv4.is_none());
    assert_eq!(
      ipv6
        .expect("IPv6 listener")
        .local_addr()
        .expect("IPv6 address")
        .ip(),
      Ipv6Addr::LOCALHOST
    );
  }

  #[tokio::test]
  async fn health_reports_ready_while_the_worker_is_available() {
    let headless = scripted_workers(drop);
    let response = health(State(AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    }))
    .await
    .expect("healthy worker must pass readiness");

    assert_eq!(response.0, json!({ "status": "ok" }));
    headless.shutdown().expect("stop mock headless worker");
  }

  #[tokio::test]
  async fn zip_render_queue_waits_until_capacity_is_available() {
    let processes = ZipCaptureProcesses::with_capacity(1);
    let first = processes
      .begin(tokio::time::Instant::now() + Duration::from_secs(1))
      .await
      .expect("occupy the only ZIP render slot");
    let waiting_processes = processes.clone();
    let waiting = tokio::spawn(async move {
      waiting_processes
        .begin(tokio::time::Instant::now() + Duration::from_secs(1))
        .await
    });

    tokio::task::yield_now().await;
    assert!(!waiting.is_finished());
    drop(first);
    let second = waiting
      .await
      .expect("join the waiting ZIP renderer")
      .expect("start after render capacity is available");
    drop(second);
    processes.close_and_wait().await;
  }

  #[tokio::test]
  async fn zip_render_queue_wait_respects_the_deadline() {
    let processes = ZipCaptureProcesses::with_capacity(1);
    let active = processes
      .begin(tokio::time::Instant::now() + Duration::from_secs(1))
      .await
      .expect("occupy the only ZIP render slot");
    let Err(error) = processes
      .begin(tokio::time::Instant::now() + Duration::from_millis(1))
      .await
    else {
      panic!("time out while the ZIP render queue is full");
    };

    assert_eq!(error.status, StatusCode::REQUEST_TIMEOUT);
    drop(active);
    processes.close_and_wait().await;
  }

  #[tokio::test]
  async fn zip_process_shutdown_waits_for_every_active_supervisor() {
    let processes = ZipCaptureProcesses::new();
    let deadline = tokio::time::Instant::now() + Duration::from_secs(1);
    let first = processes
      .begin(deadline)
      .await
      .expect("start first ZIP supervisor");
    let second = processes
      .begin(deadline)
      .await
      .expect("start second ZIP supervisor");
    let shutdown_processes = processes.clone();
    let shutdown = tokio::spawn(async move {
      shutdown_processes.close_and_wait().await;
    });

    tokio::task::yield_now().await;
    assert!(!shutdown.is_finished());
    drop(first);
    tokio::task::yield_now().await;
    assert!(!shutdown.is_finished());
    drop(second);
    shutdown.await.expect("join ZIP process shutdown");

    let Err(error) = processes
      .begin(tokio::time::Instant::now() + Duration::from_secs(1))
      .await
    else {
      panic!("closed ZIP process broker must reject new work");
    };
    assert_eq!(error.status, StatusCode::SERVICE_UNAVAILABLE);
  }

  #[test]
  #[cfg_attr(
    not(target_os = "linux"),
    ignore = "the Linux runtime-backed test is the CI contract; run explicitly for local diagnostics"
  )]
  fn one_native_owner_renders_concurrent_requests_and_zip_images() {
    let package_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
    let source = package_dir.join("tests/fixtures/react/.generated/main.lynx.bundle");
    assert!(source.is_file(), "build the React fixture before this test");
    // Distinct URLs prove the owner renders four different queued pages rather
    // than reusing one loaded page.
    let bundles = (0..CONCURRENT_CAPTURE_REQUESTS)
      .map(|index| {
        let bundle = source.with_file_name(format!("concurrent-{index}.lynx.bundle"));
        std::fs::copy(&source, &bundle).expect("copy concurrent fixture");
        bundle
      })
      .collect::<Vec<_>>();
    let headless = shared_workers().expect("start the process-wide headless worker");
    let runtime = tokio::runtime::Builder::new_multi_thread()
      .worker_threads(2)
      .enable_all()
      .build()
      .expect("build the caller runtime");
    let captures = runtime.block_on(async {
      let requests = bundles.iter().map(|bundle| {
        let headless = Arc::clone(&headless);
        let capture = http_request(&format!("file://{}", bundle.display()))
          .into_capture_request()
          .expect("build capture request");
        async move {
          headless
            .capture(capture.request, capture.load_options)
            .await
        }
      });
      futures_join_all(requests).await
    });

    for capture in captures {
      let capture = capture
        .expect("receive a concurrent capture")
        .capture
        .expect("render a concurrent page");
      let bmp = capture.into_bmp();
      let rgb = image::load_from_memory(&bmp)
        .expect("decode a concurrent screenshot")
        .to_rgb8();
      assert_eq!(rgb.dimensions(), (800, 600));
    }

    let upload = zip_upload(&[(
      "main.lynx.bundle",
      &std::fs::read(&source).expect("read template fixture"),
    )]);
    let global_props = json!({"message": "x".repeat(256 * 1024)}).to_string();
    let response = runtime
      .block_on(screenshot_zip_upload(
        State(AppState {
          headless: Arc::clone(&headless),

          zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
          zip_capture_processes: ZipCaptureProcesses::new(),
        }),
        multipart_request(
          "screenshot",
          &[
            ("entry", b"main.lynx.bundle"),
            ("file", &upload),
            ("globalProps", global_props.as_bytes()),
            ("initData", br#"{"ready":true}"#),
          ],
        ),
      ))
      .expect("render an isolated compiled template with large page data");
    let bmp = runtime
      .block_on(axum::body::to_bytes(response.into_body(), MAX_IMAGE_BYTES))
      .unwrap();
    let rgb = image::load_from_memory(&bmp)
      .expect("decode compiled template screenshot")
      .to_rgb8();
    assert_eq!(rgb.dimensions(), (800, 600));

    let lynxml: &[u8] = br#"<!doctype lynx>
<lynx engine-version="4.2">
  <script thread="main">
    var engine = lynx.getEngine();
    var page = __CreatePage("0", 0);
    var pageId = __GetElementUniqueID(page);
    engine.addEventListener("__RenderPage", function() {
      var root = __CreateView(pageId);
      __SetInlineStyles(root, "width:375px;height:812px;background-color:#00ff00;");
      __AppendElement(page, root);
      __FlushElementTree(page);
    });
  </script>
</lynx>"#;
    let response = runtime
      .block_on(screenshot_lynxml(
        State(AppState {
          headless: Arc::clone(&headless),

          zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
          zip_capture_processes: ZipCaptureProcesses::new(),
        }),
        multipart_request(
          "screenshot",
          &[
            ("entry", b"index.lynxml"),
            ("width", b"375"),
            ("height", b"812"),
            ("source", lynxml),
            ("initData", br#"{"ready":true}"#),
          ],
        ),
      ))
      .expect("render raw LynXML source");
    let bmp = runtime
      .block_on(axum::body::to_bytes(response.into_body(), MAX_IMAGE_BYTES))
      .expect("read LynXML screenshot response");
    let rgb = image::load_from_memory(&bmp)
      .expect("decode LynXML screenshot")
      .to_rgb8();
    assert_eq!(rgb.dimensions(), (375, 812));
    assert!(
      rgb.get_pixel(187, 406)[1] > 200,
      "raw LynXML paints the expected green view"
    );

    let index: &[u8] = br#"<!doctype lynx>
<lynx engine-version="4.2">
  <script thread="main">
    var engine = lynx.getEngine();
    var page = __CreatePage("0", 0);
    var pageId = __GetElementUniqueID(page);
    var rendered = false;

    function renderPage() {
      if (rendered) return;
      rendered = true;
      var root = __CreateView(pageId);
      __SetInlineStyles(root, "width:800px;height:600px;flex-direction:row;background-color:#000000;");

      var relative = __CreateImage(pageId);
      __SetAttribute(relative, "src", "./images/relative.png");
      __SetAttribute(relative, "mode", "scaleToFill");
      __SetInlineStyles(relative, "width:400px;height:600px;");

      var absolute = __CreateImage(pageId);
      __SetAttribute(absolute, "src", "zip:///images/absolute.png");
      __SetAttribute(absolute, "mode", "scaleToFill");
      __SetInlineStyles(absolute, "width:400px;height:600px;");

      __AppendElement(root, relative);
      __AppendElement(root, absolute);
      __AppendElement(page, root);
      __FlushElementTree(page);
    }

    engine.addEventListener("__RenderPage", renderPage);
  </script>
</lynx>"#;
    let render_zip = |relative_png: &[u8], absolute_png: &[u8]| {
      let upload = zip_upload(&[
        ("index.lynxml", index),
        ("images/relative.png", relative_png),
        ("images/absolute.png", absolute_png),
      ]);
      let response = runtime
        .block_on(screenshot_zip_upload(
          State(AppState {
            headless: Arc::clone(&headless),

            zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
            zip_capture_processes: ZipCaptureProcesses::new(),
          }),
          zip_request("zip:///index.lynxml", upload),
        ))
        .expect("render ZIP image resources");
      assert_eq!(response.status(), StatusCode::OK);
      let bmp = runtime
        .block_on(axum::body::to_bytes(response.into_body(), MAX_IMAGE_BYTES))
        .expect("read ZIP screenshot response");
      let rgb = image::load_from_memory(&bmp)
        .expect("decode ZIP screenshot")
        .to_rgb8();
      assert_eq!(rgb.dimensions(), (800, 600));
      rgb
    };
    let assert_split_colors =
      |rgb: &image::RgbImage, left: [u8; 3], right: [u8; 3], description: &str| {
        let midpoint = rgb.width() / 2;
        let mut left_pixels = 0;
        let mut right_pixels = 0;
        for (x, _, pixel) in rgb.enumerate_pixels() {
          let near = |expected: [u8; 3]| {
            pixel
              .0
              .iter()
              .zip(expected)
              .all(|(actual, expected)| actual.abs_diff(expected) < 70)
          };
          if x < midpoint && near(left) {
            left_pixels += 1;
          }
          if x >= midpoint && near(right) {
            right_pixels += 1;
          }
        }
        assert!(
          left_pixels > 1_024,
          "{description}: relative ZIP image painted only {left_pixels} matching pixels"
        );
        assert!(
          right_pixels > 1_024,
          "{description}: absolute zip:/// image painted only {right_pixels} matching pixels"
        );
      };

    let first = render_zip(
      include_bytes!("../tests/fixtures/images/red.png"),
      include_bytes!("../tests/fixtures/images/blue.png"),
    );
    assert_split_colors(&first, [255, 0, 0], [0, 0, 255], "first upload");

    // Reuse the exact same archive paths with different bytes. Each untrusted
    // upload must run in a fresh process so Clay's process-wide image cache
    // cannot return pixels belonging to the previous request.
    let second = render_zip(
      include_bytes!("../tests/fixtures/images/green.png"),
      include_bytes!("../tests/fixtures/images/yellow.png"),
    );
    assert_split_colors(&second, [0, 255, 0], [255, 255, 0], "second upload");
    for bundle in bundles {
      std::fs::remove_file(bundle).expect("remove concurrent fixture copy");
    }
  }

  /// Awaits every future concurrently without adding a futures dependency.
  async fn futures_join_all<F>(futures: impl Iterator<Item = F>) -> Vec<F::Output>
  where
    F: std::future::Future + Send + 'static,
    F::Output: Send + 'static,
  {
    let handles = futures.map(tokio::spawn).collect::<Vec<_>>();
    let mut results = Vec::with_capacity(handles.len());
    for handle in handles {
      results.push(handle.await.expect("capture task must not panic"));
    }
    results
  }

  #[tokio::test]
  async fn compares_two_uploads_without_a_headless_or_model_request() {
    let bmp = sample_bmp(Rgba([20, 40, 60, 255]));
    let multipart = multipart(
      "ui-judge-boundary",
      &[
        ("referenceImage", bmp.as_slice()),
        ("renderedImage", bmp.as_slice()),
      ],
    )
    .await;
    let response = compare(multipart).await.expect("compare uploaded images").0;

    assert_eq!(response.visual_similarity, 1.0);
    assert_eq!(response.different_blocks, 0);
    assert_eq!(response.total_blocks, 1);
    let diff = BASE64_STANDARD
      .decode(response.diff_image_base64)
      .expect("decode base64 diff response");
    assert!(diff.starts_with(b"BM"));
    let pixels = image::load_from_memory_with_format(&diff, ImageFormat::Bmp)
      .expect("decode BMP diff response")
      .into_rgba8();
    assert_eq!(pixels, RgbaImage::from_pixel(8, 8, Rgba([20, 40, 60, 255])));
  }

  #[tokio::test]
  async fn rejects_png_uploads_even_with_a_bmp_filename_and_content_type() {
    let bmp = sample_bmp(Rgba([20, 40, 60, 255]));
    let png = include_bytes!("../tests/fixtures/images/red.png").as_slice();
    for (reference, rendered, name) in [
      (png, bmp.as_slice(), "Reference image"),
      (bmp.as_slice(), png, "Rendered image"),
    ] {
      let multipart = multipart(
        "ui-judge-boundary",
        &[("referenceImage", reference), ("renderedImage", rendered)],
      )
      .await;
      let error = compare(multipart)
        .await
        .expect_err("PNG bytes must fail regardless of upload metadata");

      assert_eq!(error.status, StatusCode::BAD_REQUEST);
      assert!(error.message.contains(name));
      assert!(error.message.contains("BMP"));
    }
  }

  #[tokio::test]
  async fn rejects_a_compare_request_missing_an_image() {
    let bmp = sample_bmp(Rgba([20, 40, 60, 255]));
    let multipart = multipart("ui-judge-boundary", &[("referenceImage", bmp.as_slice())]).await;
    let error = compare(multipart)
      .await
      .expect_err("both image uploads are required");

    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    assert!(error.message.contains("renderedImage"));
  }

  #[tokio::test]
  async fn rejects_an_invalid_rendered_image_upload() {
    let bmp = sample_bmp(Rgba([20, 40, 60, 255]));
    let multipart = multipart(
      "ui-judge-boundary",
      &[
        ("referenceImage", bmp.as_slice()),
        ("renderedImage", b"not an image"),
      ],
    )
    .await;
    let error = compare(multipart)
      .await
      .expect_err("malformed image upload must fail");

    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    assert!(error.message.contains("Rendered image"));
  }

  #[tokio::test]
  async fn template_screenshot_rejects_direct_file_page_access() {
    let headless = Arc::new(
      CaptureWorkers::with_worker_main(0, |_jobs| unreachable!())
        .expect("create an idle headless pool"),
    );
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    for url in [
      "file:///tmp/private.lynx.bundle",
      "FILE:///tmp/private.lynx.bundle",
    ] {
      let mut request = http_request(url);
      request.timeout_ms = Some(1);
      let error = screenshot_template(State(state.clone()), Json(request))
        .await
        .expect_err("the server must reject direct file access");
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }
    headless.shutdown().expect("stop mock headless worker");
  }

  #[tokio::test]
  async fn remote_template_screenshot_uses_screenshot_ssrf_protection() {
    let headless = scripted_workers(|_| panic!("blocked URLs must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    for url in [
      "http://127.0.0.1/private.lynx.js",
      "HTTP://127.0.0.1/private.lynx.js",
      "http://[::1]/private.lynx.js",
    ] {
      let error = screenshot_template(State(state.clone()), Json(http_request(url)))
        .await
        .expect_err("the SSRF-safe downloader must reject private hosts");
      assert_eq!(error.status, StatusCode::FORBIDDEN);
      assert!(error.message.contains("non-public network address"));
    }
    headless.shutdown().expect("stop unused headless worker");
  }

  #[tokio::test]
  async fn worker_panic_releases_queued_requests_and_triggers_shutdown() {
    let received_first = Arc::new(Barrier::new(2));
    let release_panic = Arc::new(Barrier::new(2));
    let worker_received_first = Arc::clone(&received_first);
    let worker_release_panic = Arc::clone(&release_panic);
    let headless = Arc::new(
      CaptureWorkers::with_worker_main(1, move |jobs: Arc<Mutex<Receiver<CaptureJob>>>| {
        let _job = jobs
          .lock()
          .unwrap_or_else(|poisoned| poisoned.into_inner())
          .recv()
          .expect("receive capture job");
        worker_received_first.wait();
        worker_release_panic.wait();
        panic!("intentional headless worker panic");
      })
      .expect("start a panicking headless worker"),
    );
    let worker_failure = headless
      .take_failure_receiver()
      .expect("take the worker failure receiver");
    let (shutdown_sender, mut shutdown_receiver) = watch::channel(false);
    let failure_task = tokio::spawn(trigger_shutdown_on_worker_failure(
      worker_failure,
      shutdown_sender,
    ));
    let first_request = http_request("file:///tmp/panic.lynx.bundle")
      .into_capture_request()
      .expect("valid panic request");
    let first_response = headless
      .submit(first_request.request, first_request.load_options)
      .await
      .expect("submit the active request");
    received_first.wait();
    let queued_request = http_request("file:///tmp/queued.lynx.bundle")
      .into_capture_request()
      .expect("valid queued request");
    let queued_response = headless
      .submit(queued_request.request, queued_request.load_options)
      .await
      .expect("submit a request behind the active capture");
    release_panic.wait();

    let first_error = match first_response.await {
      Ok(_) => panic!("worker panic must fail the capture"),
      Err(_) => CaptureError::Stopped,
    };
    let queued_error = match queued_response.await {
      Ok(_) => panic!("worker panic must release queued captures"),
      Err(_) => CaptureError::Stopped,
    };
    shutdown_receiver
      .changed()
      .await
      .expect("worker panic must trigger shutdown");
    failure_task.await.expect("join worker failure monitor");

    assert!(matches!(first_error, CaptureError::Stopped));
    assert!(matches!(queued_error, CaptureError::Stopped));
    assert_eq!(
      ApiError::from(first_error).status,
      StatusCode::SERVICE_UNAVAILABLE
    );
    let late_request = http_request("file:///tmp/late.lynx.bundle")
      .into_capture_request()
      .expect("valid late request");
    assert!(matches!(
      headless
        .submit(late_request.request, late_request.load_options)
        .await,
      Err(CaptureError::ShuttingDown)
    ));
    assert!(*shutdown_receiver.borrow());
    assert!(!headless.is_healthy());
    let health_error = health(State(AppState {
      headless: Arc::clone(&headless),
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    }))
    .await
    .expect_err("unhealthy worker must fail readiness");
    assert_eq!(health_error.status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(headless.shutdown().is_err());
  }
}
