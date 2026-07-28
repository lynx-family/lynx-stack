// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::collections::hash_map::RandomState;
use std::hash::{BuildHasher, Hasher};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Deserialize;
use serde_json::json;
use thiserror::Error;

use crate::judge::{UiJudgeError, UiJudgeResult};
use crate::model::ModelClient;

const DEFAULT_MU: f64 = 25.0;
const DEFAULT_SIGMA: f64 = DEFAULT_MU / 3.0;
// UI-Bench uses a no-draw, no-drift TrueSkill environment. The paper reports
// the standard 25 / 8.33 initialization, so retain TrueSkill's matching
// performance variance beta = mu / 6 and omit the drift term entirely.
const BETA: f64 = DEFAULT_MU / 6.0;
const MIN_CDF: f64 = 1e-12;
const MIN_VARIANCE_FACTOR: f64 = 1e-12;
const VLM_PROXY: &str = "vlm_proxy";

static PAIRWISE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

pub(crate) struct UiBenchRequest<'a> {
  pub candidate_image: &'a str,
  pub candidate_mu: Option<f64>,
  pub candidate_sigma: Option<f64>,
  pub opponent_image: &'a str,
  pub opponent_mu: Option<f64>,
  pub opponent_sigma: Option<f64>,
  pub reference: Option<&'a str>,
  pub task: &'a str,
}

#[derive(Debug)]
pub(crate) struct UiBenchMatch {
  candidate: Rating,
  opponent: Rating,
  reason: Option<String>,
  winner: MatchWinner,
}

#[derive(Debug, Clone, Copy)]
struct Rating {
  mu: f64,
  sigma: f64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MatchWinner {
  Candidate,
  Opponent,
}

impl MatchWinner {
  fn as_str(self) -> &'static str {
    match self {
      Self::Candidate => "candidate",
      Self::Opponent => "opponent",
    }
  }
}

#[derive(Debug, Clone, Copy)]
struct PairOrder {
  candidate_first: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ModelWinner {
  ProjectA,
  ProjectB,
}

#[derive(Debug, Deserialize)]
struct PairwiseModelResult {
  #[serde(default)]
  reason: String,
  winner: ModelWinner,
}

#[derive(Debug, Error)]
enum UiBenchError {
  #[error("UI-Bench pairwise result must be valid JSON: {0}")]
  InvalidJson(String),
  #[error(
    "UI-Bench {participant} rating requires both mu and sigma, or neither to use the paper defaults"
  )]
  IncompleteRating { participant: &'static str },
  #[error("UI-Bench {participant} mu must be finite")]
  InvalidMu { participant: &'static str },
  #[error("UI-Bench {participant} sigma must be finite and greater than zero")]
  InvalidSigma { participant: &'static str },
  #[error("UI-Bench TrueSkill update produced non-finite rating state")]
  InvalidRatingUpdate,
}

pub(crate) async fn evaluate_ui_bench(
  client: &ModelClient,
  request: UiBenchRequest<'_>,
) -> Result<UiBenchMatch, String> {
  evaluate_ui_bench_with_order(client, request, next_pair_order()).await
}

async fn evaluate_ui_bench_with_order(
  client: &ModelClient,
  request: UiBenchRequest<'_>,
  order: PairOrder,
) -> Result<UiBenchMatch, String> {
  let candidate = rating("candidate", request.candidate_mu, request.candidate_sigma)
    .map_err(|error| error.to_string())?;
  let opponent = rating("opponent", request.opponent_mu, request.opponent_sigma)
    .map_err(|error| error.to_string())?;
  let prompt = build_pairwise_prompt(request.task, request.reference);
  let images = if order.candidate_first {
    [request.candidate_image, request.opponent_image]
  } else {
    [request.opponent_image, request.candidate_image]
  };
  let raw = client
    .evaluate_structured(
      "You are a strict JSON-only evaluator conducting a blinded UI-Bench pairwise preference vote. Return exactly one winner and never return a tie.",
      &prompt,
      &images,
      "ui_bench_pairwise_vote",
      pairwise_schema(),
    )
    .await
    .map_err(|error| error.to_string())?;
  let model_result = parse_pairwise_result(&raw).map_err(|error| error.to_string())?;
  let first_won = matches!(model_result.winner, ModelWinner::ProjectA);
  let winner = if first_won == order.candidate_first {
    MatchWinner::Candidate
  } else {
    MatchWinner::Opponent
  };
  let (candidate, opponent) =
    update_ratings(candidate, opponent, winner).map_err(|error| error.to_string())?;

  Ok(UiBenchMatch {
    candidate,
    opponent,
    reason: non_empty(model_result.reason),
    winner,
  })
}

pub(crate) fn apply_ui_bench_result(
  result: &mut UiJudgeResult,
  opponent_url: String,
  ui_bench: Result<UiBenchMatch, String>,
) {
  result.ui_bench_evaluator = Some(VLM_PROXY.to_string());
  result.ui_bench_opponent_url = Some(opponent_url);
  match ui_bench {
    Ok(ui_bench) => {
      result.ui_bench_candidate_mu = Some(ui_bench.candidate.mu);
      result.ui_bench_candidate_sigma = Some(ui_bench.candidate.sigma);
      result.ui_bench_error = None;
      result.ui_bench_opponent_mu = Some(ui_bench.opponent.mu);
      result.ui_bench_opponent_sigma = Some(ui_bench.opponent.sigma);
      result.ui_bench_reason = ui_bench.reason;
      result.ui_bench_winner = Some(ui_bench.winner.as_str().to_string());
    }
    Err(message) => {
      result.ui_bench_candidate_mu = None;
      result.ui_bench_candidate_sigma = None;
      result.ui_bench_error = Some(UiJudgeError { message });
      result.ui_bench_opponent_mu = None;
      result.ui_bench_opponent_sigma = None;
      result.ui_bench_reason = None;
      result.ui_bench_winner = None;
    }
  }
}

fn build_pairwise_prompt(task: &str, reference: Option<&str>) -> String {
  let reference = reference
    .filter(|value| !value.trim().is_empty())
    .map(|value| format!("\nAdditional textual target:\n{value}\n"))
    .unwrap_or_default();

  format!(
    r#"The two attached images are anonymized candidates generated for the same client brief. The first image is Project A and the second image is Project B.

Client brief:
{task}
{reference}
Inspect both supplied project views before voting. Make one holistic professional judgment by answering:
"Which project would you be more likely to deliver to a client?"

Judge only visible UI and UX completeness in the supplied views. Do not infer tool identity, hidden behavior, code quality, accessibility metadata, responsiveness outside the captures, or unseen states. Do not reward visual intensity, animation, decoration, or content volume by themselves.

Return valid JSON only:
{{
  "winner": "project_a" or "project_b",
  "reason": "one concise sentence explaining the decisive visible difference"
}}

There is no tie option. Do not return an absolute score, Markdown, or prose outside JSON."#,
    task = task.trim(),
  )
}

fn pairwise_schema() -> serde_json::Value {
  json!({
    "type": "object",
    "properties": {
      "winner": {
        "type": "string",
        "enum": ["project_a", "project_b"]
      },
      "reason": { "type": "string" }
    },
    "required": ["winner", "reason"],
    "additionalProperties": false
  })
}

fn parse_pairwise_result(raw: &str) -> Result<PairwiseModelResult, UiBenchError> {
  serde_json::from_str(raw).map_err(|error| UiBenchError::InvalidJson(error.to_string()))
}

fn rating(
  participant: &'static str,
  mu: Option<f64>,
  sigma: Option<f64>,
) -> Result<Rating, UiBenchError> {
  let (mu, sigma) = match (mu, sigma) {
    (None, None) => (DEFAULT_MU, DEFAULT_SIGMA),
    (Some(mu), Some(sigma)) => (mu, sigma),
    _ => return Err(UiBenchError::IncompleteRating { participant }),
  };
  if !mu.is_finite() {
    return Err(UiBenchError::InvalidMu { participant });
  }
  if !sigma.is_finite() || sigma <= 0.0 {
    return Err(UiBenchError::InvalidSigma { participant });
  }
  Ok(Rating { mu, sigma })
}

fn update_ratings(
  candidate: Rating,
  opponent: Rating,
  winner: MatchWinner,
) -> Result<(Rating, Rating), UiBenchError> {
  let (winner_rating, loser_rating) = match winner {
    MatchWinner::Candidate => (candidate, opponent),
    MatchWinner::Opponent => (opponent, candidate),
  };
  let c = winner_rating
    .sigma
    .hypot(loser_rating.sigma)
    .hypot(std::f64::consts::SQRT_2 * BETA);
  let t = (winner_rating.mu - loser_rating.mu) / c;
  let v = standard_normal_pdf(t) / standard_normal_cdf(t).max(MIN_CDF);
  let w = v * (v + t);
  let winner_scale = winner_rating.sigma / c;
  let loser_scale = loser_rating.sigma / c;
  let winner_updated = Rating {
    mu: winner_rating.mu + winner_rating.sigma * winner_scale * v,
    sigma: winner_rating.sigma
      * (1.0 - winner_scale.powi(2) * w)
        .max(MIN_VARIANCE_FACTOR)
        .sqrt(),
  };
  let loser_updated = Rating {
    mu: loser_rating.mu - loser_rating.sigma * loser_scale * v,
    sigma: loser_rating.sigma
      * (1.0 - loser_scale.powi(2) * w)
        .max(MIN_VARIANCE_FACTOR)
        .sqrt(),
  };

  let updated = match winner {
    MatchWinner::Candidate => (winner_updated, loser_updated),
    MatchWinner::Opponent => (loser_updated, winner_updated),
  };
  if [updated.0.mu, updated.0.sigma, updated.1.mu, updated.1.sigma]
    .into_iter()
    .all(f64::is_finite)
  {
    Ok(updated)
  } else {
    Err(UiBenchError::InvalidRatingUpdate)
  }
}

fn standard_normal_pdf(value: f64) -> f64 {
  (-value.powi(2) / 2.0).exp() / (2.0 * std::f64::consts::PI).sqrt()
}

fn standard_normal_cdf(value: f64) -> f64 {
  let absolute = value.abs();
  let k = 1.0 / (1.0 + 0.231_641_9 * absolute);
  let polynomial = k
    * (0.319_381_530
      + k * (-0.356_563_782 + k * (1.781_477_937 + k * (-1.821_255_978 + k * 1.330_274_429))));
  let positive_cdf = 1.0 - standard_normal_pdf(absolute) * polynomial;
  if value >= 0.0 {
    positive_cdf
  } else {
    1.0 - positive_cdf
  }
}

fn next_pair_order() -> PairOrder {
  let sequence = PAIRWISE_SEQUENCE.fetch_add(1, Ordering::Relaxed);
  let time_entropy = SystemTime::now()
    .duration_since(UNIX_EPOCH)
    .map(|duration| duration.as_nanos() as u64)
    .unwrap_or_default();
  let mut entropy = RandomState::new().build_hasher();
  entropy.write_u64(time_entropy);
  entropy.write_u64(sequence);
  PairOrder {
    candidate_first: entropy.finish().is_multiple_of(2),
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
  use crate::judge::error_result;

  #[test]
  fn prompt_uses_the_paper_pairwise_question_without_an_absolute_score() {
    let prompt = build_pairwise_prompt("Build a booking app.", Some("Use the client brief."));

    assert!(prompt.contains("Which project would you be more likely to deliver to a client?"));
    assert!(prompt.contains("Project A"));
    assert!(prompt.contains("Project B"));
    assert!(prompt.contains("There is no tie option"));
    assert!(prompt.contains("Use the client brief."));
    assert!(!prompt.contains("0-5"));
  }

  #[tokio::test]
  async fn maps_blinded_project_labels_back_to_the_candidate() {
    let client =
      ModelClient::mock(r#"{"winner":"project_b","reason":"Project B is more complete."}"#);
    let result = evaluate_ui_bench_with_order(
      &client,
      UiBenchRequest {
        candidate_image: "data:image/png;base64,candidate",
        candidate_mu: None,
        candidate_sigma: None,
        opponent_image: "data:image/png;base64,opponent",
        opponent_mu: None,
        opponent_sigma: None,
        reference: None,
        task: "Build a booking app.",
      },
      PairOrder {
        candidate_first: false,
      },
    )
    .await
    .expect("evaluate blinded pair");

    assert_eq!(result.winner, MatchWinner::Candidate);
    assert_eq!(
      result.reason.as_deref(),
      Some("Project B is more complete.")
    );
  }

  #[test]
  fn updates_prompt_specific_trueskill_after_a_forced_choice() {
    let initial = Rating {
      mu: DEFAULT_MU,
      sigma: DEFAULT_SIGMA,
    };
    let (candidate, opponent) =
      update_ratings(initial, initial, MatchWinner::Candidate).expect("update valid ratings");

    assert!((candidate.mu - 29.205).abs() < 0.01);
    assert!((candidate.sigma - 7.194).abs() < 0.01);
    assert!((opponent.mu - 20.795).abs() < 0.01);
    assert!((opponent.sigma - 7.194).abs() < 0.01);
  }

  #[test]
  fn rejects_partial_or_invalid_rating_state() {
    assert!(matches!(
      rating("candidate", Some(25.0), None),
      Err(UiBenchError::IncompleteRating { .. })
    ));
    assert!(matches!(
      rating("candidate", Some(f64::NAN), Some(8.33)),
      Err(UiBenchError::InvalidMu { .. })
    ));
    assert!(matches!(
      rating("candidate", Some(25.0), Some(0.0)),
      Err(UiBenchError::InvalidSigma { .. })
    ));
    let extreme_candidate = Rating {
      mu: f64::MAX,
      sigma: f64::MAX,
    };
    let extreme_opponent = Rating {
      mu: -f64::MAX,
      sigma: f64::MAX,
    };
    assert!(matches!(
      update_ratings(extreme_candidate, extreme_opponent, MatchWinner::Candidate),
      Err(UiBenchError::InvalidRatingUpdate)
    ));
  }

  #[test]
  fn pairwise_errors_do_not_replace_the_primary_dimension() {
    let mut result = error_result(None, "file:///candidate".to_string(), "primary error");
    apply_ui_bench_result(
      &mut result,
      "file:///opponent".to_string(),
      Err("pairwise error".to_string()),
    );

    assert_eq!(
      result.error.as_ref().map(|error| error.message.as_str()),
      Some("primary error")
    );
    assert_eq!(
      result
        .ui_bench_error
        .as_ref()
        .map(|error| error.message.as_str()),
      Some("pairwise error")
    );
    assert_eq!(result.ui_bench_evaluator.as_deref(), Some(VLM_PROXY));
    assert_eq!(
      result.ui_bench_opponent_url.as_deref(),
      Some("file:///opponent")
    );
  }
}
