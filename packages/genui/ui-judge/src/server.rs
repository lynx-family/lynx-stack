// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::io;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use std::num::{NonZeroU16, ParseIntError};
use std::panic::{catch_unwind, resume_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

use axum::extract::multipart::{Field, Multipart, MultipartError};
use axum::extract::{DefaultBodyLimit, State};
use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use socket2::{Domain, Protocol, SockAddr, Socket, Type};
use thiserror::Error;
use tokio::net::TcpListener;
use tokio::runtime::Runtime;
use tokio::sync::{oneshot, watch};

use crate::headless::{
  capture_prepared_page_with_options, prepare_judge_page_request, score_captured_page,
  CapturedPage, PageLoadOptions,
};
use crate::model::{configured_model_name, ModelClient};
use crate::visual::{
  compare_uploaded_images, ReferenceImageComparison, VisualEvaluationError, MAX_IMAGE_BYTES,
};
use crate::{JudgePageRequest, UiJudgeError, UiJudgeResult};

const DEFAULT_SCREENSHOT_SETTLE_MS: u64 = 16;
const DEFAULT_TIMEOUT_MS: u64 = 60_000;
const MAX_QUEUED_CAPTURES: usize = 8;
const MAX_REQUEST_BYTES: usize = MAX_IMAGE_BYTES * 2 + 64 * 1024;
const TCP_BACKLOG: i32 = 1_024;

type PrepareJudgePageRequest =
  fn(JudgePageRequest) -> Result<(JudgePageRequest, ModelClient), Box<UiJudgeResult>>;

#[derive(Debug, Error)]
pub enum ServerError {
  #[error("LYNX_USE_PORT must be an integer from 1 through 65535, got {port:?}: {source}")]
  InvalidPort { port: String, source: ParseIntError },
  #[error("UI Judge headless worker panicked")]
  HeadlessWorkerPanicked,
  #[error("UI Judge server I/O failed: {0}")]
  Io(#[from] io::Error),
}

#[derive(Clone)]
struct AppState {
  headless: Arc<HeadlessExecutor>,
  model_name: Arc<str>,
  prepare_request: PrepareJudgePageRequest,
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
        global_props_json,
        initial_data_json,
      },
      request: JudgePageRequest {
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

struct CaptureJob {
  client: ModelClient,
  load_options: PageLoadOptions,
  request: JudgePageRequest,
  response: oneshot::Sender<CaptureResponse>,
}

struct CaptureResponse {
  capture: Result<CapturedPage, UiJudgeResult>,
  client: ModelClient,
  request: JudgePageRequest,
}

struct HeadlessExecutor {
  failure_receiver: Mutex<Option<oneshot::Receiver<()>>>,
  healthy: Arc<AtomicBool>,
  sender: Mutex<Option<SyncSender<CaptureJob>>>,
  worker: Mutex<Option<JoinHandle<()>>>,
}

impl HeadlessExecutor {
  fn new() -> io::Result<Self> {
    Self::new_with_worker(run_headless_worker)
  }

  fn new_with_worker<F>(worker_main: F) -> io::Result<Self>
  where
    F: FnOnce(Runtime, Receiver<CaptureJob>) + Send + 'static,
  {
    let runtime = tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .build()?;
    let (sender, receiver) = mpsc::sync_channel(MAX_QUEUED_CAPTURES);
    let (failure_sender, failure_receiver) = oneshot::channel();
    let healthy = Arc::new(AtomicBool::new(true));
    let worker_healthy = Arc::clone(&healthy);
    let worker = thread::Builder::new()
      .name("ui-judge-headless".to_string())
      .spawn(move || {
        let result = catch_unwind(AssertUnwindSafe(move || worker_main(runtime, receiver)));
        if let Err(payload) = result {
          worker_healthy.store(false, Ordering::Release);
          let _ = failure_sender.send(());
          resume_unwind(payload);
        }
      })?;
    Ok(Self {
      failure_receiver: Mutex::new(Some(failure_receiver)),
      healthy,
      sender: Mutex::new(Some(sender)),
      worker: Mutex::new(Some(worker)),
    })
  }

  fn take_failure_receiver(&self) -> oneshot::Receiver<()> {
    self
      .failure_receiver
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take()
      .expect("headless worker failure receiver can only be taken once")
  }

  fn is_healthy(&self) -> bool {
    self.healthy.load(Ordering::Acquire)
  }

  #[allow(clippy::result_large_err)]
  async fn capture(
    &self,
    request: JudgePageRequest,
    client: ModelClient,
    load_options: PageLoadOptions,
  ) -> Result<CaptureResponse, ApiError> {
    let (response, response_receiver) = oneshot::channel();
    let job = CaptureJob {
      client,
      load_options,
      request,
      response,
    };
    let send_result = self
      .sender
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .as_ref()
      .map(|sender| sender.try_send(job));
    let Some(send_result) = send_result else {
      return Err(ApiError::new(
        StatusCode::SERVICE_UNAVAILABLE,
        "The UI Judge headless worker is shutting down.",
      ));
    };
    match send_result {
      Ok(()) => {}
      Err(TrySendError::Full(_)) => {
        return Err(ApiError::new(
          StatusCode::SERVICE_UNAVAILABLE,
          "The UI Judge capture queue is full; retry the request later.",
        ))
      }
      Err(TrySendError::Disconnected(_)) => {
        return Err(ApiError::new(
          StatusCode::SERVICE_UNAVAILABLE,
          "The UI Judge headless worker is unavailable.",
        ))
      }
    }
    response_receiver.await.map_err(|_| {
      ApiError::new(
        StatusCode::SERVICE_UNAVAILABLE,
        "The UI Judge headless worker stopped before returning a result.",
      )
    })
  }

  fn shutdown(&self) -> Result<(), ServerError> {
    let sender = self
      .sender
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take();
    // Closing the only sender lets the worker drain accepted jobs and exit.
    drop(sender);
    let worker = self
      .worker
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take();
    if let Some(worker) = worker {
      worker
        .join()
        .map_err(|_| ServerError::HeadlessWorkerPanicked)?;
    }
    Ok(())
  }
}

impl Drop for HeadlessExecutor {
  fn drop(&mut self) {
    let _ = self.shutdown();
  }
}

fn run_headless_worker(runtime: Runtime, receiver: Receiver<CaptureJob>) {
  while let Ok(job) = receiver.recv() {
    if job.response.is_closed() {
      continue;
    }
    let capture = runtime.block_on(capture_prepared_page_with_options(
      &job.client,
      &job.request,
      &job.load_options,
    ));
    let _ = job.response.send(CaptureResponse {
      capture,
      client: job.client,
      request: job.request,
    });
  }
}

/// Runs the feature-gated UI Judge HTTP server on IPv4 and IPv6 unspecified
/// addresses. Native Lynx capture remains on one dedicated thread, while
/// completed captures are scored concurrently by the Tokio and Rayon pools.
pub async fn serve(port: &str) -> Result<(), ServerError> {
  let port = parse_port(port)?;
  let (ipv4_listener, ipv6_listener) = bind_listeners(port)?;
  let headless = Arc::new(HeadlessExecutor::new()?);
  let worker_failure = headless.take_failure_receiver();
  let state = AppState {
    headless: Arc::clone(&headless),
    model_name: configured_model_name().into(),
    prepare_request: prepare_judge_page_request,
  };
  let app = Router::new()
    .route("/health", get(health))
    .route("/compare", post(compare))
    .route("/judge", post(judge))
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
    .capture(request, client, load_options)
    .await?;
  let (result, screenshot_data_url) = match capture {
    Ok(capture) => {
      let screenshot_data_url = include_screenshot.then(|| capture.screenshot_data_url());
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
  use std::io::Cursor;

  use axum::body::Body;
  use axum::extract::FromRequest;
  use axum::http::header::CONTENT_TYPE;
  use axum::http::Request;
  use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};

  use super::*;
  use crate::model::ModelOptions;

  fn http_request(url: &str) -> HttpJudgePageRequest {
    HttpJudgePageRequest {
      global_props: None,
      include_screenshot: false,
      initial_data: None,
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
      error: None,
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

  fn sample_png(color: Rgba<u8>) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(8, 8, color));
    let mut png = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut png), ImageFormat::Png)
      .expect("encode sample PNG");
    png
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
  fn accepts_camel_case_page_data_as_json() {
    let request: HttpJudgePageRequest = serde_json::from_value(json!({
      "globalProps": {
        "instant": true,
        "messages": [{"beginRendering": {"surfaceId": "main"}}],
        "theme": "light"
      },
      "initialData": {
        "messages": [{"surfaceUpdate": {"surfaceId": "main"}}]
      },
      "task": "Render the A2UI page",
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

  #[test]
  fn accepts_snake_case_page_data_aliases() {
    let request: HttpJudgePageRequest = serde_json::from_value(json!({
      "global_props": {"messages": []},
      "initial_data": {"playbackMode": true},
      "task": "Render the A2UI page",
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
  async fn health_reports_ready_while_the_worker_is_available() {
    let headless = Arc::new(
      HeadlessExecutor::new_with_worker(|_runtime, receiver| while receiver.recv().is_ok() {})
        .expect("start deterministic headless worker"),
    );
    let response = health(State(AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_test_request,
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
  async fn handles_independent_http_requests_concurrently() {
    let executed_requests = Arc::new(Mutex::new(Vec::new()));
    let worker_requests = Arc::clone(&executed_requests);
    let headless = Arc::new(
      HeadlessExecutor::new_with_worker(move |_runtime, receiver| {
        while let Ok(job) = receiver.recv() {
          let url = job.request.url.clone();
          worker_requests
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .push((url.clone(), job.load_options.clone()));
          let _ = job.response.send(CaptureResponse {
            capture: Err(completed_result(url)),
            client: job.client,
            request: job.request,
          });
        }
      })
      .expect("start deterministic headless worker"),
    );
    let state = AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_test_request,
    };
    let mut first_request = http_request("file:///tmp/first.lynx.bundle");
    first_request.global_props = Some(json!({ "messages": [], "theme": "light" }));
    let first = judge(State(state.clone()), Json(first_request));
    let second = judge(
      State(state),
      Json(http_request("file:///tmp/second.lynx.bundle")),
    );
    let (first, second) = tokio::join!(first, second);
    let first_result = first.expect("first response").0;
    let second_result = second.expect("second response").0;

    assert_eq!(first_result.result.url, "file:///tmp/first.lynx.bundle");
    assert_eq!(second_result.result.url, "file:///tmp/second.lynx.bundle");
    assert_eq!(
      *executed_requests
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()),
      vec![
        (
          "file:///tmp/first.lynx.bundle".to_string(),
          PageLoadOptions {
            global_props_json: Some(r#"{"messages":[],"theme":"light"}"#.to_string()),
            initial_data_json: None,
          },
        ),
        (
          "file:///tmp/second.lynx.bundle".to_string(),
          PageLoadOptions::default(),
        ),
      ]
    );
    headless.shutdown().expect("stop mock headless worker");
  }

  #[tokio::test]
  async fn worker_panic_marks_health_unavailable_and_triggers_shutdown() {
    let headless = Arc::new(
      HeadlessExecutor::new_with_worker(|_runtime, receiver| {
        let _job = receiver.recv().expect("receive capture job");
        panic!("intentional headless worker panic");
      })
      .expect("start panicking headless worker"),
    );
    let worker_failure = headless.take_failure_receiver();
    let (shutdown_sender, mut shutdown_receiver) = watch::channel(false);
    let failure_task = tokio::spawn(trigger_shutdown_on_worker_failure(
      worker_failure,
      shutdown_sender,
    ));
    let request = http_request("file:///tmp/panic.lynx.bundle")
      .into_capture_request()
      .expect("valid panic request");

    let error = match headless
      .capture(request.request, test_client(), request.load_options)
      .await
    {
      Ok(_) => panic!("worker panic must fail the capture"),
      Err(error) => error,
    };
    shutdown_receiver
      .changed()
      .await
      .expect("worker panic must trigger shutdown");
    failure_task.await.expect("join worker failure monitor");

    assert_eq!(error.status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(*shutdown_receiver.borrow());
    assert!(!headless.is_healthy());
    let health_error = health(State(AppState {
      headless: Arc::clone(&headless),
      model_name: "judge-model".into(),
      prepare_request: prepare_test_request,
    }))
    .await
    .expect_err("unhealthy worker must fail readiness");
    assert_eq!(health_error.status, StatusCode::SERVICE_UNAVAILABLE);
    assert!(matches!(
      headless.shutdown(),
      Err(ServerError::HeadlessWorkerPanicked)
    ));
  }
}
