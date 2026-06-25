// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus};
use std::time::{SystemTime, UNIX_EPOCH};

use base64::prelude::{Engine, BASE64_STANDARD};
use serde_json::{json, Value};

const MOCK_MODEL_RESPONSE: &str = r#"{
  "extra": "preserved",
  "issues": [
    {
      "category": "layout",
      "description": "The rendered screenshot is visually aligned.",
      "severity": "low"
    }
  ],
  "reason": "mocked evaluation",
  "score": 0.91,
  "summary": "The render is close to the reference."
}"#;

#[test]
fn evaluates_base64_images() {
  let image = fixture_image_base64();
  let run = run_visual_evaluation_cli(json!({
    "referenceImage": image,
    "renderedImage": image,
  }));

  assert!(
    run.status.success(),
    "expected CLI success\nstdout:\n{}\nstderr:\n{}",
    run.stdout,
    run.stderr
  );
  assert_eq!(run.result["ok"], true);
  assert_eq!(run.result["reason"], "mocked evaluation");
  assert_eq!(run.result["score"], 0.91);
  assert_non_empty_string(&run.result["artifacts"]["referenceImageBase64"]);
  assert_non_empty_string(&run.result["artifacts"]["renderedImageBase64"]);
  assert_non_empty_string(&run.result["artifacts"]["alignedReferenceImageBase64"]);
  assert_non_empty_string(&run.result["artifacts"]["alignedRenderedImageBase64"]);
  assert_non_empty_string(&run.result["artifacts"]["diffImageBase64"]);
  assert!(
    run.result["metrics"]["compareResult"]["similarity"]
      .as_f64()
      .expect("similarity is numeric")
      >= 0.0
  );
  assert_eq!(
    run.result["metrics"]["evaluationResult"]["extra"],
    "preserved"
  );
}

#[test]
fn accepts_data_url_images() {
  let image = fixture_image_base64();
  let run = run_visual_evaluation_cli(json!({
    "referenceImage": format!("data:image/png;base64,{image}"),
    "renderedImage": format!("data:image/png;base64,{image}"),
  }));

  assert!(
    run.status.success(),
    "expected CLI success\nstdout:\n{}\nstderr:\n{}",
    run.stdout,
    run.stderr
  );
  assert_eq!(run.result["score"], 0.91);
}

#[test]
fn writes_invalid_request_errors() {
  let run = run_visual_evaluation_cli(json!({}));

  assert!(
    !run.status.success(),
    "expected CLI failure\nstdout:\n{}\nstderr:\n{}",
    run.stdout,
    run.stderr
  );
  assert_eq!(run.result["ok"], false);
  assert_eq!(run.result["code"], "INVALID_REQUEST");
  assert_eq!(run.result["status"], 400);
}

#[test]
fn writes_invalid_rendered_image_errors() {
  let image = fixture_image_base64();
  let run = run_visual_evaluation_cli(json!({
    "referenceImage": image,
    "renderedImage": "not-an-image",
  }));

  assert!(
    !run.status.success(),
    "expected CLI failure\nstdout:\n{}\nstderr:\n{}",
    run.stdout,
    run.stderr
  );
  assert_eq!(run.result["ok"], false);
  assert_eq!(run.result["code"], "RENDERED_IMAGE_INVALID");
  assert_eq!(run.result["status"], 400);
}

struct CliRun {
  result: Value,
  status: ExitStatus,
  stderr: String,
  stdout: String,
}

struct TempWorkspace {
  path: PathBuf,
}

impl TempWorkspace {
  fn new(test_name: &str) -> Self {
    let nanos = SystemTime::now()
      .duration_since(UNIX_EPOCH)
      .expect("system clock is after unix epoch")
      .as_nanos();
    let path = std::env::temp_dir().join(format!(
      "ui-judge-{test_name}-{}-{nanos}",
      std::process::id()
    ));
    fs::create_dir_all(&path)
      .unwrap_or_else(|error| panic!("create temp workspace {}: {error}", path.display()));
    Self { path }
  }
}

impl Drop for TempWorkspace {
  fn drop(&mut self) {
    let _ = fs::remove_dir_all(&self.path);
  }
}

fn run_visual_evaluation_cli(request: Value) -> CliRun {
  let workspace = TempWorkspace::new("visual-evaluation-cli");
  let request_file = workspace.path.join("request.json");
  let result_file = workspace.path.join("result.json");
  fs::write(&request_file, request.to_string())
    .unwrap_or_else(|error| panic!("write request file {}: {error}", request_file.display()));

  let output = Command::new(env!("CARGO_BIN_EXE_ui-judge"))
    .arg("visual-evaluation")
    .arg("--request-file")
    .arg(&request_file)
    .arg("--result-file")
    .arg(&result_file)
    .env("UI_JUDGE_MODEL_RESPONSE_JSON", MOCK_MODEL_RESPONSE)
    .output()
    .expect("run ui-judge visual-evaluation");
  let stdout = String::from_utf8_lossy(&output.stdout).into_owned();
  let stderr = String::from_utf8_lossy(&output.stderr).into_owned();
  let result_content = fs::read_to_string(&result_file).unwrap_or_else(|error| {
    panic!(
      "read visual evaluation result file {}\nstdout:\n{stdout}\nstderr:\n{stderr}\nerror: {error}",
      result_file.display()
    )
  });
  let result = serde_json::from_str(&result_content)
    .unwrap_or_else(|error| panic!("parse visual evaluation result JSON: {error}"));

  CliRun {
    result,
    status: output.status,
    stderr,
    stdout,
  }
}

fn fixture_image_base64() -> String {
  BASE64_STANDARD.encode(fs::read(fixture_image_path()).expect("read fixture image"))
}

fn fixture_image_path() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/react/src/assets/arrow.png")
}

fn assert_non_empty_string(value: &Value) {
  assert!(!value
    .as_str()
    .expect("expected JSON value to be a string")
    .is_empty());
}
