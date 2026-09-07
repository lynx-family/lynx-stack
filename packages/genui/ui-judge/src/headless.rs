// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::path::PathBuf;
use std::time::Duration;

use lynx_headless_rust_test_runner::{GotoOptions, LynxContainer, ScreenshotOptions};
use thiserror::Error;

use crate::capture::shared_workers;

/// Options for capturing a trusted Lynx page without model evaluation.
#[derive(Debug, Clone)]
pub struct CapturePageRequest {
  pub url: String,
  pub screenshot_settle: Duration,
  pub timeout: Duration,
  pub global_props_json: Option<String>,
  pub initial_data_json: Option<String>,
}

impl Default for CapturePageRequest {
  fn default() -> Self {
    Self {
      url: String::new(),
      screenshot_settle: Duration::from_millis(16),
      timeout: Duration::from_secs(60),
      global_props_json: None,
      initial_data_json: None,
    }
  }
}

#[derive(Debug, Clone, Error, serde::Serialize)]
#[error("{message}")]
pub struct CapturePageError {
  pub message: String,
}

pub(crate) struct CapturedPage {
  screenshot: Vec<u8>,
}

impl CapturedPage {
  pub(crate) fn from_bmp(screenshot: Vec<u8>) -> Self {
    Self { screenshot }
  }

  pub(crate) fn into_bmp(self) -> Vec<u8> {
    self.screenshot
  }
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub(crate) struct PageLoadOptions {
  pub(crate) base_dir: Option<PathBuf>,
  pub(crate) global_props_json: Option<String>,
  pub(crate) initial_data_json: Option<String>,
}

/// Capture a file://, http://, or https:// page as an uncompressed BMP.
/// Native work stays on the process-wide container-owning worker.
pub async fn capture_page(mut request: CapturePageRequest) -> Result<Vec<u8>, CapturePageError> {
  request.url = request.url.trim().to_string();
  let url = reqwest::Url::parse(&request.url).map_err(|_| {
    page_request_error("capture_page requires a file://, http://, or https:// URL.")
  })?;
  if !matches!(url.scheme(), "file" | "http" | "https") || request.timeout.is_zero() {
    return Err(page_request_error(
      "capture_page requires a supported URL and positive timeout.",
    ));
  }
  let load_options = PageLoadOptions {
    global_props_json: request.global_props_json.clone(),
    initial_data_json: request.initial_data_json.clone(),
    ..PageLoadOptions::default()
  };
  let workers = shared_workers().map_err(|error| page_request_error(error))?;
  let response = workers
    .capture(request, load_options)
    .await
    .map_err(|error| page_request_error(error.to_string()))?;
  response.capture.map(CapturedPage::into_bmp)
}

pub(crate) fn page_request_error(message: impl Into<String>) -> CapturePageError {
  CapturePageError {
    message: message.into(),
  }
}

pub(crate) fn capture_with_container(
  container: &LynxContainer,
  request: &CapturePageRequest,
  load_options: &PageLoadOptions,
) -> Result<CapturedPage, CapturePageError> {
  let mut page = container
    .new_page()
    .map_err(|error| page_request_error(error.to_string()))?;
  page
    .goto(
      &request.url,
      GotoOptions {
        base_dir: load_options.base_dir.clone(),
        global_props_json: load_options.global_props_json.clone(),
        initial_data_json: load_options.initial_data_json.clone(),
        timeout: Some(request.timeout),
      },
    )
    .map_err(|error| page_request_error(error.to_string()))?;
  let screenshot = page
    .screenshot(ScreenshotOptions {
      path: None,
      settle: request.screenshot_settle,
    })
    .map_err(|error| page_request_error(error.to_string()))?;
  Ok(CapturedPage::from_bmp(screenshot))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[tokio::test]
  async fn rejects_paths_and_unsupported_schemes_before_starting_native_work() {
    for url in [
      "",
      "/tmp/page.js",
      "zip:///page.js",
      "ftp://example.com/page.js",
    ] {
      assert!(capture_page(CapturePageRequest {
        url: url.into(),
        ..Default::default()
      })
      .await
      .is_err());
    }
  }
}
