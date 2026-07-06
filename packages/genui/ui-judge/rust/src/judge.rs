// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

use crate::model::ModelClient;

pub type UiJudgeScore = u8;

#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UiJudgeDimension {
  #[default]
  VisualCorrectness,
  UsabilityInteraction,
  VisualAesthetics,
  ConsistencyStandards,
  ArchitectureWriting,
  AccessibilityPerformance,
}

impl UiJudgeDimension {
  pub fn label(self) -> &'static str {
    self.prompt().title
  }

  pub fn prompt(self) -> DimensionPrompt {
    match self {
      UiJudgeDimension::AccessibilityPerformance => DimensionPrompt {
        title: "Accessibility & Performance",
        focus:
          "Judge whether the UI feels inclusive, robust across screen sizes, and technically mature under real usage conditions.",
        criteria: &[
          "WCAG contrast and non-color cues: text/background contrast should meet AA expectations, and important states should not rely only on color.",
          "Touch targets and responsive behavior: interactive areas should be easy to tap, and the layout should avoid overlap, truncation, or broken adaptation.",
          "Perceived performance: loading, large data, or waiting states should use skeletons, progressive loading, optimistic feedback, or other anxiety-reducing patterns when relevant.",
        ],
      },
      UiJudgeDimension::ArchitectureWriting => DimensionPrompt {
        title: "Information Architecture & UX Writing",
        focus:
          "Judge whether users can quickly find what they need, understand where they are, and act on clear product language.",
        criteria: &[
          "Wayfinding and navigation: navigation should be flat enough for the task, with clear current location, next destinations, and return paths when relevant.",
          "Microcopy: buttons, labels, and helper text should be concise, consistent, action-oriented, and free of ambiguity.",
          "Empty states: no-data, first-use, or no-result states should feel intentional and provide a useful next action instead of dead ends.",
        ],
      },
      UiJudgeDimension::ConsistencyStandards => DimensionPrompt {
        title: "Consistency & Standards",
        focus:
          "Judge whether the UI follows expected design-system, product, and platform conventions so it lowers both implementation and learning cost.",
        criteria: &[
          "Design-system fit: components, spacing, radius, color, and typography should look tokenized and reusable rather than improvised.",
          "Internal consistency: repeated components and behaviors should stay consistent across cards, lists, controls, dialogs, and modules.",
          "Platform conventions: icons, gestures, search, settings, navigation, and form behaviors should match familiar iOS, Android, or web standards for the visible context.",
        ],
      },
      UiJudgeDimension::UsabilityInteraction => DimensionPrompt {
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
      UiJudgeDimension::VisualAesthetics => DimensionPrompt {
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
      UiJudgeDimension::VisualCorrectness => DimensionPrompt {
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

impl fmt::Display for UiJudgeDimension {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter.write_str(match self {
      UiJudgeDimension::AccessibilityPerformance => "accessibility-performance",
      UiJudgeDimension::ArchitectureWriting => "architecture-writing",
      UiJudgeDimension::ConsistencyStandards => "consistency-standards",
      UiJudgeDimension::UsabilityInteraction => "usability-interaction",
      UiJudgeDimension::VisualAesthetics => "visual-aesthetics",
      UiJudgeDimension::VisualCorrectness => "visual-correctness",
    })
  }
}

impl FromStr for UiJudgeDimension {
  type Err = JudgeError;

  fn from_str(value: &str) -> std::result::Result<Self, Self::Err> {
    match value {
      "accessibility-performance" => Ok(Self::AccessibilityPerformance),
      "architecture-writing" => Ok(Self::ArchitectureWriting),
      "consistency-standards" => Ok(Self::ConsistencyStandards),
      "usability-interaction" => Ok(Self::UsabilityInteraction),
      "visual-aesthetics" => Ok(Self::VisualAesthetics),
      "visual-correctness" => Ok(Self::VisualCorrectness),
      _ => Err(JudgeError::InvalidDimension(value.to_string())),
    }
  }
}

#[derive(Debug, Clone, Copy)]
pub struct DimensionPrompt {
  pub title: &'static str,
  pub focus: &'static str,
  pub criteria: &'static [&'static str],
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeqiDimension {
  pub dimension: UiJudgeDimension,
  pub dimension_label: &'static str,
  pub weight: u8,
}

pub const GEQI_DIMENSIONS: [GeqiDimension; 5] = [
  GeqiDimension {
    dimension: UiJudgeDimension::UsabilityInteraction,
    dimension_label: "Usability & Interaction Logic",
    weight: 30,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::VisualAesthetics,
    dimension_label: "Visual Communication & Aesthetics",
    weight: 25,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::ConsistencyStandards,
    dimension_label: "Consistency & Standards",
    weight: 15,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::ArchitectureWriting,
    dimension_label: "Information Architecture & UX Writing",
    weight: 15,
  },
  GeqiDimension {
    dimension: UiJudgeDimension::AccessibilityPerformance,
    dimension_label: "Accessibility & Performance",
    weight: 15,
  },
];

#[derive(Debug, Clone)]
pub struct JudgeAndroidAgentRequest {
  pub dimension: UiJudgeDimension,
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
  pub dimension: UiJudgeDimension,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub dimension_label: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<UiJudgeError>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reason: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reference: Option<String>,
  pub score: UiJudgeScore,
  pub steps: Vec<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  pub url: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub weight: Option<u8>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JudgeModelResult {
  pub score: UiJudgeScore,
  #[serde(default, skip_serializing_if = "String::is_empty")]
  pub reason: String,
  #[serde(default, skip_serializing_if = "String::is_empty")]
  pub summary: String,
}

#[derive(Debug, Error)]
pub enum JudgeError {
  #[error("unknown UI Judge dimension: {0}")]
  InvalidDimension(String),
  #[error("judge task must not be empty")]
  EmptyTask,
  #[error("model result must be valid JSON: {0}")]
  InvalidJson(String),
  #[error("model result must be a JSON object")]
  InvalidObject,
  #[error("model result is missing numeric score")]
  MissingScore,
}

pub async fn judge_android_agent(
  client: &ModelClient,
  request: JudgeAndroidAgentRequest,
) -> UiJudgeResult {
  if request.task.trim().is_empty() {
    return error_result(
      request.dimension,
      request.reference,
      request.url,
      "judgeAndroidAgent requires a non-empty task.",
    );
  }

  let prompt = build_judge_prompt(&request);
  match client
    .evaluate(&prompt, &[&request.screenshot_data_url])
    .await
  {
    Ok(raw) => match parse_model_result(&raw) {
      Ok(model_result) => UiJudgeResult {
        dimension: request.dimension,
        dimension_label: None,
        error: None,
        reason: non_empty(model_result.reason),
        reference: request.reference,
        score: model_result.score,
        steps: vec![],
        summary: non_empty(model_result.summary),
        url: request.url,
        weight: None,
      },
      Err(error) => error_result(
        request.dimension,
        request.reference,
        request.url,
        error.to_string(),
      ),
    },
    Err(error) => error_result(
      request.dimension,
      request.reference,
      request.url,
      error.to_string(),
    ),
  }
}

pub fn build_judge_prompt(request: &JudgeAndroidAgentRequest) -> String {
  let dimension_prompt = request.dimension.prompt();
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
    .map(|(index, criterion)| format!("{}. {}", index + 1, criterion))
    .collect::<Vec<_>>()
    .join("\n");

  format!(
    r#"You are a senior product and design reviewer judging one GEQI dimension of a generated Android Lynx UI screenshot.

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

pub fn parse_model_result(raw: &str) -> std::result::Result<JudgeModelResult, JudgeError> {
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
  let score = raw_score.round().clamp(0.0, 5.0) as UiJudgeScore;
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

pub fn error_result(
  dimension: UiJudgeDimension,
  reference: Option<String>,
  url: String,
  message: impl Into<String>,
) -> UiJudgeResult {
  UiJudgeResult {
    dimension,
    dimension_label: None,
    error: Some(UiJudgeError {
      message: message.into(),
    }),
    reason: None,
    reference,
    score: 0,
    steps: vec![],
    summary: None,
    url,
    weight: None,
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
  fn parses_dimension_names() {
    assert_eq!(
      "visual-correctness".parse::<UiJudgeDimension>().unwrap(),
      UiJudgeDimension::VisualCorrectness
    );
    assert!("unknown".parse::<UiJudgeDimension>().is_err());
  }

  #[test]
  fn parses_and_clamps_model_score() {
    let result = parse_model_result(r#"{"score": 5.8, "reason": "ok", "summary": "fine"}"#)
      .expect("parse model result");
    assert_eq!(result.score, 5);

    let result = parse_model_result(r#"{"score": "2.2"}"#).expect("parse string score");
    assert_eq!(result.score, 2);
  }

  #[test]
  fn builds_dimension_prompt() {
    let prompt = build_judge_prompt(&JudgeAndroidAgentRequest {
      dimension: UiJudgeDimension::UsabilityInteraction,
      reference: Some("Target".to_string()),
      screenshot_data_url: "data:image/png;base64,abc".to_string(),
      task: "Judge the screen".to_string(),
      url: "lynx://screen".to_string(),
    });
    assert!(prompt.contains("Usability & Interaction Logic"));
    assert!(prompt.contains("Target"));
    assert!(prompt.contains("\"score\": number"));
  }
}
