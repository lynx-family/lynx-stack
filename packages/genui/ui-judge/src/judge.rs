// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

use crate::model::ModelClient;

#[derive(Debug, Clone)]
pub(crate) struct JudgeScreenshotRequest {
  pub reference: Option<String>,
  pub screenshot_data_url: String,
  pub task: String,
  pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiJudgeError {
  pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiJudgeResult {
  /// Normalized cross-correlation confidence for a successful alignment.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub alignment_score: Option<f64>,
  /// Base64-encoded PNG with pixels outside tolerance highlighted in red.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub diff_image_base64: Option<String>,
  /// Number of blocks whose changed-pixel ratio exceeded the threshold.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub different_blocks: Option<usize>,
  /// Error from the primary page-capture or single-screenshot VLM chain.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<UiJudgeError>,
  /// Error produced by the independent reference-image comparison chain.
  ///
  /// This never replaces the VLM result or its `error` field.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reference_image_error: Option<UiJudgeError>,
  /// Ratio of blocks that stayed within the configured difference threshold.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub visual_similarity: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reason: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reference: Option<String>,
  pub score: u8,
  pub steps: Vec<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  /// Total number of blocks in the aligned image comparison.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub total_blocks: Option<usize>,
  pub url: String,
  /// Non-fatal visual comparison diagnostics, such as alignment fallback.
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct JudgeModelResult {
  pub score: u8,
  #[serde(default, skip_serializing_if = "String::is_empty")]
  pub reason: String,
  #[serde(default, skip_serializing_if = "String::is_empty")]
  pub summary: String,
}

#[derive(Debug, Error)]
enum JudgeError {
  #[error("model result must be valid JSON: {0}")]
  InvalidJson(String),
  #[error("model result must be a JSON object")]
  InvalidObject,
  #[error("model result is missing numeric score")]
  MissingScore,
  #[error("model result score must be finite")]
  NonFiniteScore,
}

pub(crate) async fn judge_screenshot(
  client: &ModelClient,
  request: JudgeScreenshotRequest,
) -> UiJudgeResult {
  if request.task.trim().is_empty() {
    return error_result(
      request.reference,
      request.url,
      "judge_screenshot requires a non-empty task.",
    );
  }

  let prompt = build_judge_prompt(&request);
  match client
    .evaluate_structured(
      "You are a strict JSON-only UI judge. Return only valid JSON matching the requested schema.",
      &prompt,
      &[&request.screenshot_data_url],
      "ui_judge_score",
      json!({
        "type": "object",
        "properties": {
          "score": { "type": "integer", "minimum": 0, "maximum": 5 },
          "reason": { "type": "string" },
          "summary": { "type": "string" }
        },
        "required": ["score", "reason", "summary"],
        "additionalProperties": false
      }),
    )
    .await
  {
    Ok(raw) => match parse_model_result(&raw) {
      Ok(model_result) => UiJudgeResult {
        alignment_score: None,
        diff_image_base64: None,
        different_blocks: None,
        error: None,
        reference_image_error: None,
        visual_similarity: None,
        reason: non_empty(model_result.reason),
        reference: request.reference,
        score: model_result.score,
        steps: vec![],
        summary: non_empty(model_result.summary),
        total_blocks: None,
        url: request.url,
        warnings: vec![],
      },
      Err(error) => error_result(request.reference, request.url, error.to_string()),
    },
    Err(error) => error_result(request.reference, request.url, error.to_string()),
  }
}

fn build_judge_prompt(request: &JudgeScreenshotRequest) -> String {
  let reference = request
    .reference
    .as_deref()
    .filter(|value| !value.trim().is_empty())
    .map(|value| format!("\nReference answer or target:\n{value}\n"))
    .unwrap_or_default();

  format!(
    r#"You are a senior product and design reviewer judging the visual correctness of a generated Lynx UI screenshot.

Task:
{task}
{reference}
Use only the provided screenshot and visible UI state. Do not assume hidden behavior.

Use this 0-5 scale:
5 = Excellent benchmark: exceptional craft, thoughtful details, and an "aha moment" that exceeds expectations.
4 = Strong professional quality: smooth, comfortable, and aligned with industry best practices.
3 = Acceptable baseline: the core task works with no fatal issue, but the experience is ordinary or under-polished.
2 = Poor with clear defects: noticeable friction, inconsistency, confusion, or frustration.
1 = Disaster or blocker: seriously violates interaction common sense or blocks the core flow and should be redone.
0 = The UI is unrelated, blank, failed to render, impossible to inspect, or completely wrong.

Judge these criteria:
1. Required content: the expected components, labels, data, and relationships should be present.
2. Task fit: the visible UI should match the requested scenario rather than merely showing related generic content.
3. Rendering quality: the page should not be blank, broken, clipped, or impossible to inspect.

Return valid JSON only with this exact shape:
{{
  "score": number,
  "reason": string,
  "summary": string
}}

Rules:
- "score" must be one integer from 0 through 5.
- "reason" must be one concise sentence.
- "summary" must be a short paragraph.
- Do not return Markdown, prose outside JSON, or letter grades."#,
    task = request.task.trim(),
  )
}

fn parse_model_result(raw: &str) -> Result<JudgeModelResult, JudgeError> {
  let parsed: Value =
    serde_json::from_str(raw).map_err(|error| JudgeError::InvalidJson(error.to_string()))?;
  let object = parsed.as_object().ok_or(JudgeError::InvalidObject)?;
  let raw_score = object
    .get("score")
    .and_then(|value| match value {
      Value::Number(number) => number.as_f64(),
      Value::String(string) => string.parse::<f64>().ok(),
      _ => None,
    })
    .ok_or(JudgeError::MissingScore)?;
  if !raw_score.is_finite() {
    return Err(JudgeError::NonFiniteScore);
  }
  let score = raw_score.round().clamp(0.0, 5.0) as u8;
  let reason = object
    .get("reason")
    .and_then(Value::as_str)
    .unwrap_or_default()
    .to_string();
  let summary = object
    .get("summary")
    .and_then(Value::as_str)
    .unwrap_or_default()
    .to_string();

  Ok(JudgeModelResult {
    score,
    reason,
    summary,
  })
}

pub(crate) fn error_result(
  reference: Option<String>,
  url: String,
  message: impl Into<String>,
) -> UiJudgeResult {
  UiJudgeResult {
    alignment_score: None,
    diff_image_base64: None,
    different_blocks: None,
    error: Some(UiJudgeError {
      message: message.into(),
    }),
    reference_image_error: None,
    visual_similarity: None,
    reason: None,
    reference,
    score: 0,
    steps: vec![],
    summary: None,
    total_blocks: None,
    url,
    warnings: vec![],
  }
}

fn non_empty(value: String) -> Option<String> {
  if value.trim().is_empty() {
    None
  } else {
    Some(value)
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn parses_and_clamps_model_score() {
    let result = parse_model_result(r#"{"score": 5.8, "reason": "ok", "summary": "fine"}"#)
      .expect("parse result");
    assert_eq!(result.score, 5);
    let result = parse_model_result(r#"{"score": "2.2"}"#).expect("parse string score");
    assert_eq!(result.score, 2);
    assert!(matches!(
      parse_model_result(r#"{"score":"NaN"}"#),
      Err(JudgeError::NonFiniteScore)
    ));
    assert!(matches!(
      parse_model_result(r#"{"score":"inf"}"#),
      Err(JudgeError::NonFiniteScore)
    ));
  }

  #[test]
  fn builds_visual_correctness_prompt() {
    let prompt = build_judge_prompt(&JudgeScreenshotRequest {
      reference: Some("Expected layout".to_string()),
      screenshot_data_url: "data:image/png;base64,abc".to_string(),
      task: "Render a form".to_string(),
      url: "file:///fixture".to_string(),
    });
    assert!(prompt.contains("visual correctness"));
    assert!(prompt.contains("Expected layout"));
    assert!(prompt.contains("Render a form"));
  }
}
