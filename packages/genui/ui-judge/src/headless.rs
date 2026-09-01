// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use lynx_headless_rust_test_runner::{GotoOptions, LynxContainer, LynxPage, ScreenshotOptions};
use serde::Deserialize;
use serde_json::json;
use thiserror::Error;
use tokio::runtime::Runtime;

use crate::capture::{shared_workers, CaptureResponse};
use crate::judge::{
  calculate_geqi_score, error_result, geqi_error_result, judge_geqi_dimension, judge_screenshot,
  GeqiDimension, JudgeScreenshotRequest, UiJudgeDimensionResult, UiJudgeError, UiJudgeResult,
  GEQI_DIMENSIONS,
};
use crate::model::{ModelClient, ModelError, ModelOptions};
use crate::screenshot::{bmp_to_jpeg, jpeg_data_url};
use crate::visual::{compare_reference_image, transcode_captured_bmp};

const MAX_ACTIONS_PER_STEP: usize = 8;
const MAX_DOM_CHARS: usize = 40_000;
const MAX_WAIT_MS: u64 = 5_000;
const STEP_SYSTEM_PROMPT: &str = "You control a headless Lynx page. Return exactly one JSON action matching the schema. Use only selectors present in the supplied DOM.";

/// Inputs for loading, interacting with, capturing, and judging a Lynx page.
#[derive(Debug, Clone)]
pub struct JudgePageRequest {
  /// Whether to score all four weighted GEQI dimensions from the final screenshot.
  ///
  /// Visual correctness is always scored and remains the top-level `score`.
  /// Enabling this option adds four independent VLM evaluations and returns
  /// `dimensions` plus the weighted 0-100 `geqi_score`.
  pub include_geqi: bool,
  /// Optional textual target included in the VLM prompt.
  pub reference: Option<String>,
  /// Optional image used only by the independent deterministic comparison.
  ///
  /// Accepts base64, a base64 data URL, or an HTTP(S) URL. The image is never
  /// sent to the VLM.
  pub reference_image: Option<String>,
  /// Time to wait for the renderer to settle before the final screenshot.
  pub screenshot_settle: Duration,
  /// Natural-language interactions to perform in order before the final capture.
  pub steps: Vec<String>,
  /// The visual task that the VLM should evaluate against the final screenshot.
  pub task: String,
  /// Maximum duration for each independently timed operation.
  ///
  /// The connection, navigation, every individual natural-language step,
  /// final screenshot capture, visual-correctness scoring, every enabled GEQI
  /// dimension, and optional reference-image comparison each receive this full
  /// duration. This preserves the legacy UI Judge behavior and is not an
  /// overall deadline for the entire request.
  pub timeout: Duration,
  /// The `file://`, `http://`, or `https://` Lynx page URL to load.
  pub url: String,
}

#[derive(Debug, Error)]
enum HeadlessPageError {
  #[error("headless Lynx operation failed: {0}")]
  Runner(#[from] lynx_headless_rust_test_runner::Error),
  #[error("headless step model failed: {0}")]
  Model(#[from] ModelError),
  #[error("headless step model returned invalid JSON: {0}")]
  InvalidActionJson(#[from] serde_json::Error),
  #[error("headless step timed out after {timeout_ms} ms: {step}")]
  StepTimeout { step: String, timeout_ms: u128 },
  #[error("headless {operation} timed out after {timeout_ms} ms")]
  OperationTimeout {
    operation: &'static str,
    timeout_ms: u128,
  },
  #[error("headless screenshot could not be transcoded: {0}")]
  Screenshot(String),
  #[error("headless step is unsupported by the existing runner: {0}")]
  UnsupportedAction(String),
  #[error("headless step exceeded {MAX_ACTIONS_PER_STEP} model actions: {0}")]
  TooManyActions(String),
}

#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
enum PageActionKind {
  Done,
  Tap,
  Unsupported,
  Wait,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PageAction {
  action: PageActionKind,
  duration_ms: Option<u64>,
  reason: String,
  selector: Option<String>,
}

/// A captured frame plus the steps that produced it.
///
/// The frame is kept as the runner's lossless BMP: the deterministic reference
/// comparison comes from these exact pixels, and only the copies that leave the
/// process are transcoded to JPEG.
pub(crate) struct CapturedPage {
  screenshot: Vec<u8>,
  steps: Vec<String>,
  url: String,
}

impl CapturedPage {
  #[cfg(test)]
  pub(crate) fn from_bmp(screenshot: Vec<u8>) -> Self {
    Self {
      screenshot,
      steps: vec![],
      url: String::new(),
    }
  }

  pub(crate) async fn into_jpeg(self) -> Result<Vec<u8>, String> {
    transcode_captured_bmp(self.screenshot).await
  }

  pub(crate) async fn screenshot_data_url(&self) -> Result<String, String> {
    transcode_captured_bmp(self.screenshot.clone())
      .await
      .map(|jpeg| jpeg_data_url(&jpeg))
  }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct PageLoadOptions {
  pub(crate) base_dir: Option<PathBuf>,
  pub(crate) global_props_json: Option<String>,
  pub(crate) initial_data_json: Option<String>,
}

/// Captures the current software-renderer frame as the runner's BMP.
fn capture_page_screenshot(
  page: &mut LynxPage,
  settle: Duration,
) -> Result<Vec<u8>, HeadlessPageError> {
  Ok(page.screenshot(ScreenshotOptions { path: None, settle })?)
}

/// Runs legacy natural-language UI steps through Agent SDK and the runner's
/// selector-based tap API. The runner does not expose swipe, typing,
/// scrolling, or coordinate touch, so the model must report those as
/// unsupported rather than pretending they completed.
fn run_page_steps(
  client: &ModelClient,
  page: &mut LynxPage,
  steps: &[String],
  timeout: Duration,
) -> Result<Vec<String>, HeadlessPageError> {
  let steps = normalize_steps(steps);
  for step in &steps {
    run_page_step(client, page, step, timeout)?;
  }
  Ok(steps)
}

/// Loads a Lynx URL, executes requested steps, captures the final frame, and
/// scores it using the model configured through the environment.
pub async fn judge_page(request: JudgePageRequest) -> UiJudgeResult {
  let (request, client) = match prepare_judge_page_request(request) {
    Ok(prepared) => prepared,
    Err(result) => return *result,
  };
  let response = match submit_capture(request, Some(client), PageLoadOptions::default()).await {
    Ok(response) => response,
    Err(result) => return *result,
  };
  let client = response
    .client
    .expect("judge capture retains its model client");
  match response.capture {
    Ok(capture) => score_captured_page(&client, &response.request, capture).await,
    Err(result) => result,
  }
}

/// Hands one capture to the shared worker pool and waits for its reply.
pub(crate) async fn submit_capture(
  request: JudgePageRequest,
  client: Option<ModelClient>,
  load_options: PageLoadOptions,
) -> Result<CaptureResponse, Box<UiJudgeResult>> {
  let reporting_request = request.clone();
  let workers = match shared_workers() {
    Ok(workers) => workers,
    Err(error) => return Err(Box::new(page_request_error(&reporting_request, error))),
  };
  workers
    .capture(request, client, load_options)
    .await
    .map_err(|error| Box::new(page_request_error(&reporting_request, error.to_string())))
}

pub(crate) fn prepare_judge_page_request(
  request: JudgePageRequest,
) -> Result<(JudgePageRequest, ModelClient), Box<UiJudgeResult>> {
  let request = prepare_page_request(request)?;

  let model_options = ModelOptions::from_env();
  let client = match ModelClient::new(model_options) {
    Ok(client) => client,
    Err(error) => return Err(Box::new(page_request_error(&request, error.to_string()))),
  };
  Ok((request, client))
}

pub(crate) fn prepare_page_request(
  mut request: JudgePageRequest,
) -> Result<JudgePageRequest, Box<UiJudgeResult>> {
  request.url = request.url.trim().to_string();
  if request.url.is_empty() {
    return Err(Box::new(page_request_error(
      &request,
      "judge_page requires a non-empty URL.",
    )));
  }
  if !is_supported_page_url(&request.url) {
    return Err(Box::new(page_request_error(
      &request,
      "judge_page URL must use file://, http://, or https://.",
    )));
  }
  if request.task.trim().is_empty() {
    return Err(Box::new(page_request_error(
      &request,
      "judge_page requires a non-empty task.",
    )));
  }
  request.reference_image = request
    .reference_image
    .map(|reference_image| reference_image.trim().to_string());
  Ok(request)
}

/// Drives one capture on the worker thread that owns `container`.
///
/// A page is created, navigated, optionally stepped through, and captured
/// entirely inline: every wait pumps the container's native tasks instead of
/// yielding to an executor.
#[allow(clippy::result_large_err)]
pub(crate) fn capture_with_container(
  container: &LynxContainer,
  client: Option<&ModelClient>,
  request: &JudgePageRequest,
  load_options: &PageLoadOptions,
) -> Result<CapturedPage, UiJudgeResult> {
  let mut page = match container.new_page() {
    Ok(page) => page,
    Err(error) => return Err(page_request_error(request, error.to_string())),
  };
  // Navigation always takes the same path now; the DOM session is attached
  // lazily, so a screenshot-only request never pays for DevTools setup.
  if let Err(error) = page.goto(&request.url, goto_options(request.timeout, load_options)) {
    return Err(page_request_error(request, error.to_string()));
  }
  capture_loaded_page(client, &mut page, request)
}

fn goto_options(timeout: Duration, load_options: &PageLoadOptions) -> GotoOptions {
  GotoOptions {
    base_dir: load_options.base_dir.clone(),
    global_props_json: load_options.global_props_json.clone(),
    initial_data_json: load_options.initial_data_json.clone(),
    timeout: Some(timeout),
  }
}

#[allow(clippy::result_large_err)]
fn capture_loaded_page(
  client: Option<&ModelClient>,
  page: &mut LynxPage,
  request: &JudgePageRequest,
) -> Result<CapturedPage, UiJudgeResult> {
  let steps = match client {
    Some(client) => match run_page_steps(client, page, &request.steps, request.timeout) {
      Ok(steps) => steps,
      Err(error) => {
        let mut result = request_error_result(request, page.url().to_string(), error.to_string());
        result.steps = normalize_steps(&request.steps);
        return Err(result);
      }
    },
    None => vec![],
  };
  let screenshot = match capture_page_screenshot(page, request.screenshot_settle) {
    Ok(screenshot) => screenshot,
    Err(error) => {
      let mut result = request_error_result(request, page.url().to_string(), error.to_string());
      result.steps = steps;
      return Err(result);
    }
  };

  Ok(CapturedPage {
    screenshot,
    steps,
    url: page.url().to_string(),
  })
}

pub(crate) async fn score_captured_page(
  client: &ModelClient,
  request: &JudgePageRequest,
  capture: CapturedPage,
) -> UiJudgeResult {
  let CapturedPage {
    screenshot,
    steps,
    url,
  } = capture;
  // The model needs a format it can read; the comparison below keeps the
  // lossless capture.
  let screenshot_data_url = match transcode_captured_bmp(screenshot.clone()).await {
    Ok(jpeg) => jpeg_data_url(&jpeg),
    Err(error) => {
      let mut result = request_error_result(request, url, error);
      result.steps = steps;
      return result;
    }
  };
  let scoring_request = JudgeScreenshotRequest {
    reference: request.reference.clone(),
    screenshot_data_url,
    task: task_with_steps(&request.task, &steps),
    url: url.clone(),
  };
  let vlm_scoring = score_screenshot(
    client,
    &scoring_request,
    request.include_geqi,
    request.timeout,
  );
  let reference_comparison = async {
    match request.reference_image.as_deref() {
      Some(reference_image) => Some(
        tokio::time::timeout(
          request.timeout,
          compare_reference_image(reference_image, &screenshot),
        )
        .await,
      ),
      None => None,
    }
  };

  // The VLM and deterministic comparison are independent consumers of the
  // captured frame. Neither result is an input to the other evaluation chain.
  let (mut result, comparison_result) = tokio::join!(vlm_scoring, reference_comparison);
  if let Some(comparison_result) = comparison_result {
    match comparison_result {
      Ok(Ok(comparison)) => {
        result.alignment_score = comparison.alignment_score;
        result.diff_image_base64 = Some(comparison.diff_image_base64);
        result.different_blocks = Some(comparison.different_blocks);
        result.total_blocks = Some(comparison.total_blocks);
        result.visual_similarity = Some(comparison.similarity);
        result.warnings = comparison.warnings;
      }
      Ok(Err(error)) => {
        result.reference_image_error = Some(UiJudgeError {
          message: error.to_string(),
        });
      }
      Err(_) => {
        result.reference_image_error = Some(UiJudgeError {
          message: operation_timeout("reference image comparison", request.timeout).to_string(),
        });
      }
    }
  }
  result.steps = steps;
  result
}

async fn score_screenshot(
  client: &ModelClient,
  request: &JudgeScreenshotRequest,
  include_geqi: bool,
  timeout: Duration,
) -> UiJudgeResult {
  if !include_geqi {
    return match tokio::time::timeout(timeout, judge_screenshot(client, request)).await {
      Ok(result) => result,
      Err(_) => error_result(
        request.reference.clone(),
        request.url.clone(),
        operation_timeout("VLM scoring", timeout).to_string(),
      ),
    };
  }

  let (visual, usability, aesthetics, consistency, architecture) = tokio::join!(
    tokio::time::timeout(timeout, judge_screenshot(client, request)),
    score_geqi_dimension(client, request, GEQI_DIMENSIONS[0], timeout),
    score_geqi_dimension(client, request, GEQI_DIMENSIONS[1], timeout),
    score_geqi_dimension(client, request, GEQI_DIMENSIONS[2], timeout),
    score_geqi_dimension(client, request, GEQI_DIMENSIONS[3], timeout),
  );
  let mut result = match visual {
    Ok(result) => result,
    Err(_) => error_result(
      request.reference.clone(),
      request.url.clone(),
      operation_timeout("VLM scoring", timeout).to_string(),
    ),
  };
  result.dimensions = vec![usability, aesthetics, consistency, architecture];
  result.geqi_score = calculate_geqi_score(&result.dimensions);
  result
}

async fn score_geqi_dimension(
  client: &ModelClient,
  request: &JudgeScreenshotRequest,
  dimension: GeqiDimension,
  timeout: Duration,
) -> UiJudgeDimensionResult {
  match tokio::time::timeout(timeout, judge_geqi_dimension(client, request, dimension)).await {
    Ok(result) => result,
    Err(_) => geqi_error_result(
      dimension,
      format!(
        "headless {} scoring timed out after {} ms",
        dimension.id(),
        timeout.as_millis()
      ),
    ),
  }
}

fn is_supported_page_url(url: &str) -> bool {
  ["file://", "http://", "https://"].iter().any(|prefix| {
    url
      .strip_prefix(prefix)
      .is_some_and(|rest| !rest.is_empty())
  })
}

pub(crate) fn page_request_error(
  request: &JudgePageRequest,
  message: impl Into<String>,
) -> UiJudgeResult {
  let mut result = request_error_result(request, request.url.clone(), message);
  result.steps = normalize_steps(&request.steps);
  result
}

fn request_error_result(
  request: &JudgePageRequest,
  url: String,
  message: impl Into<String>,
) -> UiJudgeResult {
  let message = message.into();
  let mut result = error_result(request.reference.clone(), url, message.clone());
  if request.include_geqi {
    result.dimensions = GEQI_DIMENSIONS
      .iter()
      .copied()
      .map(|dimension| geqi_error_result(dimension, message.clone()))
      .collect();
    result.geqi_score = calculate_geqi_score(&result.dimensions);
  }
  result
}

/// Blocks on one model request from a capture worker thread.
///
/// The native side of a capture is synchronous, but the model client is an
/// async HTTP client. Each worker keeps one current-thread runtime and drives
/// the request on it; worker threads are plain OS threads, so this never runs
/// inside another runtime.
fn block_on_model<F: std::future::Future>(future: F) -> F::Output {
  thread_local! {
    static RUNTIME: Runtime = tokio::runtime::Builder::new_current_thread()
      .enable_all()
      .build()
      .expect("build the UI Judge model runtime");
  }
  RUNTIME.with(|runtime| runtime.block_on(future))
}

fn run_page_step(
  client: &ModelClient,
  page: &mut LynxPage,
  step: &str,
  timeout: Duration,
) -> Result<(), HeadlessPageError> {
  let deadline = Instant::now()
    .checked_add(timeout)
    .unwrap_or_else(Instant::now);
  let mut history = Vec::new();

  for _ in 0..MAX_ACTIONS_PER_STEP {
    if deadline.saturating_duration_since(Instant::now()).is_zero() {
      return Err(step_timeout(step, timeout));
    }
    let dom = page.content()?;
    let screenshot = capture_page_screenshot(page, Duration::from_millis(16))?;
    let jpeg = bmp_to_jpeg(&screenshot).map_err(HeadlessPageError::Screenshot)?;
    let prompt = build_step_prompt(step, &dom, &history);
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
      return Err(step_timeout(step, timeout));
    }
    let raw = block_on_model(tokio::time::timeout(
      remaining,
      client.evaluate_structured(
        STEP_SYSTEM_PROMPT,
        &prompt,
        &[&jpeg_data_url(&jpeg)],
        "lynx_page_action",
        page_action_schema(),
      ),
    ))
    .map_err(|_| step_timeout(step, timeout))??;
    let action: PageAction = serde_json::from_str(&raw)?;

    match action.action {
      PageActionKind::Done => return Ok(()),
      PageActionKind::Unsupported => {
        return Err(HeadlessPageError::UnsupportedAction(non_empty_reason(
          action.reason,
          step,
        )))
      }
      PageActionKind::Wait => {
        let duration_ms = action.duration_ms.unwrap_or(100).min(MAX_WAIT_MS);
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
          return Err(step_timeout(step, timeout));
        }
        let duration = Duration::from_millis(duration_ms).min(remaining);
        page.wait_for_timeout(duration);
        history.push(format!("waited {duration_ms} ms"));
      }
      PageActionKind::Tap => {
        let Some(selector) = action
          .selector
          .as_deref()
          .map(str::trim)
          .filter(|selector| !selector.is_empty())
        else {
          history.push("tap failed: selector was empty".to_string());
          continue;
        };
        if deadline.saturating_duration_since(Instant::now()).is_zero() {
          return Err(step_timeout(step, timeout));
        }
        let Some(element) = page.locator(selector)? else {
          history.push(format!(
            "tap failed: selector did not match a node: {selector}"
          ));
          continue;
        };
        element.tap()?;
        history.push(format!("tapped {selector}"));
      }
    }
  }

  Err(HeadlessPageError::TooManyActions(step.to_string()))
}

fn build_step_prompt(step: &str, dom: &str, history: &[String]) -> String {
  let dom = dom.chars().take(MAX_DOM_CHARS).collect::<String>();
  let history = if history.is_empty() {
    "none".to_string()
  } else {
    history.join("; ")
  };
  format!(
    r#"Complete this requested UI step on the current Lynx page:
{step}

Actions already taken for this step:
{history}

Current Lynx DOM:
{dom}

Choose exactly one next action:
- tap: set selector to a CSS selector that exists verbatim in the DOM. Prefer #id, then a unique .class, then a tag.
- wait: set durationMs between 0 and {MAX_WAIT_MS} when the UI needs time to settle.
- done: use only when the requested step is visibly complete.
- unsupported: use for swipe, scrolling, typing, coordinate touch, or any capability not exposed by the current runner.

Always provide reason. Set unused selector and durationMs fields to null."#
  )
}

fn page_action_schema() -> serde_json::Value {
  json!({
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "action": {
        "type": "string",
        "enum": ["tap", "wait", "done", "unsupported"]
      },
      "selector": { "type": ["string", "null"] },
      "durationMs": {
        "type": ["integer", "null"],
        "minimum": 0,
        "maximum": MAX_WAIT_MS
      },
      "reason": { "type": "string" }
    },
    "required": ["action", "selector", "durationMs", "reason"]
  })
}

fn normalize_steps(steps: &[String]) -> Vec<String> {
  steps
    .iter()
    .map(|step| step.trim())
    .filter(|step| !step.is_empty())
    .map(str::to_string)
    .collect()
}

fn task_with_steps(task: &str, steps: &[String]) -> String {
  if steps.is_empty() {
    return task.to_string();
  }
  let mut output = task.to_string();
  output.push_str("\n\nRequested interaction steps:");
  for (index, step) in steps.iter().enumerate() {
    output.push_str(&format!("\n{}. {step}", index + 1));
  }
  output
}

fn step_timeout(step: &str, timeout: Duration) -> HeadlessPageError {
  HeadlessPageError::StepTimeout {
    step: step.to_string(),
    timeout_ms: timeout.as_millis(),
  }
}

fn operation_timeout(operation: &'static str, timeout: Duration) -> HeadlessPageError {
  HeadlessPageError::OperationTimeout {
    operation,
    timeout_ms: timeout.as_millis(),
  }
}

fn non_empty_reason(reason: String, fallback: &str) -> String {
  let reason = reason.trim();
  if reason.is_empty() {
    fallback.to_string()
  } else {
    reason.to_string()
  }
}

#[cfg(test)]
mod tests {
  use std::io::Cursor;

  use base64::prelude::{Engine, BASE64_STANDARD};
  use image::{DynamicImage, ImageFormat, Rgba, RgbaImage};

  use super::*;

  /// A one-pixel capture in the format the runner produces.
  fn sample_bmp() -> Vec<u8> {
    encode(ImageFormat::Bmp)
  }

  /// The same pixel as a reference upload, which callers may supply as PNG.
  fn reference_data_url() -> String {
    format!(
      "data:image/png;base64,{}",
      BASE64_STANDARD.encode(encode(ImageFormat::Png))
    )
  }

  fn encode(format: ImageFormat) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(1, 1, Rgba([20, 40, 60, 255])));
    let mut bytes = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut bytes), format)
      .expect("encode the sample image");
    bytes
  }

  fn page_request(url: &str, task: &str) -> JudgePageRequest {
    JudgePageRequest {
      include_geqi: false,
      reference: None,
      reference_image: None,
      screenshot_settle: Duration::ZERO,
      steps: vec![" Tap Save ".to_string()],
      task: task.to_string(),
      timeout: Duration::from_secs(1),
      url: url.to_string(),
    }
  }

  #[test]
  fn normalizes_steps_and_appends_them_to_task() {
    let steps = normalize_steps(&[
      " Tap Save ".to_string(),
      String::new(),
      "Wait for success".to_string(),
    ]);
    assert_eq!(steps, ["Tap Save", "Wait for success"]);
    assert_eq!(
      task_with_steps("Save the form", &steps),
      "Save the form\n\nRequested interaction steps:\n1. Tap Save\n2. Wait for success"
    );
  }

  #[test]
  fn action_prompt_documents_runner_limits() {
    let prompt = build_step_prompt("Swipe left", "<view class=\"card\"></view>", &[]);
    assert!(prompt.contains("Swipe left"));
    assert!(prompt.contains(".class"));
    assert!(prompt.contains("swipe"));
    assert!(prompt.contains("unsupported"));
  }

  #[test]
  fn page_load_options_are_forwarded_to_runner_navigation() {
    let timeout = Duration::from_secs(9);
    let options = goto_options(
      timeout,
      &PageLoadOptions {
        base_dir: Some(PathBuf::from("/tmp/staged-page")),
        global_props_json: Some(r#"{"messages":[]}"#.to_string()),
        initial_data_json: Some(r#"{"theme":"light"}"#.to_string()),
      },
    );

    assert_eq!(options.timeout, Some(timeout));
    assert_eq!(
      options.base_dir.as_deref(),
      Some(std::path::Path::new("/tmp/staged-page"))
    );
    assert_eq!(
      options.global_props_json.as_deref(),
      Some(r#"{"messages":[]}"#)
    );
    assert_eq!(
      options.initial_data_json.as_deref(),
      Some(r#"{"theme":"light"}"#)
    );

    let defaults = goto_options(timeout, &PageLoadOptions::default());
    assert!(defaults.base_dir.is_none());
    assert!(defaults.global_props_json.is_none());
    assert!(defaults.initial_data_json.is_none());
  }

  #[tokio::test(flavor = "current_thread")]
  async fn judge_page_rejects_an_empty_url_before_initializing_runtime_dependencies() {
    let result = judge_page(page_request("  ", "Render the form")).await;

    assert_eq!(result.url, "");
    assert_eq!(result.steps, ["Tap Save"]);
    assert_eq!(
      result.error.expect("invalid request error").message,
      "judge_page requires a non-empty URL."
    );
  }

  #[tokio::test(flavor = "current_thread")]
  async fn geqi_request_errors_preserve_all_dimension_slots() {
    let mut request = page_request("  ", "Render the form");
    request.include_geqi = true;
    let result = judge_page(request).await;

    assert!(result.error.is_some());
    assert_eq!(result.geqi_score, Some(0.0));
    assert_eq!(result.dimensions.len(), GEQI_DIMENSIONS.len());
    assert!(result
      .dimensions
      .iter()
      .all(|dimension| dimension.error.is_some() && dimension.score == 0));
  }

  #[tokio::test(flavor = "current_thread")]
  async fn judge_page_rejects_an_empty_task_before_initializing_runtime_dependencies() {
    let result = judge_page(page_request("file:///tmp/ui.lynx.bundle", "  ")).await;

    assert_eq!(result.url, "file:///tmp/ui.lynx.bundle");
    assert_eq!(result.steps, ["Tap Save"]);
    assert_eq!(
      result.error.expect("invalid request error").message,
      "judge_page requires a non-empty task."
    );
  }

  #[tokio::test(flavor = "current_thread")]
  async fn vlm_and_reference_image_comparison_share_only_the_screenshot() {
    let screenshot = sample_bmp();
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.reference_image = Some(reference_data_url());
    let client = ModelClient::mock(
      r#"{
        "score": 4,
        "reason": "The screenshot satisfies the task.",
        "summary": "The rendered UI is visually correct."
      }"#,
    );

    let result = score_captured_page(
      &client,
      &request,
      CapturedPage {
        screenshot,
        steps: vec![],
        url: request.url.clone(),
      },
    )
    .await;

    assert!(result.error.is_none());
    assert!(result.reference_image_error.is_none());
    assert_eq!(result.score, 4);
    assert_eq!(
      result.reason.as_deref(),
      Some("The screenshot satisfies the task.")
    );
    assert_eq!(result.visual_similarity, Some(1.0));
    assert_eq!(result.different_blocks, Some(0));
    assert_eq!(result.total_blocks, Some(1));
    assert!(result.diff_image_base64.is_some());
  }

  #[tokio::test(flavor = "current_thread")]
  async fn scores_all_geqi_dimensions_from_the_same_final_screenshot() {
    let screenshot = sample_bmp();
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.include_geqi = true;
    let client = ModelClient::mock(
      r#"{"score":4,"reason":"Strong UI.","summary":"The requested dimension is strong."}"#,
    );

    let result = score_captured_page(
      &client,
      &request,
      CapturedPage {
        screenshot,
        steps: vec![],
        url: request.url.clone(),
      },
    )
    .await;

    assert_eq!(result.score, 4);
    assert!(result
      .geqi_score
      .is_some_and(|score| (score - 80.0).abs() < f64::EPSILON * 100.0));
    assert_eq!(result.dimensions.len(), 4);
    assert_eq!(
      result
        .dimensions
        .iter()
        .map(|dimension| (
          dimension.dimension.as_str(),
          dimension.weight,
          dimension.score
        ))
        .collect::<Vec<_>>(),
      vec![
        ("usability-interaction", 30, 4),
        ("visual-aesthetics", 25, 4),
        ("consistency-standards", 15, 4),
        ("architecture-writing", 15, 4),
      ]
    );
    assert!(result
      .dimensions
      .iter()
      .all(|dimension| dimension.error.is_none()));
  }

  #[tokio::test(flavor = "current_thread")]
  async fn geqi_failures_stay_independent_from_each_other_and_the_visual_result() {
    let screenshot = sample_bmp();
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.include_geqi = true;
    let client = ModelClient::mock("not JSON");

    let result = score_captured_page(
      &client,
      &request,
      CapturedPage {
        screenshot,
        steps: vec![],
        url: request.url.clone(),
      },
    )
    .await;

    assert!(result.error.is_some());
    assert_eq!(result.score, 0);
    assert_eq!(result.geqi_score, Some(0.0));
    assert_eq!(result.dimensions.len(), 4);
    assert!(result
      .dimensions
      .iter()
      .all(|dimension| dimension.error.is_some() && dimension.score == 0));
  }

  #[tokio::test(flavor = "current_thread")]
  async fn malformed_reference_image_does_not_replace_the_vlm_result() {
    let screenshot = sample_bmp();
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.reference_image = Some("not an image".to_string());
    let client = ModelClient::mock(
      r#"{"score":3,"reason":"Acceptable UI.","summary":"The task is visible."}"#,
    );

    let result = score_captured_page(
      &client,
      &request,
      CapturedPage {
        screenshot,
        steps: vec![],
        url: request.url.clone(),
      },
    )
    .await;

    assert!(result.error.is_none());
    assert_eq!(result.score, 3);
    assert_eq!(
      result
        .reference_image_error
        .expect("independent comparison error")
        .message,
      "Reference image is empty, malformed, or unreadable."
    );
    assert!(result.visual_similarity.is_none());
  }

  #[tokio::test(flavor = "current_thread")]
  async fn reference_comparison_survives_a_vlm_failure() {
    let screenshot = sample_bmp();
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.reference_image = Some(reference_data_url());
    let client = ModelClient::mock("not JSON");

    let result = score_captured_page(
      &client,
      &request,
      CapturedPage {
        screenshot,
        steps: vec![],
        url: request.url.clone(),
      },
    )
    .await;

    assert!(result.error.is_some());
    assert!(result.reference_image_error.is_none());
    assert_eq!(result.score, 0);
    assert_eq!(result.visual_similarity, Some(1.0));
    assert_eq!(result.different_blocks, Some(0));
  }

  #[tokio::test(flavor = "current_thread")]
  async fn judge_page_rejects_a_bare_path_before_initializing_runtime_dependencies() {
    let result = judge_page(page_request("/tmp/ui.lynx.bundle", "Render the form")).await;

    assert_eq!(result.url, "/tmp/ui.lynx.bundle");
    assert_eq!(result.steps, ["Tap Save"]);
    assert_eq!(
      result.error.expect("invalid request error").message,
      "judge_page URL must use file://, http://, or https://."
    );
  }

  #[test]
  fn accepts_only_supported_non_empty_url_schemes() {
    assert!(is_supported_page_url("file:///tmp/ui.lynx.bundle"));
    assert!(is_supported_page_url("http://localhost/ui.lynx.bundle"));
    assert!(is_supported_page_url("https://example.com/ui.lynx.bundle"));
    assert!(!is_supported_page_url("assets://ui.lynx.bundle"));
    assert!(!is_supported_page_url("zip:///index.lynxml"));
    assert!(!is_supported_page_url("file://"));
    assert!(!is_supported_page_url("FILE:///tmp/ui.lynx.bundle"));
  }
}
