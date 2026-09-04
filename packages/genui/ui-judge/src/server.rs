// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::future::Future;
use std::io;
use std::io::{Read, Write};
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use std::num::{NonZeroU16, ParseIntError};
use std::path::{Component, Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use axum::body;
use axum::extract::multipart::{Field, Multipart, MultipartError};
use axum::extract::{DefaultBodyLimit, Query, Request, State};
use axum::http::{
  header::{CACHE_CONTROL, CONTENT_LENGTH, CONTENT_TYPE},
  HeaderMap, StatusCode,
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

use crate::capture::{
  shared_workers, CaptureError, CaptureResponse, CaptureWorkers, WorkerPanicked,
};
use crate::headless::{prepare_judge_page_request, score_captured_page, PageLoadOptions};
use crate::model::{configured_model_name, ModelClient};
use crate::ssrf::{fetch_http_resource, HttpFetchError};
use crate::visual::{
  compare_uploaded_images, transcode_captured_bmp, ReferenceImageComparison, VisualEvaluationError,
  MAX_IMAGE_BYTES,
};
use crate::{JudgePageRequest, UiJudgeError, UiJudgeResult};

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
const ISOLATED_CAPTURE_CONFIG_ARG: &str = "--ui-judge-isolated-capture-config";
const ZIP_CAPTURE_PROCESS_GRACE: Duration = Duration::from_secs(5);
const ZIP_CAPTURE_FATAL_EXIT_CODE: i32 = 75;
const MAX_CONCURRENT_ZIP_RENDERERS: usize = 4;
const ZIP_SCREENSHOT_SETTLE_MS: u64 = 500;
const ZIP_UPLOAD_TIMEOUT: Duration = Duration::from_secs(10);
static NEXT_ZIP_JOB_ID: AtomicU64 = AtomicU64::new(1);

type PrepareJudgePageRequest =
  fn(JudgePageRequest) -> Result<(JudgePageRequest, ModelClient), Box<UiJudgeResult>>;

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
  ) -> Result<Vec<u8>, ApiError> {
    let deadline = activity.deadline;
    let bmp = self
      .capture_with_options(
        activity,
        staging_guard,
        base_dir,
        url,
        viewport,
        job_id,
        IsolatedCaptureConfig::default(),
      )
      .await?;
    tokio::time::timeout_at(deadline, transcode_captured_bmp(bmp))
      .await
      .map_err(|_| zip_render_timeout_error())?
      .map_err(|_| isolated_zip_worker_error())
  }

  async fn capture_bmp<T: Send + 'static>(
    &self,
    activity: ZipCaptureProcessActivity,
    staging_guard: T,
    base_dir: PathBuf,
    url: String,
    viewport: ScreenshotViewport,
    job_id: u64,
    config: IsolatedCaptureConfig,
  ) -> Result<Vec<u8>, ApiError> {
    self
      .capture_with_options(
        activity,
        staging_guard,
        base_dir,
        url,
        viewport,
        job_id,
        config,
      )
      .await
  }

  async fn capture_with_options<T: Send + 'static>(
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
      let result = supervise_zip_capture_process(
        &base_dir,
        &url,
        viewport,
        config,
        &mut reply,
        deadline,
      )
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
  model_name: Arc<str>,
  prepare_request: PrepareJudgePageRequest,
  zip_capture_backend: ZipCaptureBackend,
  zip_capture_processes: ZipCaptureProcesses,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpJudgePageRequest {
  #[serde(default, alias = "global_props")]
  global_props: Option<Value>,
  #[serde(default, alias = "include_screenshot")]
  include_screenshot: bool,
  #[serde(default, alias = "initial_data")]
  initial_data: Option<Value>,
  #[serde(default, alias = "include_geqi")]
  include_geqi: bool,
  #[serde(default)]
  reference: Option<String>,
  #[serde(default, alias = "reference_image")]
  reference_image: Option<String>,
  #[serde(default, alias = "screenshot_settle_ms")]
  screenshot_settle_ms: Option<u64>,
  #[serde(default)]
  steps: Vec<String>,
  task: String,
  #[serde(default, alias = "timeout_ms")]
  timeout_ms: Option<u64>,
  url: String,
}

#[derive(Debug)]
struct HttpCaptureRequest {
  include_screenshot: bool,
  load_options: PageLoadOptions,
  request: JudgePageRequest,
}

#[derive(Deserialize)]
struct ScreenshotQuery {
  entry: String,
  #[serde(default)]
  height: Option<usize>,
  #[serde(default)]
  width: Option<usize>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct ScreenshotViewport {
  height: usize,
  width: usize,
}

impl ScreenshotQuery {
  fn viewport(&self) -> Result<ScreenshotViewport, ApiError> {
    ScreenshotViewport::new(
      self.width.unwrap_or(DEFAULT_SCREENSHOT_WIDTH),
      self.height.unwrap_or(DEFAULT_SCREENSHOT_HEIGHT),
    )
  }
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

  #[cfg(test)]
  fn task(self) -> &'static str {
    match self {
      Self::Lynxml => "Render the uploaded LynXML",
      Self::Template => "Render the remote template",
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
struct HttpJudgePageResponse {
  #[serde(flatten)]
  result: UiJudgeResult,
  #[serde(skip_serializing_if = "Option::is_none")]
  screenshot_data_url: Option<String>,
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

impl HttpJudgePageRequest {
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
      include_screenshot: self.include_screenshot,
      load_options: PageLoadOptions {
        base_dir: None,
        global_props_json,
        initial_data_json,
      },
      request: JudgePageRequest {
        include_geqi: self.include_geqi,
        reference: self.reference,
        reference_image: self.reference_image,
        screenshot_settle: Duration::from_millis(
          self
            .screenshot_settle_ms
            .unwrap_or(DEFAULT_SCREENSHOT_SETTLE_MS),
        ),
        steps: self.steps,
        task: self.task,
        timeout: Duration::from_millis(timeout_ms),
        url: self.url,
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
  error: UiJudgeError,
}

impl IntoResponse for ApiError {
  fn into_response(self) -> Response {
    (
      self.status,
      Json(ApiErrorBody {
        error: UiJudgeError {
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
  let config = args
    .next()
    .and_then(|value| value.into_string().ok())
    .ok_or(ServerError::IsolatedZipCapture)?;
  if args.next().is_some() {
    return Err(ServerError::IsolatedZipCapture);
  }
  serde_json::from_str(&config).map_err(|_| ServerError::IsolatedZipCapture)
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
/// addresses. Ordinary native capture runs on one container-owning worker
/// behind a bounded queue; untrusted uploads use one fresh child process each.
/// Completed captures are scored concurrently on the async runtime.
pub async fn serve(port: &str) -> Result<(), ServerError> {
  let port = parse_port(port)?;
  let (ipv4_listener, ipv6_listener) = bind_listeners(port)?;
  let headless = shared_workers().map_err(ServerError::HeadlessWorkerUnavailable)?;
  let worker_failure = headless
    .take_failure_receiver()
    .map_err(|error| ServerError::HeadlessWorkerUnavailable(error.to_string()))?;
  let zip_capture_processes = ZipCaptureProcesses::new();
  let state = AppState {
    headless: Arc::clone(&headless),
    model_name: configured_model_name().into(),
    prepare_request: prepare_judge_page_request,
    zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
    zip_capture_processes: zip_capture_processes.clone(),
  };
  let app = Router::new()
    .route("/health", get(health))
    .route("/compare", post(compare))
    .route("/judge", post(judge))
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

  println!("UI Judge server listening on 0.0.0.0:{port} and [::]:{port}");
  let ipv4_server = axum::serve(ipv4_listener, app.clone())
    .with_graceful_shutdown(wait_for_shutdown(shutdown_receiver.clone()));
  let ipv6_server =
    axum::serve(ipv6_listener, app).with_graceful_shutdown(wait_for_shutdown(shutdown_receiver));
  let result = tokio::try_join!(ipv4_server, ipv6_server);

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

fn bind_listeners(port: u16) -> io::Result<(TcpListener, TcpListener)> {
  let ipv4 = bind_listener(
    Domain::IPV4,
    SocketAddr::from((Ipv4Addr::UNSPECIFIED, port)),
  )?;
  let ipv6 = Socket::new(Domain::IPV6, Type::STREAM, Some(Protocol::TCP))?;
  ipv6.set_only_v6(true)?;
  let ipv6 = configure_listener(ipv6, SocketAddr::from((Ipv6Addr::UNSPECIFIED, port)))?;
  Ok((ipv4, ipv6))
}

fn bind_listener(domain: Domain, address: SocketAddr) -> io::Result<TcpListener> {
  let socket = Socket::new(domain, Type::STREAM, Some(Protocol::TCP))?;
  configure_listener(socket, address)
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
      "model": state.model_name.as_ref(),
      "status": "ok"
    })))
  } else {
    Err(ApiError::new(
      StatusCode::SERVICE_UNAVAILABLE,
      "The UI Judge headless worker is unavailable.",
    ))
  }
}

async fn judge(
  State(state): State<AppState>,
  Json(request): Json<HttpJudgePageRequest>,
) -> Result<Json<HttpJudgePageResponse>, ApiError> {
  let HttpCaptureRequest {
    include_screenshot,
    load_options,
    request,
  } = request.into_capture_request()?;
  if is_http_page_url(&request.url) {
    return judge_remote_template(&state, include_screenshot, load_options, request).await;
  }
  reject_direct_page_url(&request.url)?;
  let (request, client) = match (state.prepare_request)(request) {
    Ok(prepared) => prepared,
    Err(result) => {
      return Ok(Json(HttpJudgePageResponse {
        result: *result,
        screenshot_data_url: None,
      }))
    }
  };
  let CaptureResponse {
    capture,
    client,
    request,
  } = state
    .headless
    .capture(request, Some(client), load_options)
    .await?;
  let client = client.expect("judge capture retains its model client");
  finish_judge(include_screenshot, request, client, capture).await
}

async fn finish_judge(
  include_screenshot: bool,
  request: JudgePageRequest,
  client: ModelClient,
  capture: Result<crate::headless::CapturedPage, UiJudgeResult>,
) -> Result<Json<HttpJudgePageResponse>, ApiError> {
  let (result, screenshot_data_url) = match capture {
    Ok(capture) => {
      let screenshot_data_url = if include_screenshot {
        Some(
          capture
            .screenshot_data_url()
            .await
            .map_err(|error| ApiError::new(StatusCode::INTERNAL_SERVER_ERROR, error))?,
        )
      } else {
        None
      };
      (
        score_captured_page(&client, &request, capture).await,
        screenshot_data_url,
      )
    }
    Err(result) => (result, None),
  };
  Ok(Json(HttpJudgePageResponse {
    result,
    screenshot_data_url,
  }))
}

async fn judge_remote_template(
  state: &AppState,
  include_screenshot: bool,
  load_options: PageLoadOptions,
  request: JudgePageRequest,
) -> Result<Json<HttpJudgePageResponse>, ApiError> {
  if !request.steps.is_empty() {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "HTTP(S) source judging does not support interaction steps.",
    ));
  }
  let source_url = request.url.trim();
  if source_url.len() > MAX_REMOTE_URL_BYTES {
    return Err(remote_url_too_large());
  }
  let source = fetch_remote_template(source_url).await?;
  let (request, client) = match (state.prepare_request)(request) {
    Ok(prepared) => prepared,
    Err(result) => {
      return Ok(Json(HttpJudgePageResponse {
        result: *result,
        screenshot_data_url: None,
      }))
    }
  };
  let capture = capture_staged_template_for_judge(state, source, &load_options, &request).await?;
  finish_judge(include_screenshot, request, client, Ok(capture)).await
}

fn is_http_page_url(url: &str) -> bool {
  let url = url.trim();
  ["http://", "https://"].iter().any(|scheme| {
    url
      .get(..scheme.len())
      .is_some_and(|prefix| prefix.eq_ignore_ascii_case(scheme))
  })
}

fn reject_direct_page_url(url: &str) -> Result<(), ApiError> {
  let url = url.trim();
  if url.starts_with("file://") {
    return Err(ApiError::new(
      StatusCode::FORBIDDEN,
      "Direct file:// page URLs are disabled by the UI Judge server; use a source-specific screenshot endpoint.",
    ));
  }
  Ok(())
}

async fn screenshot_lynxml(
  State(state): State<AppState>,
  Query(query): Query<ScreenshotQuery>,
  request: Request,
) -> Result<Response, ApiError> {
  let viewport = query.viewport()?;
  let entry = ScreenshotEntry::parse(&query.entry)?;
  if !entry.path.to_string_lossy().ends_with(".lynxml") {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "entry must identify a .lynxml file.",
    ));
  }
  validate_lynxml_upload_headers(request.headers())?;
  let source = read_lynxml_upload(
    body::to_bytes(request.into_body(), MAX_LYNXML_UPLOAD_BYTES),
    LYNXML_UPLOAD_TIMEOUT,
  )
  .await?;
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
    source.to_vec(),
    StagedSourceKind::Lynxml,
    viewport,
  )
  .await
}

async fn screenshot_template_url(
  State(state): State<AppState>,
  Query(query): Query<ScreenshotQuery>,
  request: Request,
) -> Result<Response, ApiError> {
  let viewport = query.viewport()?;
  let entry = ScreenshotEntry::parse(&query.entry)?;
  if !entry.path.to_string_lossy().ends_with(".js") {
    return Err(ApiError::new(
      StatusCode::BAD_REQUEST,
      "entry must identify a template.js file.",
    ));
  }
  let url = read_remote_url(request).await?;
  let source = fetch_remote_template(&url).await?;
  render_staged_source(
    &state,
    entry,
    source,
    StagedSourceKind::Template,
    viewport,
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
  Query(query): Query<ScreenshotQuery>,
  request: Request,
) -> Result<Response, ApiError> {
  let viewport = query.viewport()?;
  let entry = ScreenshotEntry::parse(&query.entry)?;
  validate_zip_upload_headers(request.headers())?;
  let upload = read_zip_upload(
    body::to_bytes(request.into_body(), zip::MAX_ZIP_UPLOAD_BYTES),
    ZIP_UPLOAD_TIMEOUT,
  )
  .await?;
  render_zip(&state, entry, upload.to_vec(), viewport).await
}

async fn screenshot_zip_url(
  State(state): State<AppState>,
  Query(query): Query<ScreenshotQuery>,
  request: Request,
) -> Result<Response, ApiError> {
  let viewport = query.viewport()?;
  let entry = ScreenshotEntry::parse(&query.entry)?;
  let url = read_remote_url(request).await?;
  let resource = fetch_http_resource(&url, zip::MAX_ZIP_UPLOAD_BYTES, REMOTE_FETCH_TIMEOUT)
    .await
    .map_err(remote_fetch_api_error)?;
  render_zip(&state, entry, resource.bytes, viewport).await
}

async fn render_zip(
  state: &AppState,
  entry: ScreenshotEntry,
  upload: Vec<u8>,
  viewport: ScreenshotViewport,
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

  let jpeg = match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let activity = zip_process_activity
        .expect("isolated ZIP capture must acquire render capacity before extraction");
      match state
        .zip_capture_processes
        .capture(activity, extracted, base_dir, entry.url, viewport, job_id)
        .await
      {
        Ok(jpeg) => jpeg,
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
          staged_screenshot_request(&entry.url, "Render the uploaded ZIP"),
          PageLoadOptions {
            base_dir: Some(base_dir),
            ..PageLoadOptions::default()
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
      capture.into_jpeg().await.map_err(|_| {
        ApiError::new(
          StatusCode::INTERNAL_SERVER_ERROR,
          "The uploaded ZIP screenshot could not be encoded.",
        )
      })?
    }
  };
  Ok(
    (
      [(CONTENT_TYPE, "image/jpeg"), (CACHE_CONTROL, "no-store")],
      jpeg,
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
) -> Result<Response, ApiError> {
  let job_id = NEXT_ZIP_JOB_ID.fetch_add(1, Ordering::Relaxed);
  let zip_process_activity = match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let deadline = tokio::time::Instant::now()
        + Duration::from_millis(DEFAULT_TIMEOUT_MS)
        + ZIP_CAPTURE_PROCESS_GRACE;
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
  let jpeg = match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let activity = zip_process_activity
        .expect("isolated source capture must acquire render capacity before staging");
      state
        .zip_capture_processes
        .capture(activity, staged, base_dir, entry.url, viewport, job_id)
        .await
        .map_err(|error| staged_source_render_api_error(kind, error))?
    }
    #[cfg(test)]
    ZipCaptureBackend::SharedWorker => {
      let capture_response = state
        .headless
        .capture(
          staged_screenshot_request(&entry.url, kind.task()),
          None,
          PageLoadOptions {
            base_dir: Some(base_dir),
            ..PageLoadOptions::default()
          },
        )
        .await?;
      let capture = capture_response.capture.map_err(|_| {
        ApiError::new(
          StatusCode::UNPROCESSABLE_ENTITY,
          format!("The {} could not be rendered.", kind.label()),
        )
      })?;
      let jpeg = capture.into_jpeg().await.map_err(|_| {
        ApiError::new(
          StatusCode::INTERNAL_SERVER_ERROR,
          format!("The {} screenshot could not be encoded.", kind.label()),
        )
      })?;
      drop(staged);
      jpeg
    }
  };
  Ok(
    (
      [(CONTENT_TYPE, "image/jpeg"), (CACHE_CONTROL, "no-store")],
      jpeg,
    )
      .into_response(),
  )
}

async fn capture_staged_template_for_judge(
  state: &AppState,
  source: Vec<u8>,
  load_options: &PageLoadOptions,
  request: &JudgePageRequest,
) -> Result<crate::headless::CapturedPage, ApiError> {
  let kind = StagedSourceKind::Template;
  let entry = ScreenshotEntry::parse("template.js")
    .expect("the server-selected template entry is always safe");
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
      "The staged remote template directory is unavailable.",
    )
  })?;

  match state.zip_capture_backend {
    ZipCaptureBackend::IsolatedProcess => {
      let activity = zip_process_activity
        .expect("isolated template judging must acquire render capacity before staging");
      let config = IsolatedCaptureConfig {
        global_props_json: load_options.global_props_json.clone(),
        initial_data_json: load_options.initial_data_json.clone(),
        screenshot_settle_ms: u64::try_from(request.screenshot_settle.as_millis())
          .expect("HTTP screenshot settle originates from u64 milliseconds"),
        timeout_ms: u64::try_from(request.timeout.as_millis())
          .expect("HTTP timeout originates from u64 milliseconds"),
      };
      let viewport = ScreenshotViewport {
        width: DEFAULT_SCREENSHOT_WIDTH,
        height: DEFAULT_SCREENSHOT_HEIGHT,
      };
      let bmp = state
        .zip_capture_processes
        .capture_bmp(
          activity, staged, base_dir, entry.url, viewport, job_id, config,
        )
        .await
        .map_err(|error| staged_source_render_api_error(kind, error))?;
      Ok(crate::headless::CapturedPage::from_staged_bmp(
        bmp,
        request.url.clone(),
      ))
    }
    #[cfg(test)]
    ZipCaptureBackend::SharedWorker => {
      let mut capture_request = request.clone();
      capture_request.url = entry.url;
      let capture_response = state
        .headless
        .capture(
          capture_request,
          None,
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
          "The remote template could not be rendered.",
        )
      })?;
      drop(staged);
      Ok(capture.with_url(request.url.clone()))
    }
  }
}

#[cfg(test)]
fn staged_screenshot_request(url: &str, task: &str) -> JudgePageRequest {
  JudgePageRequest {
    include_geqi: false,
    reference: None,
    reference_image: None,
    screenshot_settle: Duration::from_millis(ZIP_SCREENSHOT_SETTLE_MS),
    steps: vec![],
    task: task.to_string(),
    timeout: Duration::from_millis(DEFAULT_TIMEOUT_MS),
    url: url.to_string(),
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

async fn read_remote_url(request: Request) -> Result<String, ApiError> {
  let media_type = request
    .headers()
    .get(CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.split(';').next())
    .map(str::trim);
  if !media_type.is_some_and(|value| value.eq_ignore_ascii_case("text/plain")) {
    return Err(ApiError::new(
      StatusCode::UNSUPPORTED_MEDIA_TYPE,
      "Content-Type must be text/plain.",
    ));
  }
  if let Some(length) = request.headers().get(CONTENT_LENGTH) {
    let length = length
      .to_str()
      .ok()
      .and_then(|value| value.parse::<u64>().ok())
      .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid Content-Length header."))?;
    if length > MAX_REMOTE_URL_BYTES as u64 {
      return Err(remote_url_too_large());
    }
  }
  let body = match tokio::time::timeout(
    REMOTE_FETCH_TIMEOUT,
    body::to_bytes(request.into_body(), MAX_REMOTE_URL_BYTES),
  )
  .await
  {
    Ok(Ok(body)) => body,
    Ok(Err(error)) => {
      let reached_limit = std::error::Error::source(&error)
        .is_some_and(|source| source.is::<http_body_util::LengthLimitError>());
      if reached_limit {
        return Err(remote_url_too_large());
      }
      return Err(ApiError::new(
        StatusCode::BAD_REQUEST,
        "The remote URL request body could not be read.",
      ));
    }
    Err(_) => {
      return Err(ApiError::new(
        StatusCode::REQUEST_TIMEOUT,
        "The remote URL request body timed out.",
      ))
    }
  };
  let url = std::str::from_utf8(&body)
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

async fn read_lynxml_upload<F>(read: F, timeout: Duration) -> Result<body::Bytes, ApiError>
where
  F: Future<Output = Result<body::Bytes, axum::Error>>,
{
  match tokio::time::timeout(timeout, read).await {
    Ok(Ok(source)) => Ok(source),
    Ok(Err(error)) => Err(lynxml_upload_body_error(error)),
    Err(_) => Err(ApiError::new(
      StatusCode::REQUEST_TIMEOUT,
      "The LynXML request body timed out.",
    )),
  }
}

fn validate_lynxml_upload_headers(headers: &HeaderMap) -> Result<(), ApiError> {
  let media_type = headers
    .get(CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.split(';').next())
    .map(str::trim);
  let is_lynxml = media_type.is_some_and(|value| {
    value.eq_ignore_ascii_case("application/xml")
      || value.eq_ignore_ascii_case("text/xml")
      || value.eq_ignore_ascii_case("text/plain")
  });
  if !is_lynxml {
    return Err(ApiError::new(
      StatusCode::UNSUPPORTED_MEDIA_TYPE,
      "Content-Type must be application/xml, text/xml, or text/plain.",
    ));
  }

  if let Some(length) = headers.get(CONTENT_LENGTH) {
    let length = length
      .to_str()
      .ok()
      .and_then(|value| value.parse::<u64>().ok())
      .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid Content-Length header."))?;
    if length > MAX_LYNXML_UPLOAD_BYTES as u64 {
      return Err(lynxml_upload_too_large());
    }
  }
  Ok(())
}

fn lynxml_upload_body_error(error: axum::Error) -> ApiError {
  let reached_limit = std::error::Error::source(&error)
    .is_some_and(|source| source.is::<http_body_util::LengthLimitError>());
  if reached_limit {
    lynxml_upload_too_large()
  } else {
    ApiError::new(
      StatusCode::BAD_REQUEST,
      "The LynXML request body could not be read.",
    )
  }
}

fn lynxml_upload_too_large() -> ApiError {
  ApiError::new(
    StatusCode::PAYLOAD_TOO_LARGE,
    format!("LynXML source exceeds the {MAX_LYNXML_UPLOAD_BYTES}-byte limit."),
  )
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

async fn read_zip_upload<F>(read: F, timeout: Duration) -> Result<body::Bytes, ApiError>
where
  F: Future<Output = Result<body::Bytes, axum::Error>>,
{
  match tokio::time::timeout(timeout, read).await {
    Ok(Ok(upload)) => Ok(upload),
    Ok(Err(error)) => Err(zip_upload_body_error(error)),
    Err(_) => Err(ApiError::new(
      StatusCode::REQUEST_TIMEOUT,
      "The ZIP request body timed out.",
    )),
  }
}

fn validate_zip_upload_headers(headers: &HeaderMap) -> Result<(), ApiError> {
  let is_zip = headers
    .get(CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.split(';').next())
    .is_some_and(|value| value.trim().eq_ignore_ascii_case("application/zip"));
  if !is_zip {
    return Err(ApiError::new(
      StatusCode::UNSUPPORTED_MEDIA_TYPE,
      "Content-Type must be application/zip.",
    ));
  }

  if let Some(length) = headers.get(CONTENT_LENGTH) {
    let length = length
      .to_str()
      .ok()
      .and_then(|value| value.parse::<u64>().ok())
      .ok_or_else(|| ApiError::new(StatusCode::BAD_REQUEST, "Invalid Content-Length header."))?;
    if length > zip::MAX_ZIP_UPLOAD_BYTES as u64 {
      return Err(zip_upload_too_large());
    }
  }
  Ok(())
}

fn zip_upload_body_error(error: axum::Error) -> ApiError {
  let reached_limit = std::error::Error::source(&error)
    .is_some_and(|source| source.is::<http_body_util::LengthLimitError>());
  if reached_limit {
    zip_upload_too_large()
  } else {
    ApiError::new(
      StatusCode::BAD_REQUEST,
      "The ZIP request body could not be read.",
    )
  }
}

fn zip_upload_too_large() -> ApiError {
  ApiError::new(
    StatusCode::PAYLOAD_TOO_LARGE,
    format!(
      "ZIP upload exceeds the {}-byte limit.",
      zip::MAX_ZIP_UPLOAD_BYTES
    ),
  )
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
  let config = serde_json::to_string(&config).map_err(|_| isolated_zip_worker_error())?;
  let executable = zip_capture_executable().map_err(|_| isolated_zip_worker_error())?;
  let mut command = Command::new(executable);
  command
    .arg(ISOLATED_CAPTURE_CONFIG_ARG)
    .arg(config)
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
  use crate::model::ModelOptions;

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

  fn http_request(url: &str) -> HttpJudgePageRequest {
    HttpJudgePageRequest {
      global_props: None,
      include_screenshot: false,
      initial_data: None,
      include_geqi: false,
      reference: None,
      reference_image: None,
      screenshot_settle_ms: None,
      steps: vec![],
      task: "Render the page".to_string(),
      timeout_ms: None,
      url: url.to_string(),
    }
  }

  fn test_client() -> ModelClient {
    ModelClient::new(ModelOptions {
      api_key: Some("ui-judge-test".to_string()),
      ..ModelOptions::default()
    })
    .expect("create test model client")
  }

  fn completed_result(url: String) -> UiJudgeResult {
    UiJudgeResult {
      alignment_score: None,
      diff_image_base64: None,
      different_blocks: None,
      dimensions: vec![],
      error: None,
      geqi_score: None,
      reference_image_error: None,
      visual_similarity: None,
      reason: None,
      reference: None,
      score: 5,
      steps: vec![],
      summary: None,
      total_blocks: None,
      url,
      warnings: vec![],
    }
  }

  fn prepare_test_request(
    request: JudgePageRequest,
  ) -> Result<(JudgePageRequest, ModelClient), Box<UiJudgeResult>> {
    Ok((request, test_client()))
  }

  fn prepare_request_must_not_run(
    _request: JudgePageRequest,
  ) -> Result<(JudgePageRequest, ModelClient), Box<UiJudgeResult>> {
    panic!("screenshot without steps must not initialize a model client")
  }

  fn sample_image(format: ImageFormat, color: Rgba<u8>) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(8, 8, color));
    let mut bytes = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut bytes), format)
      .expect("encode the sample image");
    bytes
  }

  fn sample_png(color: Rgba<u8>) -> Vec<u8> {
    sample_image(ImageFormat::Png, color)
  }

  fn sample_png_with_dimensions(width: u32, height: u32, color: Rgba<u8>) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(width, height, color));
    let mut bytes = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut bytes), ImageFormat::Png)
      .expect("encode the ZIP image");
    bytes
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

  fn zip_request(upload: Vec<u8>) -> Request<Body> {
    Request::builder()
      .header(CONTENT_TYPE, "application/zip")
      .body(Body::from(upload))
      .expect("build ZIP upload request")
  }

  fn lynxml_request(source: &[u8]) -> Request<Body> {
    Request::builder()
      .header(CONTENT_TYPE, "application/xml; charset=utf-8")
      .body(Body::from(source.to_vec()))
      .expect("build LynXML request")
  }

  fn screenshot_query(entry: &str) -> Query<ScreenshotQuery> {
    Query(ScreenshotQuery {
      entry: entry.to_string(),
      height: None,
      width: None,
    })
  }

  fn screenshot_query_with_viewport(
    entry: &str,
    width: usize,
    height: usize,
  ) -> Query<ScreenshotQuery> {
    Query(ScreenshotQuery {
      entry: entry.to_string(),
      height: Some(height),
      width: Some(width),
    })
  }

  fn remote_url_request(url: &str) -> Request<Body> {
    Request::builder()
      .header(CONTENT_TYPE, "text/plain; charset=utf-8")
      .body(Body::from(url.to_string()))
      .expect("build remote URL request")
  }

  async fn multipart(boundary: &str, fields: &[(&str, &[u8])]) -> Multipart {
    let mut body = Vec::new();
    for (name, bytes) in fields {
      body.extend_from_slice(format!("--{boundary}\r\n").as_bytes());
      body.extend_from_slice(
        format!("Content-Disposition: form-data; name=\"{name}\"; filename=\"{name}.png\"\r\n")
          .as_bytes(),
      );
      body.extend_from_slice(b"Content-Type: image/png\r\n\r\n");
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
    Multipart::from_request(request, &())
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
  fn isolated_capture_config_is_parsed_from_startup_arguments() {
    let expected = IsolatedCaptureConfig {
      global_props_json: Some(r#"{"messages":[]}"#.to_string()),
      initial_data_json: Some(r#"{"ready":true}"#.to_string()),
      screenshot_settle_ms: 25,
      timeout_ms: 2_000,
    };
    let encoded = serde_json::to_string(&expected).expect("encode isolated capture config");

    let actual = parse_isolated_capture_config_args([
      std::ffi::OsString::from(ISOLATED_CAPTURE_CONFIG_ARG),
      std::ffi::OsString::from(encoded),
    ])
    .expect("parse isolated capture startup arguments");

    assert_eq!(actual, expected);
  }

  #[test]
  fn remote_template_judge_preserves_page_options() {
    assert!(is_http_page_url(" HTTPS://example.com/template.js "));

    let mut request = http_request(" https://example.com/template.js ");
    request.global_props = Some(json!({"messages": []}));
    request.initial_data = Some(json!({"ready": true}));
    let capture_request = request
      .into_capture_request()
      .expect("build a remote template judge request");

    assert_eq!(
      capture_request.request.url,
      " https://example.com/template.js "
    );
    assert_eq!(
      capture_request.load_options.global_props_json.as_deref(),
      Some(r#"{"messages":[]}"#)
    );
    assert_eq!(
      capture_request.load_options.initial_data_json.as_deref(),
      Some(r#"{"ready":true}"#)
    );
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

  #[test]
  fn screenshot_viewport_defaults_to_800_by_600() {
    let viewport = screenshot_query("index.lynxml")
      .0
      .viewport()
      .expect("default screenshot viewport");

    assert_eq!(
      viewport,
      ScreenshotViewport {
        width: 800,
        height: 600
      }
    );
  }

  #[test]
  fn screenshot_viewport_accepts_custom_dimensions() {
    let viewport = screenshot_query_with_viewport("index.lynxml", 375, 812)
      .0
      .viewport()
      .expect("custom screenshot viewport");

    assert_eq!(
      viewport,
      ScreenshotViewport {
        width: 375,
        height: 812
      }
    );
  }

  #[test]
  fn screenshot_viewport_rejects_unsafe_dimensions() {
    for (width, height) in [(0, 600), (800, 0), (8_193, 1), (2_000, 2_000)] {
      let error = ScreenshotViewport::new(width, height).expect_err("reject unsafe viewport");
      assert_eq!(error.status, StatusCode::BAD_REQUEST);
    }
  }

  #[tokio::test]
  async fn remote_url_body_requires_plain_text() {
    assert_eq!(
      read_remote_url(remote_url_request(" https://example.com/page.zip \n"))
        .await
        .unwrap(),
      "https://example.com/page.zip"
    );
    let request = Request::builder()
      .header(CONTENT_TYPE, "application/json")
      .body(Body::from(r#"{"url":"https://example.com/page.zip"}"#))
      .unwrap();
    let error = read_remote_url(request).await.unwrap_err();
    assert_eq!(error.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);
  }

  #[tokio::test]
  async fn remote_screenshot_endpoints_share_ssrf_protection() {
    let headless = scripted_workers(|_| panic!("blocked URLs must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let error = screenshot_zip_url(
      State(state.clone()),
      screenshot_query("index.lynxml"),
      remote_url_request("http://127.0.0.1/archive.zip"),
    )
    .await
    .expect_err("reject a private ZIP host");
    assert_eq!(error.status, StatusCode::FORBIDDEN);

    let error = screenshot_template_url(
      State(state),
      screenshot_query("template.js"),
      remote_url_request("http://[::1]/template.js"),
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
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let error = screenshot_template_url(
      State(state),
      screenshot_query("index.lynxml"),
      remote_url_request("https://example.com/template.js"),
    )
    .await
    .expect_err("reject a non-JavaScript template entry");
    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    headless.shutdown().expect("stop unused screenshot worker");
  }

  #[test]
  fn accepts_camel_case_page_data_as_json() {
    let request: HttpJudgePageRequest = serde_json::from_value(json!({
      "globalProps": {
        "instant": true,
        "messages": [{"beginRendering": {"surfaceId": "main"}}],
        "theme": "light"
      },
      "includeGeqi": true,
      "initialData": {
        "messages": [{"surfaceUpdate": {"surfaceId": "main"}}]
      },
      "task": "Render the A2UI page",
      "url": "file:///tmp/a2ui.lynx.bundle"
    }))
    .expect("deserialize HTTP request");
    let capture_request = request.into_capture_request().expect("valid HTTP request");

    assert!(capture_request.request.include_geqi);

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

  #[test]
  fn screenshot_capture_is_opt_in_and_supports_snake_case() {
    let default_request = http_request("file:///tmp/a2ui.lynx.bundle")
      .into_capture_request()
      .expect("valid default request");
    assert!(!default_request.include_screenshot);

    let request: HttpJudgePageRequest = serde_json::from_value(json!({
      "include_screenshot": true,
      "task": "Render the A2UI page",
      "url": "file:///tmp/a2ui.lynx.bundle"
    }))
    .expect("deserialize screenshot opt-in");
    let capture_request = request.into_capture_request().expect("valid request");
    assert!(capture_request.include_screenshot);
  }

  #[test]
  fn screenshot_response_flattens_the_existing_result_contract() {
    let response = HttpJudgePageResponse {
      result: completed_result("file:///tmp/a2ui.lynx.bundle".to_string()),
      screenshot_data_url: Some("data:image/png;base64,iVBORw0KGgo=".to_string()),
    };
    let value = serde_json::to_value(response).expect("serialize response");

    assert_eq!(value["score"], 5);
    assert_eq!(
      value["screenshotDataUrl"],
      "data:image/png;base64,iVBORw0KGgo="
    );
  }

  #[tokio::test]
  async fn lynxml_screenshot_stages_source_and_cleans_it_up() {
    let source: &'static [u8] = b"<!doctype lynx><lynx><script thread=\"main\"></script></lynx>";
    let staged_path = Arc::new(Mutex::new(None::<PathBuf>));
    let worker_staged_path = Arc::clone(&staged_path);
    let bmp = sample_image(ImageFormat::Bmp, Rgba([20, 40, 60, 255]));
    let headless = scripted_workers(move |job| {
      assert!(job.client.is_none());
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
        client: job.client,
        request: job.request,
      });
    });
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let response = screenshot_lynxml(
      State(state),
      screenshot_query("pages/index.lynxml"),
      lynxml_request(source),
    )
    .await
    .expect("render LynXML source");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[CONTENT_TYPE], "image/jpeg");
    assert_eq!(response.headers()[CACHE_CONTROL], "no-store");
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
  async fn remote_template_judge_stages_capture_options_and_cleans_up() {
    let source: &'static [u8] = b"globalThis.__uiJudgeTemplate = true;";
    let staged_path = Arc::new(Mutex::new(None::<PathBuf>));
    let worker_staged_path = Arc::clone(&staged_path);
    let bmp = sample_image(ImageFormat::Bmp, Rgba([20, 40, 60, 255]));
    let headless = scripted_workers(move |job| {
      assert!(job.client.is_none());
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
        client: job.client,
        request: job.request,
      });
    });
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_test_request,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };
    let mut http_request = http_request("https://example.com/template.js");
    http_request.global_props = Some(json!({"messages": []}));
    http_request.initial_data = Some(json!({"ready": true}));
    let capture_request = http_request
      .into_capture_request()
      .expect("build remote template request");

    let capture = capture_staged_template_for_judge(
      &state,
      source.to_vec(),
      &capture_request.load_options,
      &capture_request.request,
    )
    .await
    .expect("capture staged remote template");

    assert!(capture
      .screenshot_data_url()
      .await
      .expect("encode captured template")
      .starts_with("data:image/jpeg;base64,"));
    let staged_path = staged_path
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .clone()
      .expect("worker observed the staging directory");
    headless.shutdown().expect("stop template capture worker");
    assert!(!staged_path.exists());
  }

  #[tokio::test]
  async fn lynxml_screenshot_rejects_invalid_inputs_before_capture() {
    let headless = scripted_workers(|_| panic!("invalid LynXML must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let wrong_media_type = Request::builder()
      .header(CONTENT_TYPE, "application/json")
      .body(Body::from("{}"))
      .expect("build wrong-media-type request");
    let error = screenshot_lynxml(
      State(state.clone()),
      screenshot_query("index.lynxml"),
      wrong_media_type,
    )
    .await
    .expect_err("reject a non-XML media type");
    assert_eq!(error.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);

    let oversized = Request::builder()
      .header(CONTENT_TYPE, "text/plain")
      .header(CONTENT_LENGTH, MAX_LYNXML_UPLOAD_BYTES + 1)
      .body(Body::empty())
      .expect("build oversized request");
    let error = screenshot_lynxml(
      State(state.clone()),
      screenshot_query("index.lynxml"),
      oversized,
    )
    .await
    .expect_err("reject oversized LynXML before reading its body");
    assert_eq!(error.status, StatusCode::PAYLOAD_TOO_LARGE);

    let lying_length = Request::builder()
      .header(CONTENT_TYPE, "text/xml")
      .header(CONTENT_LENGTH, 1)
      .body(Body::from(vec![0; MAX_LYNXML_UPLOAD_BYTES + 1]))
      .expect("build oversized streaming LynXML request");
    let error = screenshot_lynxml(
      State(state.clone()),
      screenshot_query("index.lynxml"),
      lying_length,
    )
    .await
    .expect_err("enforce the LynXML body limit independently of Content-Length");
    assert_eq!(error.status, StatusCode::PAYLOAD_TOO_LARGE);

    let error = screenshot_lynxml(
      State(state.clone()),
      screenshot_query("index.lynxml"),
      lynxml_request(b""),
    )
    .await
    .expect_err("reject empty LynXML");
    assert_eq!(error.status, StatusCode::BAD_REQUEST);

    let error = screenshot_lynxml(
      State(state),
      screenshot_query("index.lynxml"),
      lynxml_request(&[0xff]),
    )
    .await
    .expect_err("reject non-UTF-8 LynXML");
    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    headless.shutdown().expect("stop unused LynXML worker");
  }

  #[tokio::test]
  async fn lynxml_upload_body_has_a_deadline() {
    let error = read_lynxml_upload(
      std::future::pending::<Result<body::Bytes, axum::Error>>(),
      Duration::from_millis(1),
    )
    .await
    .expect_err("reject a LynXML request body that never completes");

    assert_eq!(error.status, StatusCode::REQUEST_TIMEOUT);
  }

  #[tokio::test]
  async fn zip_screenshot_uses_the_requested_entrypoint_until_capture_finishes() {
    let index = b"<!doctype lynx><lynx><script thread=\"main\"></script></lynx>";
    let upload = zip_upload(&[("pages/index.lynxml", index)]);
    let staged_path = Arc::new(Mutex::new(None::<PathBuf>));
    let worker_staged_path = Arc::clone(&staged_path);
    let bmp = sample_image(ImageFormat::Bmp, Rgba([20, 40, 60, 255]));
    let headless = scripted_workers(move |job| {
      assert!(job.client.is_none());
      assert_eq!(job.request.url, "zip:///pages/index.lynxml");
      let base_dir = job
        .load_options
        .base_dir
        .as_ref()
        .expect("ZIP capture has an internal base directory");
      assert_eq!(
        std::fs::read(base_dir.join("pages/index.lynxml")).unwrap(),
        index
      );
      *worker_staged_path
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()) = Some(base_dir.clone());
      let _ = job.response.send(CaptureResponse {
        capture: Ok(CapturedPage::from_bmp(bmp.clone())),
        client: job.client,
        request: job.request,
      });
    });
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let response = screenshot_zip_upload(
      State(state),
      screenshot_query("zip:///pages/index.lynxml"),
      zip_request(upload),
    )
    .await
    .expect("render uploaded ZIP");

    assert_eq!(response.status(), StatusCode::OK);
    assert_eq!(response.headers()[CONTENT_TYPE], "image/jpeg");
    assert_eq!(response.headers()[CACHE_CONTROL], "no-store");
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

  #[tokio::test]
  async fn zip_screenshot_rejects_invalid_media_type_and_oversized_content_length() {
    let headless = scripted_workers(drop);
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };
    let wrong_media_type = Request::builder()
      .header(CONTENT_TYPE, "application/octet-stream")
      .body(Body::empty())
      .expect("build wrong-media-type request");
    let error = screenshot_zip_upload(
      State(state.clone()),
      screenshot_query("zip:///index.lynxml"),
      wrong_media_type,
    )
    .await
    .expect_err("reject a non-ZIP media type");
    assert_eq!(error.status, StatusCode::UNSUPPORTED_MEDIA_TYPE);

    let oversized = Request::builder()
      .header(CONTENT_TYPE, "application/zip")
      .header(CONTENT_LENGTH, zip::MAX_ZIP_UPLOAD_BYTES + 1)
      .body(Body::empty())
      .expect("build oversized request");
    let error = screenshot_zip_upload(
      State(state),
      screenshot_query("zip:///index.lynxml"),
      oversized,
    )
    .await
    .expect_err("reject an oversized ZIP before reading its body");
    assert_eq!(error.status, StatusCode::PAYLOAD_TOO_LARGE);
    headless.shutdown().expect("stop unused ZIP worker");
  }

  #[tokio::test]
  async fn zip_upload_body_has_a_deadline() {
    let error = read_zip_upload(
      std::future::pending::<Result<body::Bytes, axum::Error>>(),
      Duration::from_millis(1),
    )
    .await
    .expect_err("reject a request body that never completes");

    assert_eq!(error.status, StatusCode::REQUEST_TIMEOUT);
  }

  #[tokio::test]
  async fn zip_screenshot_enforces_the_stream_limit_and_safe_entry() {
    let headless = scripted_workers(|_| panic!("invalid ZIP uploads must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };
    let lying_length = Request::builder()
      .header(CONTENT_TYPE, "application/zip")
      .header(CONTENT_LENGTH, 1)
      .body(Body::from(vec![0; zip::MAX_ZIP_UPLOAD_BYTES + 1]))
      .expect("build oversized streaming request");
    let error = screenshot_zip_upload(
      State(state.clone()),
      screenshot_query("zip:///index.lynxml"),
      lying_length,
    )
    .await
    .expect_err("enforce the body limit independently of Content-Length");
    assert_eq!(error.status, StatusCode::PAYLOAD_TOO_LARGE);

    let upload = zip_upload(&[("page.lynxml", b"<lynx></lynx>")]);
    let error = screenshot_zip_upload(
      State(state),
      screenshot_query("../page.lynxml"),
      zip_request(upload),
    )
    .await
    .expect_err("require a safe staged entry");
    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    assert!(error.message.contains("safe relative file path"));
    headless.shutdown().expect("stop unused ZIP worker");
  }

  #[test]
  fn accepts_snake_case_page_data_aliases() {
    let request: HttpJudgePageRequest = serde_json::from_value(json!({
      "global_props": {"messages": []},
      "include_geqi": true,
      "initial_data": {"playbackMode": true},
      "task": "Render the A2UI page",
      "url": "file:///tmp/a2ui.lynx.bundle"
    }))
    .expect("deserialize aliased HTTP request");
    let capture_request = request.into_capture_request().expect("valid HTTP request");

    assert!(capture_request.request.include_geqi);

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
  async fn health_reports_ready_while_the_worker_is_available() {
    let headless = scripted_workers(drop);
    let response = health(State(AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_test_request,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    }))
    .await
    .expect("healthy worker must pass readiness");

    assert_eq!(
      response.0,
      json!({ "model": "judge-model", "status": "ok" })
    );
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
            .capture(capture.request, None, capture.load_options)
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
      let screenshot_data_url = runtime
        .block_on(capture.screenshot_data_url())
        .expect("transcode the screenshot");
      let jpeg = BASE64_STANDARD
        .decode(
          screenshot_data_url
            .strip_prefix("data:image/jpeg;base64,")
            .expect("screenshot data URL"),
        )
        .expect("decode screenshot data URL");
      let rgb = image::load_from_memory(&jpeg)
        .expect("decode a concurrent screenshot")
        .to_rgb8();
      assert_eq!(rgb.dimensions(), (800, 600));
    }

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
          model_name: "judge-model".into(),
          prepare_request: prepare_request_must_not_run,
          zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
          zip_capture_processes: ZipCaptureProcesses::new(),
        }),
        screenshot_query_with_viewport("index.lynxml", 375, 812),
        lynxml_request(lynxml),
      ))
      .expect("render raw LynXML source");
    let jpeg = runtime
      .block_on(axum::body::to_bytes(response.into_body(), MAX_IMAGE_BYTES))
      .expect("read LynXML screenshot response");
    let rgb = image::load_from_memory(&jpeg)
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
    let render_zip = |relative_color, absolute_color| {
      let relative_png = sample_png_with_dimensions(64, 64, Rgba(relative_color));
      let absolute_png = sample_png_with_dimensions(64, 64, Rgba(absolute_color));
      let upload = zip_upload(&[
        ("index.lynxml", index),
        ("images/relative.png", relative_png.as_slice()),
        ("images/absolute.png", absolute_png.as_slice()),
      ]);
      let response = runtime
        .block_on(screenshot_zip_upload(
          State(AppState {
            headless: Arc::clone(&headless),
            model_name: "judge-model".into(),
            prepare_request: prepare_request_must_not_run,
            zip_capture_backend: ZipCaptureBackend::IsolatedProcess,
            zip_capture_processes: ZipCaptureProcesses::new(),
          }),
          screenshot_query("zip:///index.lynxml"),
          zip_request(upload),
        ))
        .expect("render ZIP image resources");
      assert_eq!(response.status(), StatusCode::OK);
      let jpeg = runtime
        .block_on(axum::body::to_bytes(response.into_body(), MAX_IMAGE_BYTES))
        .expect("read ZIP screenshot response");
      let rgb = image::load_from_memory(&jpeg)
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

    let first = render_zip([255, 0, 0, 255], [0, 0, 255, 255]);
    assert_split_colors(&first, [255, 0, 0], [0, 0, 255], "first upload");

    // Reuse the exact same archive paths with different bytes. Each untrusted
    // upload must run in a fresh process so Clay's process-wide image cache
    // cannot return pixels belonging to the previous request.
    let second = render_zip([0, 255, 0, 255], [255, 255, 0, 255]);
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
    let png = sample_png(Rgba([20, 40, 60, 255]));
    let multipart = multipart(
      "ui-judge-boundary",
      &[
        ("referenceImage", png.as_slice()),
        ("renderedImage", png.as_slice()),
      ],
    )
    .await;
    let response = compare(multipart).await.expect("compare uploaded images").0;

    assert_eq!(response.visual_similarity, 1.0);
    assert_eq!(response.different_blocks, 0);
    assert_eq!(response.total_blocks, 1);
    assert!(!response.diff_image_base64.is_empty());
  }

  #[tokio::test]
  async fn rejects_a_compare_request_missing_an_image() {
    let png = sample_png(Rgba([20, 40, 60, 255]));
    let multipart = multipart("ui-judge-boundary", &[("referenceImage", png.as_slice())]).await;
    let error = compare(multipart)
      .await
      .expect_err("both image uploads are required");

    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    assert!(error.message.contains("renderedImage"));
  }

  #[tokio::test]
  async fn rejects_an_invalid_rendered_image_upload() {
    let png = sample_png(Rgba([20, 40, 60, 255]));
    let multipart = multipart(
      "ui-judge-boundary",
      &[
        ("referenceImage", png.as_slice()),
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
  async fn judge_rejects_direct_file_page_access() {
    let headless = Arc::new(
      CaptureWorkers::with_worker_main(0, |_jobs| unreachable!())
        .expect("create an idle headless pool"),
    );
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    let mut request = http_request("file:///tmp/private.lynx.bundle");
    request.timeout_ms = Some(1);
    let error = judge(State(state.clone()), Json(request))
      .await
      .expect_err("the server must reject direct file access");
    assert_eq!(error.status, StatusCode::FORBIDDEN);
    assert!(error
      .message
      .contains("source-specific screenshot endpoint"));
    headless.shutdown().expect("stop mock headless worker");
  }

  #[tokio::test]
  async fn remote_template_judge_uses_screenshot_ssrf_protection() {
    let headless = scripted_workers(|_| panic!("blocked URLs must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };

    for url in [
      "http://127.0.0.1/private.lynx.js",
      "http://[::1]/private.lynx.js",
    ] {
      let error = judge(State(state.clone()), Json(http_request(url)))
        .await
        .expect_err("the SSRF-safe downloader must reject private hosts");
      assert_eq!(error.status, StatusCode::FORBIDDEN);
      assert!(error.message.contains("non-public network address"));
    }
    headless.shutdown().expect("stop unused headless worker");
  }

  #[tokio::test]
  async fn remote_template_judge_rejects_steps_before_fetching() {
    let headless = scripted_workers(|_| panic!("unsupported steps must not reach capture"));
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_request_must_not_run,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    };
    let mut request = http_request("https://example.com/template.js");
    request.steps = vec!["Tap Save".to_string()];

    let error = judge(State(state), Json(request))
      .await
      .expect_err("isolated template judging cannot execute model-driven steps");
    assert_eq!(error.status, StatusCode::BAD_REQUEST);
    assert!(error.message.contains("does not support interaction steps"));
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
      .submit(
        first_request.request,
        Some(test_client()),
        first_request.load_options,
      )
      .await
      .expect("submit the active request");
    received_first.wait();
    let queued_request = http_request("file:///tmp/queued.lynx.bundle")
      .into_capture_request()
      .expect("valid queued request");
    let queued_response = headless
      .submit(
        queued_request.request,
        Some(test_client()),
        queued_request.load_options,
      )
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
        .submit(
          late_request.request,
          Some(test_client()),
          late_request.load_options
        )
        .await,
      Err(CaptureError::ShuttingDown)
    ));
    assert!(*shutdown_receiver.borrow());
    assert!(!headless.is_healthy());
    let health_error = health(State(AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_test_request,
      zip_capture_backend: ZipCaptureBackend::SharedWorker,
      zip_capture_processes: ZipCaptureProcesses::new(),
    }))
    .await
    .expect_err("unhealthy worker must fail readiness");
    assert_eq!(health_error.status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(headless.shutdown().is_err());
  }
}
