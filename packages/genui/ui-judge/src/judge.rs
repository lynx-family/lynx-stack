// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

use crate::model::ModelClient;

const JUDGE_SYSTEM_PROMPT: &str =
  "You are a strict JSON-only UI judge. Return only valid JSON matching the requested schema.";

#[derive(Debug, Clone)]
pub(crate) struct JudgeScreenshotRequest {
  pub reference: Option<String>,
  pub screenshot_data_url: String,
  pub task: String,
  pub url: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum UiJudgeDimension {
  VisualCorrectness,
  UsabilityInteraction,
  VisualAesthetics,
  ConsistencyStandards,
  ArchitectureWriting,
}

impl UiJudgeDimension {
  fn id(self) -> &'static str {
    match self {
      Self::VisualCorrectness => "visual-correctness",
      Self::UsabilityInteraction => "usability-interaction",
      Self::VisualAesthetics => "visual-aesthetics",
      Self::ConsistencyStandards => "consistency-standards",
      Self::ArchitectureWriting => "architecture-writing",
    }
  }

  fn prompt(self) -> JudgeDimensionPrompt {
    match self {
      Self::ArchitectureWriting => JudgeDimensionPrompt {
        title: "Information Architecture & UX Writing",
        focus:
          "Judge whether users can quickly find what they need, understand where they are, and act on clear product language.",
        criteria: &[
          "Wayfinding and navigation: navigation should be flat enough for the task, with clear current location, next destinations, and return paths when relevant.",
          "Microcopy: buttons, labels, and helper text should be concise, consistent, action-oriented, and free of ambiguity.",
          "Empty states: no-data, first-use, or no-result states should feel intentional and provide a useful next action instead of dead ends.",
        ],
      },
      Self::ConsistencyStandards => JudgeDimensionPrompt {
        title: "Consistency & Standards",
        focus:
          "Judge whether the UI follows expected design-system, product, and platform conventions so it lowers both implementation and learning cost.",
        criteria: &[
          "Design-system fit: components, spacing, radius, color, and typography should look tokenized and reusable rather than improvised.",
          "Internal consistency: repeated components and behaviors should stay consistent across cards, lists, controls, dialogs, and modules.",
          "Platform conventions: icons, gestures, search, settings, navigation, and form behaviors should match familiar iOS, Android, or web standards for the visible context.",
        ],
      },
      Self::UsabilityInteraction => JudgeDimensionPrompt {
        title: "Usability & Interaction Logic",
        focus:
          "Judge whether the product is easy to understand, easy to operate, and resilient when users take normal actions.",
        criteria: &[
          "Cognitive load: information density should be reasonable, and the page purpose should be understandable within about one second.",
          "System feedback: clicks, hover states, loading, success, and error transitions should provide immediate and clear feedback when visible in the current state.",
          "Error recovery: destructive or high-stakes actions should show confirmation, and errors should use human language with a clear recovery path when relevant.",
          "Task efficiency: the core flow should minimize unnecessary steps and use smart defaults, history, shortcuts, or direct actions for frequent tasks when appropriate.",
        ],
      },
      Self::VisualAesthetics => JudgeDimensionPrompt {
        title: "Visual Communication & Aesthetics",
        focus:
          "Judge whether the interface looks professional, trustworthy, and visually comfortable while guiding attention to the right actions.",
        criteria: &[
          "Visual hierarchy: the primary action and most important information should be prominent, with clear contrast in size, weight, color, and placement.",
          "Typography and whitespace: spacing should follow Gestalt proximity, related elements should group naturally, and the layout should have enough breathing room.",
          "Color semantics: brand, neutral, warning, success, and emphasis colors should be restrained, meaningful, and consistent.",
          "Graphics and icons: icon stroke, corner style, illustration quality, imagery, and decorative graphics should feel consistent and support comprehension.",
        ],
      },
      Self::VisualCorrectness => JudgeDimensionPrompt {
        title: "Visual Correctness",
        focus:
          "Judge whether the generated UI visually satisfies the requested task and reference content.",
        criteria: &[
          "Required content: the expected components, labels, data, and relationships should be present.",
          "Task fit: the visible UI should match the requested scenario rather than merely showing related generic content.",
          "Rendering quality: the page should not be blank, broken, clipped, or impossible to inspect.",
        ],
      },
    }
  }
}

#[derive(Debug, Clone, Copy)]
struct JudgeDimensionPrompt {
  title: &'static str,
  focus: &'static str,
  criteria: &'static [&'static str],
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct GeqiDimension {
  dimension: UiJudgeDimension,
  pub(crate) label: &'static str,
  pub(crate) weight: u8,
}

impl GeqiDimension {
  pub(crate) fn id(self) -> &'static str {
    self.dimension.id()
  }
}

pub(crate) const GEQI_DIMENSIONS: [GeqiDimension; 4] = [
  GeqiDimension {
    dimension: UiJudgeDimension::UsabilityInteraction,
    label: "Usability & Interaction Logic",
    weight: 30,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::VisualAesthetics,
    label: "Visual Communication & Aesthetics",
    weight: 25,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::ConsistencyStandards,
    label: "Consistency & Standards",
    weight: 15,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::ArchitectureWriting,
    label: "Information Architecture & UX Writing",
    weight: 15,
  },
];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UiJudgeError {
  pub message: String,
}

/// One independently evaluated GEQI dimension for the captured screenshot.
///
/// The type remains an implementation detail of the crate-root API, but its
/// standard-type fields are available through [`UiJudgeResult::dimensions`]
/// and the HTTP JSON response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UiJudgeDimensionResult {
  pub dimension: String,
  pub dimension_label: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<UiJudgeError>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reason: Option<String>,
  pub score: u8,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  pub weight: u8,
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
  /// Independently scored weighted GEQI dimensions, in stable weight order.
  #[serde(default, skip_serializing_if = "Vec::is_empty")]
  pub dimensions: Vec<UiJudgeDimensionResult>,
  /// Error from page capture or the primary visual-correctness VLM dimension.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<UiJudgeError>,
  /// Error produced by the independent reference-image comparison chain.
  ///
  /// This never replaces the VLM result or its `error` field.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reference_image_error: Option<UiJudgeError>,
  /// Weighted GEQI score from 0 through 100.
  ///
  /// A failed dimension contributes its error-result score of zero, matching
  /// the historical GEQI report calculation; inspect `dimensions[].error` to
  /// distinguish a genuine zero from an evaluation failure.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub geqi_score: Option<f64>,
  /// Ratio of blocks that stayed within the configured difference threshold.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub visual_similarity: Option<f64>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reason: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reference: Option<String>,
  /// Visual-correctness score from 0 through 5.
  ///
  /// This remains separate from `geqi_score` for backward compatibility.
  pub score: u8,
  pub steps: Vec<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  /// Total number of blocks in the aligned image comparison.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub total_blocks: Option<usize>,
  /// Updated prompt-specific TrueSkill mean for the primary candidate.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_candidate_mu: Option<f64>,
  /// Updated prompt-specific TrueSkill uncertainty for the primary candidate.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_candidate_sigma: Option<f64>,
  /// Error from the independent UI-Bench pairwise evaluation.
  ///
  /// This never replaces the primary visual-correctness result or `error`.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_error: Option<UiJudgeError>,
  /// Evaluator used for the pairwise vote. Currently `vlm_proxy`.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_evaluator: Option<String>,
  /// Updated prompt-specific TrueSkill mean for the opponent.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_opponent_mu: Option<f64>,
  /// Updated prompt-specific TrueSkill uncertainty for the opponent.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_opponent_sigma: Option<f64>,
  /// Opponent URL captured for the same task and pairwise comparison.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_opponent_url: Option<String>,
  /// Concise evidence for the forced pairwise preference.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_reason: Option<String>,
  /// Pairwise winner: `candidate` for `url`, or `opponent`.
  #[serde(skip_serializing_if = "Option::is_none")]
  pub ui_bench_winner: Option<String>,
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
  request: &JudgeScreenshotRequest,
) -> UiJudgeResult {
  match evaluate_dimension(client, request, UiJudgeDimension::VisualCorrectness).await {
    Ok(model_result) => UiJudgeResult {
      alignment_score: None,
      diff_image_base64: None,
      different_blocks: None,
      dimensions: vec![],
      error: None,
      geqi_score: None,
      reference_image_error: None,
      visual_similarity: None,
      reason: non_empty(model_result.reason),
      reference: request.reference.clone(),
      score: model_result.score,
      steps: vec![],
      summary: non_empty(model_result.summary),
      total_blocks: None,
      ui_bench_candidate_mu: None,
      ui_bench_candidate_sigma: None,
      ui_bench_error: None,
      ui_bench_evaluator: None,
      ui_bench_opponent_mu: None,
      ui_bench_opponent_sigma: None,
      ui_bench_opponent_url: None,
      ui_bench_reason: None,
      ui_bench_winner: None,
      url: request.url.clone(),
      warnings: vec![],
    },
    Err(error) => error_result(request.reference.clone(), request.url.clone(), error),
  }
}

pub(crate) async fn judge_geqi_dimension(
  client: &ModelClient,
  request: &JudgeScreenshotRequest,
  dimension: GeqiDimension,
) -> UiJudgeDimensionResult {
  match evaluate_dimension(client, request, dimension.dimension).await {
    Ok(model_result) => UiJudgeDimensionResult {
      dimension: dimension.id().to_string(),
      dimension_label: dimension.label.to_string(),
      error: None,
      reason: non_empty(model_result.reason),
      score: model_result.score,
      summary: non_empty(model_result.summary),
      weight: dimension.weight,
    },
    Err(error) => geqi_error_result(dimension, error),
  }
}

pub(crate) fn geqi_error_result(
  dimension: GeqiDimension,
  message: impl Into<String>,
) -> UiJudgeDimensionResult {
  UiJudgeDimensionResult {
    dimension: dimension.id().to_string(),
    dimension_label: dimension.label.to_string(),
    error: Some(UiJudgeError {
      message: message.into(),
    }),
    reason: None,
    score: 0,
    summary: None,
    weight: dimension.weight,
  }
}

pub(crate) fn calculate_geqi_score(dimensions: &[UiJudgeDimensionResult]) -> Option<f64> {
  let total_weight = GEQI_DIMENSIONS
    .iter()
    .map(|dimension| u16::from(dimension.weight))
    .sum::<u16>();
  if total_weight == 0 || dimensions.len() != GEQI_DIMENSIONS.len() {
    return None;
  }

  let mut weighted_score = 0.0;
  for expected in GEQI_DIMENSIONS {
    let mut matching = dimensions
      .iter()
      .filter(|result| result.dimension == expected.id());
    let result = matching.next()?;
    if matching.next().is_some() || result.weight != expected.weight {
      return None;
    }
    weighted_score += (f64::from(result.score) / 5.0)
      * (f64::from(expected.weight) / f64::from(total_weight))
      * 100.0;
  }
  Some(weighted_score.clamp(0.0, 100.0))
}

async fn evaluate_dimension(
  client: &ModelClient,
  request: &JudgeScreenshotRequest,
  dimension: UiJudgeDimension,
) -> Result<JudgeModelResult, String> {
  if request.task.trim().is_empty() {
    return Err("judge_screenshot requires a non-empty task.".to_string());
  }

  let prompt = build_judge_prompt(request, dimension);
  let raw = client
    .evaluate_structured(
      JUDGE_SYSTEM_PROMPT,
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
    .map_err(|error| error.to_string())?;
  parse_model_result(&raw).map_err(|error| error.to_string())
}

fn build_judge_prompt(request: &JudgeScreenshotRequest, dimension: UiJudgeDimension) -> String {
  if dimension == UiJudgeDimension::VisualCorrectness {
    return build_visual_correctness_prompt(request);
  }

  let dimension_prompt = dimension.prompt();
  let reference = request
    .reference
    .as_deref()
    .filter(|value| !value.trim().is_empty())
    .map(|value| format!("\nReference answer or target:\n{value}\n"))
    .unwrap_or_default();
  let criteria = dimension_prompt
    .criteria
    .iter()
    .enumerate()
    .map(|(index, criterion)| format!("{}. {criterion}", index + 1))
    .collect::<Vec<_>>()
    .join("\n");

  format!(
    r#"You are a senior product and design reviewer judging one GEQI dimension of a generated Lynx UI screenshot.

Dimension:
{title}

Dimension focus:
{focus}

Task:
{task}
{reference}
Use only the provided screenshot and visible UI state. Do not assume hidden behavior.

Use this 0-5 scale for the requested dimension:
5 = Excellent benchmark: exceptional craft, thoughtful details, and an "aha moment" that exceeds expectations.
4 = Strong professional quality: smooth, comfortable, and aligned with industry best practices.
3 = Acceptable baseline: the core task works with no fatal issue, but the experience is ordinary or under-polished.
2 = Poor with clear defects: noticeable friction, inconsistency, confusion, or frustration.
1 = Disaster or blocker: seriously violates interaction common sense or blocks the core flow and should be redone.
0 = The UI is unrelated, blank, failed to render, impossible to inspect, or completely wrong.

Subcriteria for this dimension:
{criteria}

Grading notes:
1. Score only the requested dimension; do not collapse all GEQI dimensions into one general quality score.
2. Variations in capitalization, punctuation, and minor spacing differences are acceptable when semantic intent and required components are present.
3. Unless a specific vertical or horizontal order is explicitly requested, variations in component order within a container are acceptable.
4. Minor label variations that preserve core semantic meaning are acceptable unless exact literal text was requested.
5. Valid optional properties, such as accessibility hints or default values, should not be penalized when they make sense in context.
6. Do not award a high score when required components are missing or substantive behavior is wrong for this dimension.

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
- Score only the requested dimension.
- Do not return Markdown, prose outside JSON, or letter grades."#,
    title = dimension_prompt.title,
    focus = dimension_prompt.focus,
    task = request.task.trim(),
  )
}

fn build_visual_correctness_prompt(request: &JudgeScreenshotRequest) -> String {
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
    dimensions: vec![],
    error: Some(UiJudgeError {
      message: message.into(),
    }),
    geqi_score: None,
    reference_image_error: None,
    visual_similarity: None,
    reason: None,
    reference,
    score: 0,
    steps: vec![],
    summary: None,
    total_blocks: None,
    ui_bench_candidate_mu: None,
    ui_bench_candidate_sigma: None,
    ui_bench_error: None,
    ui_bench_evaluator: None,
    ui_bench_opponent_mu: None,
    ui_bench_opponent_sigma: None,
    ui_bench_opponent_url: None,
    ui_bench_reason: None,
    ui_bench_winner: None,
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
    let request = JudgeScreenshotRequest {
      reference: Some("Expected layout".to_string()),
      screenshot_data_url: "data:image/png;base64,abc".to_string(),
      task: "Render a form".to_string(),
      url: "file:///fixture".to_string(),
    };
    let prompt = build_judge_prompt(&request, UiJudgeDimension::VisualCorrectness);
    assert!(prompt.contains("judging the visual correctness"));
    assert!(!prompt.contains("client-delivery standard"));
    assert!(prompt.contains("Expected layout"));
    assert!(prompt.contains("Render a form"));
    assert!(prompt.contains("Required content"));
    assert!(!prompt.contains("GEQI dimension"));
  }

  #[test]
  fn restores_all_weighted_geqi_dimension_prompts() {
    let request = JudgeScreenshotRequest {
      reference: None,
      screenshot_data_url: "data:image/png;base64,abc".to_string(),
      task: "Render a form".to_string(),
      url: "file:///fixture".to_string(),
    };
    assert_eq!(
      GEQI_DIMENSIONS.map(|dimension| dimension.id()),
      [
        "usability-interaction",
        "visual-aesthetics",
        "consistency-standards",
        "architecture-writing",
      ]
    );
    assert_eq!(
      GEQI_DIMENSIONS
        .iter()
        .map(|dimension| u16::from(dimension.weight))
        .sum::<u16>(),
      85
    );
    for dimension in GEQI_DIMENSIONS {
      let prompt = build_judge_prompt(&request, dimension.dimension);
      assert!(prompt.contains(dimension.label));
      for criterion in dimension.dimension.prompt().criteria {
        assert!(prompt.contains(criterion));
      }
    }
  }

  #[test]
  fn normalizes_the_weighted_geqi_score_to_one_hundred() {
    let scores = [5, 4, 3, 2];
    let dimensions = GEQI_DIMENSIONS
      .iter()
      .zip(scores)
      .map(|(dimension, score)| UiJudgeDimensionResult {
        dimension: dimension.id().to_string(),
        dimension_label: dimension.label.to_string(),
        error: None,
        reason: None,
        score,
        summary: None,
        weight: dimension.weight,
      })
      .collect::<Vec<_>>();

    let score = calculate_geqi_score(&dimensions).expect("complete dimensions");
    assert!((score - 76.470_588_235_294_12).abs() < 1e-12);

    let mut inconsistent = dimensions.clone();
    inconsistent[0].weight = 29;
    assert_eq!(calculate_geqi_score(&inconsistent), None);
    assert_eq!(calculate_geqi_score(&dimensions[..3]), None);
  }
}
