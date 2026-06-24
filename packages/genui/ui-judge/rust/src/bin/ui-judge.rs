// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::path::PathBuf;
use std::time::{Duration, Instant};

use base64::prelude::{Engine, BASE64_STANDARD};
use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use ui_judge::{
  format_report_markdown, judge_android_agent, run_visual_evaluation, ConnectOptions, Lynx,
  ModelApi, ModelClient, ModelOptions, ReportPayload, ScreenshotOptions, UiJudgeDimension,
  VisualEvaluationError, VisualEvaluationErrorCode, VisualEvaluationRequest, GEQI_DIMENSIONS,
};

#[derive(Debug, Parser)]
#[command(name = "ui-judge")]
#[command(about = "Rust Android UI Judge utilities")]
struct Cli {
  #[command(subcommand)]
  command: Command,
}

#[derive(Debug, Subcommand)]
enum Command {
  JudgeAndroidAgent(JudgeAndroidAgentCommand),
  Report(ReportCommand),
  VisualEvaluation(VisualEvaluationCommand),
}

#[derive(Debug, Parser)]
struct JudgeAndroidAgentCommand {
  #[arg(long)]
  scenarios: PathBuf,
  #[arg(long)]
  result_file: PathBuf,
  #[arg(long)]
  comment_file: Option<PathBuf>,
  #[arg(long, default_value = "UI Judge")]
  title: String,
  #[arg(long)]
  device_id: Option<String>,
  #[arg(long, default_value = "com.lynx.explorer")]
  app_package: String,
  #[arg(long, default_value_t = false)]
  clear_data: bool,
  #[arg(long)]
  all_geqi: bool,
  #[arg(long, value_delimiter = ',')]
  dimension: Vec<UiJudgeDimension>,
  #[arg(long)]
  api_key: Option<String>,
  #[arg(long)]
  base_url: Option<String>,
  #[arg(long)]
  model: Option<String>,
  #[arg(long)]
  api: Option<ModelApi>,
  #[arg(long)]
  timeout_ms: Option<u64>,
}

#[derive(Debug, Parser)]
struct ReportCommand {
  #[arg(long)]
  result_file: PathBuf,
  #[arg(long)]
  comment_file: PathBuf,
  #[arg(long, default_value = "UI Judge")]
  title: String,
  #[arg(long)]
  fallback_error: Option<String>,
}

#[derive(Debug, Parser)]
struct VisualEvaluationCommand {
  #[arg(long)]
  request_file: PathBuf,
  #[arg(long)]
  result_file: PathBuf,
  #[arg(long)]
  api_key: Option<String>,
  #[arg(long)]
  base_url: Option<String>,
  #[arg(long)]
  model: Option<String>,
  #[arg(long)]
  api: Option<ModelApi>,
  #[arg(long)]
  timeout_ms: Option<u64>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ScenarioFile {
  scenarios: Vec<JudgeScenario>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JudgeScenario {
  id: String,
  #[serde(default, rename = "name")]
  _name: String,
  url: String,
  task: String,
  #[serde(default)]
  reference: Option<String>,
  #[serde(default)]
  wait_for_text: Vec<String>,
  #[serde(default)]
  timeout_ms: Option<u64>,
  #[serde(default)]
  dimensions: Vec<UiJudgeDimension>,
  #[serde(default)]
  steps: Vec<String>,
}

#[tokio::main(flavor = "multi_thread")]
async fn main() {
  if let Err(error) = run().await {
    eprintln!("{error}");
    std::process::exit(1);
  }
}

async fn run() -> Result<(), Box<dyn std::error::Error>> {
  let cli = Cli::parse();
  match cli.command {
    Command::JudgeAndroidAgent(command) => run_judge_android_agent(command).await,
    Command::Report(command) => run_report(command).await,
    Command::VisualEvaluation(command) => run_visual_evaluation_cli(command).await,
  }
}

async fn run_judge_android_agent(
  command: JudgeAndroidAgentCommand,
) -> Result<(), Box<dyn std::error::Error>> {
  let scenarios = read_scenarios(&command.scenarios).await?;
  let dimensions = command_dimensions(&command);
  let model = ModelClient::new(model_options(&command))?;
  let lynx = Lynx::connect(ConnectOptions {
    app_package: command.app_package,
    clear_data: command.clear_data,
    device_id: command.device_id,
  })
  .await?;
  let mut page = lynx.new_page();
  let mut results = Vec::new();

  for scenario in scenarios {
    let selected_dimensions = scenario_dimensions(&scenario, &dimensions);
    results.push(judge_scenario(&mut page, &model, scenario, selected_dimensions).await);
  }

  let payload = ReportPayload { results };
  write_report_files(
    &command.result_file,
    command.comment_file.as_ref(),
    &command.title,
    &payload,
  )
  .await?;
  Ok(())
}

async fn run_report(command: ReportCommand) -> Result<(), Box<dyn std::error::Error>> {
  let payload = if command.result_file.exists() {
    let content = tokio::fs::read_to_string(&command.result_file).await?;
    serde_json::from_str::<ReportPayload>(&content)?
  } else {
    fallback_payload(command.fallback_error.unwrap_or_else(|| {
      "UI Judge did not produce a model result. See the workflow logs for details.".to_string()
    }))
  };
  write_report_files(
    &command.result_file,
    Some(&command.comment_file),
    &command.title,
    &payload,
  )
  .await?;
  Ok(())
}

async fn run_visual_evaluation_cli(
  command: VisualEvaluationCommand,
) -> Result<(), Box<dyn std::error::Error>> {
  let content = tokio::fs::read_to_string(&command.request_file).await?;
  let request = match serde_json::from_str::<VisualEvaluationRequest>(&content) {
    Ok(request) => request,
    Err(error) => {
      let error = VisualEvaluationError::new(
        400,
        VisualEvaluationErrorCode::InvalidRequest,
        format!("Request body must be valid JSON: {error}"),
      );
      write_visual_error(&command.result_file, &error).await?;
      return Err(Box::new(error));
    }
  };
  let result = match ModelClient::new(visual_model_options(&command)) {
    Ok(model) => run_visual_evaluation(request, &model).await,
    Err(error) => Err(VisualEvaluationError::new(
      502,
      VisualEvaluationErrorCode::EvaluationApiError,
      error.to_string(),
    )),
  };

  match result {
    Ok(response) => {
      write_json_file(&command.result_file, &response).await?;
      Ok(())
    }
    Err(error) => {
      write_visual_error(&command.result_file, &error).await?;
      Err(Box::new(error))
    }
  }
}

async fn judge_scenario(
  page: &mut ui_judge::Page,
  model: &ModelClient,
  scenario: JudgeScenario,
  dimensions: Vec<UiJudgeDimension>,
) -> ui_judge::report::ReportResult {
  if !scenario.steps.is_empty() {
    return scenario_error_result(
      scenario,
      dimensions,
      "Rust UI Judge does not support non-empty natural-language steps yet.",
    );
  }

  let timeout = Duration::from_millis(scenario.timeout_ms.unwrap_or(180_000));
  let navigation = page.goto(&scenario.url, timeout).await;
  if let Err(error) = navigation {
    return scenario_error_result(scenario, dimensions, error.to_string());
  }

  if let Err(error) = wait_for_text(page, &scenario.wait_for_text, timeout).await {
    return scenario_error_result(scenario, dimensions, error);
  }

  let screenshot = match page.screenshot(ScreenshotOptions::default()).await {
    Ok(screenshot) => screenshot,
    Err(error) => return scenario_error_result(scenario, dimensions, error.to_string()),
  };
  let screenshot_data_url = screenshot_data_url(&screenshot);
  let visual_dimension = UiJudgeDimension::VisualCorrectness;
  let visual_result = judge_android_agent(
    model,
    ui_judge::JudgeAndroidAgentRequest {
      dimension: visual_dimension,
      reference: scenario.reference.clone(),
      screenshot_data_url: screenshot_data_url.clone(),
      task: scenario.task.clone(),
      url: scenario.url.clone(),
    },
  )
  .await;
  let mut dimension_results = Vec::new();
  for dimension in dimensions
    .into_iter()
    .filter(|dimension| *dimension != UiJudgeDimension::VisualCorrectness)
  {
    let mut result = judge_android_agent(
      model,
      ui_judge::JudgeAndroidAgentRequest {
        dimension,
        reference: scenario.reference.clone(),
        screenshot_data_url: screenshot_data_url.clone(),
        task: scenario.task.clone(),
        url: scenario.url.clone(),
      },
    )
    .await;
    if let Some(geqi) = GEQI_DIMENSIONS
      .iter()
      .find(|candidate| candidate.dimension == dimension)
    {
      result.dimension_label = Some(geqi.dimension_label.to_string());
      result.weight = Some(geqi.weight);
    }
    dimension_results.push(result);
  }

  ui_judge::report::ReportResult::from_visual_result(
    scenario.id,
    scenario.task,
    visual_result,
    dimension_results,
  )
}

fn scenario_error_result(
  scenario: JudgeScenario,
  dimensions: Vec<UiJudgeDimension>,
  message: impl Into<String>,
) -> ui_judge::report::ReportResult {
  let message = message.into();
  let visual = ui_judge::error_result(
    UiJudgeDimension::VisualCorrectness,
    scenario.reference.clone(),
    scenario.url.clone(),
    message.clone(),
  );
  let dimension_results = dimensions
    .into_iter()
    .filter(|dimension| *dimension != UiJudgeDimension::VisualCorrectness)
    .map(|dimension| {
      let mut result = ui_judge::error_result(
        dimension,
        scenario.reference.clone(),
        scenario.url.clone(),
        message.clone(),
      );
      if let Some(geqi) = GEQI_DIMENSIONS
        .iter()
        .find(|candidate| candidate.dimension == dimension)
      {
        result.dimension_label = Some(geqi.dimension_label.to_string());
        result.weight = Some(geqi.weight);
      }
      result
    })
    .collect();
  ui_judge::report::ReportResult::from_visual_result(
    scenario.id,
    scenario.task,
    visual,
    dimension_results,
  )
}

async fn read_scenarios(path: &PathBuf) -> Result<Vec<JudgeScenario>, Box<dyn std::error::Error>> {
  let content = tokio::fs::read_to_string(path).await?;
  if let Ok(file) = serde_json::from_str::<ScenarioFile>(&content) {
    return Ok(file.scenarios);
  }
  Ok(serde_json::from_str::<Vec<JudgeScenario>>(&content)?)
}

fn command_dimensions(command: &JudgeAndroidAgentCommand) -> Vec<UiJudgeDimension> {
  if !command.dimension.is_empty() {
    return command.dimension.clone();
  }
  if command.all_geqi {
    let mut dimensions = vec![UiJudgeDimension::VisualCorrectness];
    dimensions.extend(GEQI_DIMENSIONS.iter().map(|dimension| dimension.dimension));
    return dimensions;
  }
  vec![UiJudgeDimension::VisualCorrectness]
}

fn scenario_dimensions(
  scenario: &JudgeScenario,
  command_dimensions: &[UiJudgeDimension],
) -> Vec<UiJudgeDimension> {
  if scenario.dimensions.is_empty() {
    command_dimensions.to_vec()
  } else {
    scenario.dimensions.clone()
  }
}

fn model_options(command: &JudgeAndroidAgentCommand) -> ModelOptions {
  let mut options = ModelOptions::from_env();
  if command.api_key.is_some() {
    options.api_key = command.api_key.clone();
  }
  if command.base_url.is_some() {
    options.base_url = command.base_url.clone();
  }
  if command.model.is_some() {
    options.model = command.model.clone();
  }
  if command.api.is_some() {
    options.api = command.api;
  }
  if command.timeout_ms.is_some() {
    options.timeout_ms = command.timeout_ms;
  }
  options
}

fn visual_model_options(command: &VisualEvaluationCommand) -> ModelOptions {
  let mut options = ModelOptions::from_env();
  if command.api_key.is_some() {
    options.api_key = command.api_key.clone();
  }
  if command.base_url.is_some() {
    options.base_url = command.base_url.clone();
  }
  if command.model.is_some() {
    options.model = command.model.clone();
  }
  if command.api.is_some() {
    options.api = command.api;
  }
  if command.timeout_ms.is_some() {
    options.timeout_ms = command.timeout_ms;
  }
  options
}

async fn wait_for_text(
  page: &ui_judge::Page,
  expected: &[String],
  timeout: Duration,
) -> Result<(), String> {
  if expected.is_empty() {
    return Ok(());
  }

  let start = Instant::now();
  let mut latest = String::new();
  while start.elapsed() < timeout {
    match page.content().await {
      Ok(content) => {
        if expected.iter().all(|text| content.contains(text)) {
          return Ok(());
        }
        latest = content.chars().take(500).collect();
      }
      Err(error) => latest = error.to_string(),
    }
    tokio::time::sleep(Duration::from_millis(500)).await;
  }

  Err(format!(
    "timed out waiting for Android content to include {}; latest content: {}",
    expected.join(", "),
    latest,
  ))
}

fn screenshot_data_url(bytes: &[u8]) -> String {
  let mime = match image::guess_format(bytes) {
    Ok(image::ImageFormat::Jpeg) => "image/jpeg",
    Ok(image::ImageFormat::Png) => "image/png",
    Ok(image::ImageFormat::WebP) => "image/webp",
    _ => "image/png",
  };
  format!("data:{mime};base64,{}", BASE64_STANDARD.encode(bytes))
}

async fn write_report_files(
  result_file: &PathBuf,
  comment_file: Option<&PathBuf>,
  title: &str,
  payload: &ReportPayload,
) -> Result<(), Box<dyn std::error::Error>> {
  if let Some(parent) = result_file.parent() {
    tokio::fs::create_dir_all(parent).await?;
  }
  tokio::fs::write(result_file, serde_json::to_string_pretty(payload)? + "\n").await?;

  if let Some(comment_file) = comment_file {
    if let Some(parent) = comment_file.parent() {
      tokio::fs::create_dir_all(parent).await?;
    }
    tokio::fs::write(comment_file, format_report_markdown(title, payload)).await?;
  }

  Ok(())
}

async fn write_json_file<T: Serialize>(
  path: &PathBuf,
  payload: &T,
) -> Result<(), Box<dyn std::error::Error>> {
  if let Some(parent) = path.parent() {
    tokio::fs::create_dir_all(parent).await?;
  }
  tokio::fs::write(path, serde_json::to_string_pretty(payload)? + "\n").await?;
  Ok(())
}

async fn write_visual_error(
  path: &PathBuf,
  error: &VisualEvaluationError,
) -> Result<(), Box<dyn std::error::Error>> {
  write_json_file(path, &error.response()).await
}

fn fallback_payload(message: String) -> ReportPayload {
  let mut dimensions = Vec::new();
  for geqi in GEQI_DIMENSIONS {
    let mut result = ui_judge::error_result(geqi.dimension, None, String::new(), message.clone());
    result.dimension_label = Some(geqi.dimension_label.to_string());
    result.weight = Some(geqi.weight);
    dimensions.push(result);
  }

  ReportPayload {
    results: vec![ui_judge::report::ReportResult::from_visual_result(
      "fallback".to_string(),
      String::new(),
      ui_judge::error_result(
        UiJudgeDimension::VisualCorrectness,
        None,
        String::new(),
        message,
      ),
      dimensions,
    )],
  }
}
