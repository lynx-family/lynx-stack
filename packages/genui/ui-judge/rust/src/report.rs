// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use serde::{Deserialize, Serialize};

use crate::judge::{UiJudgeDimension, UiJudgeError, UiJudgeResult};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportPayload {
  pub results: Vec<ReportResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportResult {
  #[serde(skip_serializing_if = "Option::is_none")]
  pub demo_id: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub dimensions: Option<Vec<UiJudgeResult>>,
  pub dimension: UiJudgeDimension,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub error: Option<UiJudgeError>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reason: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub reference: Option<String>,
  pub score: u8,
  pub steps: Vec<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub summary: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub task: Option<String>,
  pub url: String,
}

impl ReportResult {
  pub fn from_visual_result(
    demo_id: String,
    task: String,
    result: UiJudgeResult,
    dimensions: Vec<UiJudgeResult>,
  ) -> Self {
    Self {
      demo_id: Some(demo_id),
      dimensions: (!dimensions.is_empty()).then_some(dimensions),
      dimension: result.dimension,
      error: result.error,
      reason: result.reason,
      reference: result.reference,
      score: result.score,
      steps: result.steps,
      summary: result.summary,
      task: Some(task),
      url: result.url,
    }
  }
}

pub fn format_report_markdown(title: &str, payload: &ReportPayload) -> String {
  let mut lines = vec![
    "<!-- ui-judge-comment -->".to_string(),
    format!("### {}", escape_markdown(title)),
    String::new(),
  ];

  if payload.results.is_empty() {
    lines.push("No UI Judge results were produced.".to_string());
    return lines.join("\n");
  }

  let average = average_score(payload.results.iter().map(|result| result.score));
  if let Some(geqi) = weighted_geqi_score(payload) {
    lines.push(format!(
      "GEQI weighted score: **{} / 100** across {}.",
      format_number(geqi),
      pluralize(payload.results.len(), "example"),
    ));
    lines.push(format!(
      "Average visual-correctness score: **{} / 5**.",
      format_number(average),
    ));
  } else {
    lines.push(format!(
      "Average score: **{} / 5** across {}.",
      format_number(average),
      pluralize(payload.results.len(), "result"),
    ));
  }

  let failed = payload
    .results
    .iter()
    .filter(|result| result.error.is_some())
    .count();
  if failed > 0 {
    lines.push(format!(
      "{} {} an error.",
      failed,
      if failed == 1 {
        "result has"
      } else {
        "results have"
      },
    ));
  }

  lines.extend([
    String::new(),
    "| Example | Visual | GEQI | Status |".to_string(),
    "| --- | ---: | ---: | --- |".to_string(),
  ]);
  for result in &payload.results {
    let label = result
      .demo_id
      .as_deref()
      .or(result.task.as_deref())
      .unwrap_or("result");
    let geqi = result
      .dimensions
      .as_ref()
      .and_then(|dimensions| weighted_dimensions_score(dimensions));
    let status = result
      .error
      .as_ref()
      .map(|error| truncate(&error.message, 120))
      .unwrap_or_else(|| "ok".to_string());
    lines.push(format!(
      "| {} | {} / 5 | {} | {} |",
      escape_table_cell(label),
      result.score,
      geqi
        .map(|score| format!("{} / 100", format_number(score)))
        .unwrap_or_else(|| "-".to_string()),
      escape_table_cell(&status),
    ));
  }

  lines.push(String::new());
  lines.join("\n")
}

fn average_score(scores: impl Iterator<Item = u8>) -> f64 {
  let mut total = 0_f64;
  let mut count = 0_f64;
  for score in scores {
    total += f64::from(score);
    count += 1.0;
  }
  if count == 0.0 {
    0.0
  } else {
    total / count
  }
}

fn weighted_geqi_score(payload: &ReportPayload) -> Option<f64> {
  let scores = payload
    .results
    .iter()
    .filter_map(|result| result.dimensions.as_ref())
    .filter_map(|dimensions| weighted_dimensions_score(dimensions))
    .collect::<Vec<_>>();
  if scores.is_empty() {
    None
  } else {
    Some(scores.iter().sum::<f64>() / scores.len() as f64)
  }
}

fn weighted_dimensions_score(dimensions: &[UiJudgeResult]) -> Option<f64> {
  let mut weighted = 0_f64;
  let mut total_weight = 0_f64;
  for dimension in dimensions {
    let Some(weight) = dimension.weight else {
      continue;
    };
    total_weight += f64::from(weight);
    weighted += (f64::from(dimension.score) / 5.0) * f64::from(weight);
  }
  (total_weight > 0.0).then(|| weighted * 100.0 / total_weight)
}

fn format_number(value: f64) -> String {
  if (value.round() - value).abs() < 0.05 {
    format!("{value:.0}")
  } else {
    format!("{value:.1}")
  }
}

fn pluralize(count: usize, noun: &str) -> String {
  if count == 1 {
    format!("1 {noun}")
  } else {
    format!("{count} {noun}s")
  }
}

fn escape_markdown(value: &str) -> String {
  value.replace('|', "\\|")
}

fn escape_table_cell(value: &str) -> String {
  escape_markdown(value).replace('\n', " ")
}

fn truncate(value: &str, max_chars: usize) -> String {
  if value.chars().count() <= max_chars {
    return value.to_string();
  }
  let mut output = value
    .chars()
    .take(max_chars.saturating_sub(1))
    .collect::<String>();
  output.push('…');
  output
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::judge::{UiJudgeDimension, UiJudgeResult};

  #[test]
  fn formats_weighted_geqi_summary() {
    let payload = ReportPayload {
      results: vec![ReportResult::from_visual_result(
        "demo".to_string(),
        "task".to_string(),
        UiJudgeResult {
          dimension: UiJudgeDimension::VisualCorrectness,
          dimension_label: None,
          error: None,
          reason: None,
          reference: None,
          score: 4,
          steps: vec![],
          summary: None,
          url: "lynx://demo".to_string(),
          weight: None,
        },
        vec![UiJudgeResult {
          dimension: UiJudgeDimension::UsabilityInteraction,
          dimension_label: Some("Usability & Interaction".to_string()),
          error: None,
          reason: None,
          reference: None,
          score: 5,
          steps: vec![],
          summary: None,
          url: "lynx://demo".to_string(),
          weight: Some(30),
        }],
      )],
    };
    let markdown = format_report_markdown("UI Judge", &payload);
    assert!(markdown.contains("GEQI weighted score"));
    assert!(markdown.contains("| demo | 4 / 5 | 100 / 100 | ok |"));
  }
}
