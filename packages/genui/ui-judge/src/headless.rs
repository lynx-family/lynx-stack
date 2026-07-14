// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::time::{Duration, Instant};

use base64::prelude::{Engine, BASE64_STANDARD};
use lynx_headless_rust_test_runner::{ConnectOptions, GotoOptions, Lynx, Page, ScreenshotOptions};
use serde::Deserialize;
use serde_json::json;
use thiserror::Error;

use crate::judge::{error_result, judge_screenshot, JudgeScreenshotRequest, UiJudgeResult};
use crate::model::{ModelClient, ModelError, ModelOptions};
use crate::visual::{
  load_reference_image, run_visual_evaluation, VisualEvaluationRequest, VisualEvaluationResponse,
};

const MAX_ACTIONS_PER_STEP: usize = 8;
const MAX_DOM_CHARS: usize = 40_000;
const MAX_WAIT_MS: u64 = 5_000;
const STEP_SYSTEM_PROMPT: &str = "You control a headless Lynx page. Return exactly one JSON action matching the schema. Use only selectors present in the supplied DOM.";

#[derive(Debug, Clone)]
pub struct JudgePageRequest {
  /// Optional textual target included in the VLM prompt.
  pub reference: Option<String>,
  /// Optional reference image as base64, a base64 data URL, or an HTTP(S) URL.
  pub reference_image: Option<String>,
  pub screenshot_settle: Duration,
  pub steps: Vec<String>,
  pub task: String,
  pub timeout: Duration,
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

struct CapturedPage {
  png: Vec<u8>,
  steps: Vec<String>,
  url: String,
}

/// Captures the current software-renderer frame exposed by the existing
/// headless runner.
async fn capture_page_png(page: &Page, settle: Duration) -> Result<Vec<u8>, HeadlessPageError> {
  Ok(
    page
      .screenshot(ScreenshotOptions { path: None, settle })
      .await?,
  )
}

/// Runs legacy natural-language UI steps through Agent SDK and the existing
/// runner's selector-based tap API. The runner does not expose swipe, typing,
/// scrolling, or coordinate touch, so the model must report those as
/// unsupported rather than pretending they completed.
async fn run_page_steps(
  client: &ModelClient,
  page: &mut Page,
  steps: &[String],
  timeout: Duration,
) -> Result<Vec<String>, HeadlessPageError> {
  let steps = normalize_steps(steps);
  for step in &steps {
    run_page_step(client, page, step, timeout).await?;
  }
  Ok(steps)
}

/// Loads a Lynx URL, executes requested steps, captures the final frame, and
/// scores it using the model configured through the environment.
pub async fn judge_page(mut request: JudgePageRequest) -> UiJudgeResult {
  request.url = request.url.trim().to_string();
  if request.url.is_empty() {
    return page_request_error(&request, "judge_page requires a non-empty URL.");
  }
  if !is_supported_page_url(&request.url) {
    return page_request_error(
      &request,
      "judge_page URL must use file://, http://, or https://.",
    );
  }
  if request.task.trim().is_empty() {
    return page_request_error(&request, "judge_page requires a non-empty task.");
  }
  if request
    .reference_image
    .as_ref()
    .is_some_and(|reference_image| reference_image.trim().is_empty())
  {
    return page_request_error(
      &request,
      "judge_page reference_image must be a non-empty image source when provided.",
    );
  }
  request.reference_image = request
    .reference_image
    .map(|reference_image| reference_image.trim().to_string());
  let reference_png = match request.reference_image.as_deref() {
    Some(reference_image) => {
      match tokio::time::timeout(request.timeout, load_reference_image(reference_image)).await {
        Ok(Ok(reference_png)) => Some(reference_png),
        Ok(Err(error)) => return page_request_error(&request, error.to_string()),
        Err(_) => {
          return page_request_error(
            &request,
            operation_timeout("reference image loading", request.timeout).to_string(),
          )
        }
      }
    }
    None => None,
  };

  let model_options = match ModelOptions::from_env() {
    Ok(options) => options,
    Err(error) => return page_request_error(&request, error.to_string()),
  };
  let client = match ModelClient::new(model_options) {
    Ok(client) => client,
    Err(error) => return page_request_error(&request, error.to_string()),
  };
  let lynx = match tokio::time::timeout(
    request.timeout,
    Lynx::connect(ConnectOptions {
      timeout: request.timeout,
      ..ConnectOptions::default()
    }),
  )
  .await
  {
    Ok(Ok(lynx)) => lynx,
    Ok(Err(error)) => return page_request_error(&request, error.to_string()),
    Err(_) => {
      return page_request_error(
        &request,
        operation_timeout("Lynx connection", request.timeout).to_string(),
      )
    }
  };
  let mut page = match lynx.new_page() {
    Ok(page) => page,
    Err(error) => {
      lynx.close();
      return page_request_error(&request, error.to_string());
    }
  };
  let navigation = tokio::time::timeout(
    request.timeout,
    page.goto(
      &request.url,
      GotoOptions {
        timeout: Some(request.timeout),
        ..GotoOptions::default()
      },
    ),
  )
  .await;
  let navigation_error = match navigation {
    Ok(Ok(())) => None,
    Ok(Err(error)) => Some(error.to_string()),
    Err(_) => Some(operation_timeout("navigation", request.timeout).to_string()),
  };
  if let Some(error) = navigation_error {
    drop(page);
    lynx.close();
    return page_request_error(&request, error);
  }

  let capture = capture_loaded_page(&client, &mut page, &request).await;
  drop(page);
  lynx.close();
  match capture {
    Ok(capture) => score_captured_page(&client, &request, capture, reference_png.as_deref()).await,
    Err(result) => result,
  }
}

async fn capture_loaded_page(
  client: &ModelClient,
  page: &mut Page,
  request: &JudgePageRequest,
) -> Result<CapturedPage, UiJudgeResult> {
  let reference = request.reference.clone();

  let steps = match run_page_steps(client, page, &request.steps, request.timeout).await {
    Ok(steps) => steps,
    Err(error) => {
      let mut result = error_result(
        request.reference.clone(),
        page.url().to_string(),
        error.to_string(),
      );
      result.steps = normalize_steps(&request.steps);
      return Err(result);
    }
  };
  let screenshot = match tokio::time::timeout(
    request.timeout,
    capture_page_png(page, request.screenshot_settle),
  )
  .await
  {
    Ok(Ok(screenshot)) => screenshot,
    Ok(Err(error)) => {
      let mut result = error_result(
        request.reference.clone(),
        page.url().to_string(),
        error.to_string(),
      );
      result.steps = steps;
      return Err(result);
    }
    Err(_) => {
      let mut result = error_result(
        reference,
        page.url().to_string(),
        operation_timeout("screenshot capture", request.timeout).to_string(),
      );
      result.steps = steps;
      return Err(result);
    }
  };

  Ok(CapturedPage {
    png: screenshot,
    steps,
    url: page.url().to_string(),
  })
}

async fn score_captured_page(
  client: &ModelClient,
  request: &JudgePageRequest,
  capture: CapturedPage,
  reference_png: Option<&[u8]>,
) -> UiJudgeResult {
  let CapturedPage { png, steps, url } = capture;
  let reference = request.reference.clone();
  let scoring = score_screenshot(client, request, &png, &steps, &url, reference_png);
  let timeout_operation = if reference_png.is_some() {
    "reference-image visual evaluation"
  } else {
    "VLM scoring"
  };
  let mut result = match tokio::time::timeout(request.timeout, scoring).await {
    Ok(result) => result,
    Err(_) => error_result(
      reference,
      url,
      operation_timeout(timeout_operation, request.timeout).to_string(),
    ),
  };
  result.steps = steps;
  result
}

async fn score_screenshot(
  client: &ModelClient,
  request: &JudgePageRequest,
  png: &[u8],
  steps: &[String],
  url: &str,
  reference_png: Option<&[u8]>,
) -> UiJudgeResult {
  let task = task_with_steps(&request.task, steps);
  let Some(reference_png) = reference_png else {
    return judge_screenshot(
      client,
      JudgeScreenshotRequest {
        reference: request.reference.clone(),
        screenshot_data_url: png_data_url(png),
        task,
        url: url.to_string(),
      },
    )
    .await;
  };

  match run_visual_evaluation(
    VisualEvaluationRequest {
      align_options: None,
      compare_options: None,
      reference: request.reference.clone(),
      reference_png: reference_png.to_vec(),
      rendered_png: png.to_vec(),
      task,
    },
    client,
  )
  .await
  {
    Ok(visual) => visual_evaluation_result(request.reference.clone(), url.to_string(), visual),
    Err(error) => error_result(
      request.reference.clone(),
      url.to_string(),
      error.to_string(),
    ),
  }
}

fn visual_evaluation_result(
  reference: Option<String>,
  url: String,
  visual: VisualEvaluationResponse,
) -> UiJudgeResult {
  let compare = &visual.metrics.compare_result;
  let evaluation = &visual.metrics.evaluation_result;
  UiJudgeResult {
    alignment_score: visual
      .metrics
      .align_result
      .as_ref()
      .map(|alignment| alignment.score),
    diff_image_base64: Some(visual.artifacts.diff_image_base64),
    different_blocks: Some(compare.different_blocks),
    error: None,
    visual_similarity: Some(compare.similarity),
    reason: visual.reason,
    reference,
    score: visual
      .score
      .filter(|score| score.is_finite())
      .map(|score| (score * 5.0).round().clamp(0.0, 5.0) as u8)
      .unwrap_or(0),
    steps: vec![],
    summary: evaluation.summary.clone(),
    total_blocks: Some(compare.total_blocks),
    url,
    warnings: visual.warnings,
  }
}

fn is_supported_page_url(url: &str) -> bool {
  ["file://", "http://", "https://"].iter().any(|prefix| {
    url
      .strip_prefix(prefix)
      .is_some_and(|rest| !rest.is_empty())
  })
}

fn page_request_error(request: &JudgePageRequest, message: impl Into<String>) -> UiJudgeResult {
  let mut result = error_result(
    request.reference.clone(),
    request.url.clone(),
    message.into(),
  );
  result.steps = normalize_steps(&request.steps);
  result
}

async fn run_page_step(
  client: &ModelClient,
  page: &mut Page,
  step: &str,
  timeout: Duration,
) -> Result<(), HeadlessPageError> {
  let deadline = Instant::now()
    .checked_add(timeout)
    .unwrap_or_else(Instant::now);
  let mut history = Vec::new();

  for _ in 0..MAX_ACTIONS_PER_STEP {
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
      return Err(step_timeout(step, timeout));
    }
    let dom = tokio::time::timeout(remaining, page.content())
      .await
      .map_err(|_| step_timeout(step, timeout))??;
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
      return Err(step_timeout(step, timeout));
    }
    let screenshot =
      tokio::time::timeout(remaining, capture_page_png(page, Duration::from_millis(16)))
        .await
        .map_err(|_| step_timeout(step, timeout))??;
    let prompt = build_step_prompt(step, &dom, &history);
    let remaining = deadline.saturating_duration_since(Instant::now());
    if remaining.is_zero() {
      return Err(step_timeout(step, timeout));
    }
    let raw = tokio::time::timeout(
      remaining,
      client.evaluate_structured(
        STEP_SYSTEM_PROMPT,
        &prompt,
        &[&png_data_url(&screenshot)],
        "lynx_page_action",
        page_action_schema(),
      ),
    )
    .await
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
        page.wait_for_timeout(duration).await;
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
        let remaining = deadline.saturating_duration_since(Instant::now());
        if remaining.is_zero() {
          return Err(step_timeout(step, timeout));
        }
        let element = tokio::time::timeout(remaining, page.locator(selector))
          .await
          .map_err(|_| step_timeout(step, timeout))??;
        let Some(element) = element else {
          history.push(format!(
            "tap failed: selector did not match a node: {selector}"
          ));
          continue;
        };
        let remaining = deadline.saturating_duration_since(Instant::now());
        tokio::time::timeout(remaining, element.tap())
          .await
          .map_err(|_| step_timeout(step, timeout))??;
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

fn png_data_url(png: &[u8]) -> String {
  format!("data:image/png;base64,{}", BASE64_STANDARD.encode(png))
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
  use super::*;

  fn page_request(url: &str, task: &str) -> JudgePageRequest {
    JudgePageRequest {
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
  async fn judge_page_rejects_an_empty_reference_image_before_initializing_runtime_dependencies() {
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.reference_image = Some("  ".to_string());
    let result = judge_page(request).await;

    assert_eq!(result.steps, ["Tap Save"]);
    assert_eq!(
      result.error.expect("invalid request error").message,
      "judge_page reference_image must be a non-empty image source when provided."
    );
  }

  #[tokio::test(flavor = "current_thread")]
  async fn judge_page_rejects_a_malformed_reference_image_before_initializing_runtime_dependencies()
  {
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.reference_image = Some("not an image".to_string());
    let result = judge_page(request).await;

    assert_eq!(result.steps, ["Tap Save"]);
    assert_eq!(
      result.error.expect("invalid reference error").message,
      "Reference image is empty, malformed, or unreadable."
    );
  }

  #[tokio::test(flavor = "current_thread")]
  async fn scores_a_reference_image_through_the_visual_comparison_path() {
    const PNG_BASE64: &str =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    let png = BASE64_STANDARD.decode(PNG_BASE64).expect("decode fixture");
    let mut request = page_request("file:///tmp/ui.lynx.bundle", "Render the form");
    request.reference_image = Some(format!("data:image/png;base64,{PNG_BASE64}"));
    let client = ModelClient::mock(
      r#"{
        "score": 0.8,
        "reason": "The images match.",
        "summary": "The rendered UI matches the supplied reference.",
        "issues": []
      }"#,
    );

    let result = score_screenshot(&client, &request, &png, &[], &request.url, Some(&png)).await;

    assert!(result.error.is_none());
    assert_eq!(result.score, 4);
    assert_eq!(result.visual_similarity, Some(1.0));
    assert_eq!(result.different_blocks, Some(0));
    assert_eq!(result.total_blocks, Some(1));
    assert!(result.diff_image_base64.is_some());
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
    assert!(!is_supported_page_url("file://"));
    assert!(!is_supported_page_url("FILE:///tmp/ui.lynx.bundle"));
  }
}
