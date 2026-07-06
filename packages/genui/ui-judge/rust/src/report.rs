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
