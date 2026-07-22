// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::path::{Path, PathBuf};
use std::time::Duration;

use ui_judge::{judge_page, JudgePageRequest};

#[tokio::test(flavor = "current_thread")]
async fn drives_and_judges_the_existing_headless_runner_page_with_the_real_model() {
  assert!(
    std::env::var_os("UI_JUDGE_MODEL_RESPONSE_JSON").is_none()
      && std::env::var_os("UI_JUDGE_MODEL_RESPONSES_JSON").is_none(),
    "headless_e2e must call the configured real model; unset UI_JUDGE_MODEL_RESPONSE_JSON and UI_JUDGE_MODEL_RESPONSES_JSON"
  );
  if !real_model_credentials_configured() {
    eprintln!(
      "skipping headless_e2e: no real-model API key is configured through the supported environment"
    );
    return;
  }

  let bundle = fixture_bundle();
  assert!(
    bundle.is_file(),
    "build the fixture before the test: {}",
    bundle.display()
  );

  let previous_lynx_core = std::env::var_os("LYNX_CORE_JS_PATH");
  // The runner owns this fixture, but its generic `Lynx::connect` API still
  // requires callers to select the bundled core through options or this env.
  std::env::set_var("LYNX_CORE_JS_PATH", fixture_lynx_core());
  let result = judge_page(JudgePageRequest {
    reference: None,
    reference_image: None,
    screenshot_settle: Duration::from_millis(16),
    steps: vec!["Tap the Lynx logo to switch it to React.".to_string()],
    task: "Render the React Lynx welcome screen.".to_string(),
    timeout: Duration::from_secs(120),
    url: fixture_url(&bundle),
  })
  .await;
  restore_env("LYNX_CORE_JS_PATH", previous_lynx_core);

  assert!(
    result.error.is_none(),
    "unexpected error: {:?}",
    result.error
  );
  assert!(result.score <= 5, "unexpected score: {}", result.score);
  assert!(
    result
      .reason
      .as_deref()
      .is_some_and(|reason| !reason.trim().is_empty()),
    "the real model returned no reason"
  );
  assert!(
    result
      .summary
      .as_deref()
      .is_some_and(|summary| !summary.trim().is_empty()),
    "the real model returned no summary"
  );
  assert_eq!(result.steps, ["Tap the Lynx logo to switch it to React."]);
  assert_eq!(result.url, fixture_url(&bundle));
}

fn fixture_bundle() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/react/.generated/main.lynx.bundle")
}

fn fixture_lynx_core() -> PathBuf {
  Path::new(env!("CARGO_MANIFEST_DIR"))
    .join("../../lynx/headless-rust-test-runner/fixtures/react/lynx_core.js")
}

fn fixture_url(bundle: &Path) -> String {
  format!("file://{}", bundle.display())
}

fn real_model_credentials_configured() -> bool {
  [
    "MIDSCENE_MODEL_API_KEY",
    "OPENAI_API_KEY",
    "MIDSCENE_MODEL_INIT_CONFIG_JSON",
    "MIDSCENE_OPENAI_INIT_CONFIG_JSON",
    "OPENAI_INIT_CONFIG_JSON",
  ]
  .iter()
  .any(|name| std::env::var(name).is_ok_and(|value| !value.trim().is_empty()))
}

fn restore_env(name: &str, value: Option<std::ffi::OsString>) {
  if let Some(value) = value {
    std::env::set_var(name, value);
  } else {
    std::env::remove_var(name);
  }
}
