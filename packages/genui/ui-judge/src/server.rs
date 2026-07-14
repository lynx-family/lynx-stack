// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::io;
use std::net::{Ipv4Addr, Ipv6Addr, SocketAddr};
use std::num::ParseIntError;
use std::sync::mpsc::{self, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex};
use std::thread::{self, JoinHandle};
use std::time::Duration;

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
  capture_prepared_page, prepare_judge_page_request, score_captured_page, CapturedPage,
};
use crate::model::ModelClient;
use crate::{JudgePageRequest, UiJudgeError, UiJudgeResult};

const DEFAULT_SCREENSHOT_SETTLE_MS: u64 = 16;
const DEFAULT_TIMEOUT_MS: u64 = 60_000;
const MAX_QUEUED_CAPTURES: usize = 8;
const MAX_REQUEST_BYTES: usize = 16 * 1024 * 1024;
const TCP_BACKLOG: i32 = 1_024;

#[derive(Debug, Error)]
pub enum ServerError {
  #[error("PORT must be an integer from 0 through 65535, got {port:?}: {source}")]
  InvalidPort { port: String, source: ParseIntError },
  #[error("UI Judge server I/O failed: {0}")]
  Io(#[from] io::Error),
}

#[derive(Clone)]
struct AppState {
  headless: Arc<HeadlessExecutor>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HttpJudgePageRequest {
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

impl HttpJudgePageRequest {
  fn into_judge_request(self) -> Result<JudgePageRequest, ApiError> {
    let timeout_ms = self.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS);
    if timeout_ms == 0 {
      return Err(ApiError::new(
        StatusCode::BAD_REQUEST,
        "timeoutMs must be greater than zero.",
      ));
    }
    Ok(JudgePageRequest {
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
    })
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
  request: JudgePageRequest,
  response: oneshot::Sender<CaptureResponse>,
}

struct CaptureResponse {
  capture: Result<CapturedPage, UiJudgeResult>,
  client: ModelClient,
  request: JudgePageRequest,
}

struct HeadlessExecutor {
  sender: Option<SyncSender<CaptureJob>>,
  worker: Mutex<Option<JoinHandle<()>>>,
}

impl HeadlessExecutor {
  fn new() -> io::Result<Self> {
    let runtime = tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .build()?;
    let (sender, receiver) = mpsc::sync_channel(MAX_QUEUED_CAPTURES);
    let worker = thread::Builder::new()
      .name("ui-judge-headless".to_string())
      .spawn(move || run_headless_worker(runtime, receiver))?;
    Ok(Self {
      sender: Some(sender),
      worker: Mutex::new(Some(worker)),
    })
  }

  async fn capture(
    &self,
    request: JudgePageRequest,
    client: ModelClient,
  ) -> Result<CaptureResponse, ApiError> {
    let (response, response_receiver) = oneshot::channel();
    let job = CaptureJob {
      client,
      request,
      response,
    };
    match self
      .sender
      .as_ref()
      .expect("headless sender exists until executor drop")
      .try_send(job)
    {
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
}

impl Drop for HeadlessExecutor {
  fn drop(&mut self) {
    // Closing the only sender lets the worker drain accepted jobs and exit.
    drop(self.sender.take());
    let worker = self
      .worker
      .get_mut()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take();
    if let Some(worker) = worker {
      let _ = worker.join();
    }
  }
}

fn run_headless_worker(runtime: Runtime, receiver: Receiver<CaptureJob>) {
  while let Ok(job) = receiver.recv() {
    if job.response.is_closed() {
      continue;
    }
    let capture = runtime.block_on(capture_prepared_page(&job.client, &job.request));
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
  let port = port
    .parse::<u16>()
    .map_err(|source| ServerError::InvalidPort {
      port: port.to_string(),
      source,
    })?;
  let (ipv4_listener, ipv6_listener) = bind_listeners(port)?;
  let state = AppState {
    headless: Arc::new(HeadlessExecutor::new()?),
  };
  let app = Router::new()
    .route("/health", get(health))
    .route("/judge", post(judge))
    .layer(DefaultBodyLimit::max(MAX_REQUEST_BYTES))
    .with_state(state);
  let (shutdown_sender, shutdown_receiver) = watch::channel(false);
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
  result?;
  Ok(())
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

async fn health() -> Json<Value> {
  Json(json!({ "status": "ok" }))
}

async fn judge(
  State(state): State<AppState>,
  Json(request): Json<HttpJudgePageRequest>,
) -> Result<Json<UiJudgeResult>, ApiError> {
  let request = request.into_judge_request()?;
  let (request, client) = match prepare_judge_page_request(request) {
    Ok(prepared) => prepared,
    Err(result) => return Ok(Json(*result)),
  };
  let CaptureResponse {
    capture,
    client,
    request,
  } = state.headless.capture(request, client).await?;
  let result = match capture {
    Ok(capture) => score_captured_page(&client, &request, capture).await,
    Err(result) => result,
  };
  Ok(Json(result))
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
  use super::*;

  fn http_request(url: &str) -> HttpJudgePageRequest {
    HttpJudgePageRequest {
      reference: None,
      reference_image: None,
      screenshot_settle_ms: None,
      steps: vec![],
      task: "Render the page".to_string(),
      timeout_ms: None,
      url: url.to_string(),
    }
  }

  #[test]
  fn request_defaults_match_the_library_contract() {
    let request = http_request("file:///tmp/main.lynx.bundle")
      .into_judge_request()
      .expect("valid HTTP request");

    assert_eq!(request.screenshot_settle, Duration::from_millis(16));
    assert_eq!(request.timeout, Duration::from_secs(60));
  }

  #[test]
  fn rejects_a_zero_request_timeout() {
    let mut request = http_request("file:///tmp/main.lynx.bundle");
    request.timeout_ms = Some(0);
    let error = request
      .into_judge_request()
      .expect_err("zero timeout must fail");

    assert_eq!(error.status, StatusCode::BAD_REQUEST);
  }

  #[tokio::test]
  async fn handles_independent_http_requests_concurrently() {
    let state = AppState {
      headless: Arc::new(HeadlessExecutor::new().expect("start headless worker")),
    };
    let first = judge(
      State(state.clone()),
      Json(http_request("first-invalid-url")),
    );
    let second = judge(State(state), Json(http_request("second-invalid-url")));
    let (first, second) = tokio::join!(first, second);

    assert_eq!(first.expect("first response").0.url, "first-invalid-url");
    assert_eq!(second.expect("second response").0.url, "second-invalid-url");
  }
}
