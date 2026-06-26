// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

mod adb;
mod api;
mod judge;
mod model;
mod protocol;
pub mod report;
mod transport;
mod visual;

pub use api::{ConnectOptions, Element, Error, Lynx, Page, Result, ScreenshotOptions};
pub use judge::{
  build_judge_prompt, error_result, judge_android_agent, parse_model_result, DimensionPrompt,
  JudgeAndroidAgentRequest, JudgeModelResult, UiJudgeDimension, UiJudgeError, UiJudgeResult,
  UiJudgeScore, GEQI_DIMENSIONS,
};
pub use model::{ModelApi, ModelClient, ModelOptions};
pub use protocol::{BoxModel, ComputedStyleProperty, NodeInfo, Session};
pub use report::{ReportPayload, ReportResult};
pub use visual::{
  parse_visual_model_result, run_visual_evaluation, AlignCrop, AlignResult, CompareDiffBlock,
  CompareResult, EvaluationIssue, EvaluationResult, VisualEvaluationAlignOptions,
  VisualEvaluationArtifacts, VisualEvaluationCompareOptions, VisualEvaluationError,
  VisualEvaluationErrorCode, VisualEvaluationErrorResponse, VisualEvaluationMetrics,
  VisualEvaluationRequest, VisualEvaluationResponse, VISUAL_EVALUATION_SYSTEM_PROMPT,
  VISUAL_EVALUATION_USER_PROMPT,
};
