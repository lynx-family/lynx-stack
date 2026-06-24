// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::time::Duration;

use clap::ValueEnum;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use thiserror::Error;

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS: u64 = 120_000;
const SYSTEM_PROMPT: &str =
  "You are a strict JSON-only UI judge. Return only valid JSON matching the requested schema.";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ValueEnum)]
#[serde(rename_all = "lowercase")]
pub enum ModelApi {
  Chat,
  Responses,
}

#[derive(Debug, Clone)]
pub struct ModelOptions {
  pub api: Option<ModelApi>,
  pub api_key: Option<String>,
  pub base_url: Option<String>,
  pub model: Option<String>,
  pub timeout_ms: Option<u64>,
}

impl ModelOptions {
  pub fn from_env() -> Self {
    Self {
      api: read_api_env(),
      api_key: first_env(&[
        "A2UI_BENCH_JUDGE_API_KEY",
        "OPENAI_API_KEY",
        "MIDSCENE_MODEL_API_KEY",
      ]),
      base_url: first_env(&[
        "A2UI_BENCH_JUDGE_BASE_URL",
        "OPENAI_BASE_URL",
        "MIDSCENE_MODEL_BASE_URL",
      ]),
      model: first_env(&[
        "A2UI_BENCH_JUDGE_MODEL",
        "JUDGE_MODEL",
        "OPENAI_MODEL",
        "MIDSCENE_MODEL_NAME",
      ]),
      timeout_ms: first_env(&[
        "A2UI_BENCH_JUDGE_TIMEOUT_MS",
        "JUDGE_TIMEOUT_MS",
        "MIDSCENE_MODEL_TIMEOUT",
      ])
      .and_then(|value| value.parse::<u64>().ok()),
    }
  }
}

#[derive(Debug, Clone)]
pub struct ModelClient {
  api: ModelApi,
  api_key: String,
  base_url: String,
  client: Client,
  model: String,
}

#[derive(Debug, Error)]
pub enum ModelError {
  #[error("OpenAI credentials not provided: set OPENAI_API_KEY, A2UI_BENCH_JUDGE_API_KEY, or MIDSCENE_MODEL_API_KEY")]
  MissingApiKey,
  #[error("model API request failed: {0}")]
  Request(#[from] reqwest::Error),
  #[error("model API returned HTTP {status}: {body}")]
  Http { status: u16, body: String },
  #[error("model API response did not contain text output")]
  MissingOutput,
}

impl ModelClient {
  pub fn new(options: ModelOptions) -> Result<Self, ModelError> {
    let api_key = options.api_key.ok_or(ModelError::MissingApiKey)?;
    let base_url = normalize_base_url(
      options
        .base_url
        .unwrap_or_else(|| DEFAULT_BASE_URL.to_string()),
    );
    let api = options.api.unwrap_or_else(|| {
      if is_official_openai_base_url(&base_url) {
        ModelApi::Responses
      } else {
        ModelApi::Chat
      }
    });
    let timeout = Duration::from_millis(options.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let client = Client::builder().timeout(timeout).build()?;

    Ok(Self {
      api,
      api_key,
      base_url,
      client,
      model: options.model.unwrap_or_else(|| DEFAULT_MODEL.to_string()),
    })
  }

  pub async fn evaluate(
    &self,
    prompt: &str,
    screenshot_data_url: &str,
  ) -> Result<String, ModelError> {
    match self.api {
      ModelApi::Chat => self.evaluate_chat(prompt, screenshot_data_url).await,
      ModelApi::Responses => self.evaluate_responses(prompt, screenshot_data_url).await,
    }
  }

  async fn evaluate_chat(
    &self,
    prompt: &str,
    screenshot_data_url: &str,
  ) -> Result<String, ModelError> {
    let body = json!({
      "model": self.model,
      "messages": [
        { "role": "system", "content": SYSTEM_PROMPT },
        {
          "role": "user",
          "content": [
            { "type": "text", "text": prompt },
            { "type": "image_url", "image_url": { "url": screenshot_data_url } }
          ]
        }
      ],
      "temperature": 0
    });
    let response = self.post_json(chat_endpoint(&self.base_url), body).await?;
    extract_chat_text(&response).ok_or(ModelError::MissingOutput)
  }

  async fn evaluate_responses(
    &self,
    prompt: &str,
    screenshot_data_url: &str,
  ) -> Result<String, ModelError> {
    let body = json!({
      "model": self.model,
      "input": [
        {
          "role": "system",
          "content": [{ "type": "input_text", "text": SYSTEM_PROMPT }]
        },
        {
          "role": "user",
          "content": [
            { "type": "input_text", "text": prompt },
            { "type": "input_image", "image_url": screenshot_data_url }
          ]
        }
      ],
      "temperature": 0
    });
    let response = self
      .post_json(format!("{}/responses", self.base_url), body)
      .await?;
    extract_responses_text(&response).ok_or(ModelError::MissingOutput)
  }

  async fn post_json(&self, endpoint: String, body: Value) -> Result<Value, ModelError> {
    let mut request = self.client.post(endpoint).json(&body);
    if uses_query_ak_auth(&self.base_url) {
      request = request.query(&[("ak", self.api_key.as_str())]);
    } else {
      request = request.bearer_auth(&self.api_key);
    }

    let response = request.send().await?;
    let status = response.status();
    let text = response.text().await?;
    if !status.is_success() {
      return Err(ModelError::Http {
        status: status.as_u16(),
        body: text,
      });
    }

    serde_json::from_str(&text).map_err(|error| ModelError::Http {
      status: status.as_u16(),
      body: format!("invalid JSON response: {error}; body: {text}"),
    })
  }
}

fn read_api_env() -> Option<ModelApi> {
  first_env(&["A2UI_BENCH_JUDGE_API", "OPENAI_API_STYLE"]).and_then(|value| match value.as_str() {
    "chat" => Some(ModelApi::Chat),
    "responses" => Some(ModelApi::Responses),
    _ => None,
  })
}

fn first_env(names: &[&str]) -> Option<String> {
  names.iter().find_map(|name| {
    std::env::var(name)
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
  })
}

fn normalize_base_url(mut value: String) -> String {
  while value.ends_with('/') {
    value.pop();
  }
  value = value
    .trim_end_matches("/chat/completions")
    .trim_end_matches("/responses")
    .to_string();
  value
}

fn chat_endpoint(base_url: &str) -> String {
  if uses_query_ak_auth(base_url) {
    base_url.to_string()
  } else {
    format!("{base_url}/chat/completions")
  }
}

fn uses_query_ak_auth(endpoint: &str) -> bool {
  endpoint.trim_end_matches('/').ends_with("/crawl")
}

fn is_official_openai_base_url(base_url: &str) -> bool {
  base_url
    .strip_prefix("https://")
    .or_else(|| base_url.strip_prefix("http://"))
    .and_then(|rest| rest.split('/').next())
    .is_some_and(|host| host.eq_ignore_ascii_case("api.openai.com"))
}

fn extract_chat_text(value: &Value) -> Option<String> {
  value
    .get("choices")?
    .as_array()?
    .first()?
    .get("message")?
    .get("content")
    .and_then(extract_text_value)
}

fn extract_responses_text(value: &Value) -> Option<String> {
  if let Some(text) = value.get("output_text").and_then(Value::as_str) {
    return Some(text.to_string());
  }

  let output = value.get("output")?.as_array()?;
  let mut parts = Vec::new();
  for item in output {
    let Some(content) = item.get("content").and_then(Value::as_array) else {
      continue;
    };
    for part in content {
      if let Some(text) = part
        .get("text")
        .or_else(|| part.get("value"))
        .and_then(Value::as_str)
      {
        parts.push(text.to_string());
      }
    }
  }
  (!parts.is_empty()).then(|| parts.join("\n"))
}

fn extract_text_value(value: &Value) -> Option<String> {
  if let Some(text) = value.as_str() {
    return Some(text.to_string());
  }

  let array = value.as_array()?;
  let parts = array
    .iter()
    .filter_map(|item| item.get("text").and_then(Value::as_str))
    .map(str::to_string)
    .collect::<Vec<_>>();
  (!parts.is_empty()).then(|| parts.join("\n"))
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn normalizes_openai_endpoint() {
    assert_eq!(
      normalize_base_url("https://example.com/v1/chat/completions".to_string()),
      "https://example.com/v1"
    );
    assert_eq!(
      chat_endpoint("https://example.com/v1"),
      "https://example.com/v1/chat/completions"
    );
    assert_eq!(
      chat_endpoint("https://example.com/crawl"),
      "https://example.com/crawl"
    );
  }

  #[test]
  fn extracts_chat_text() {
    let value = json!({
      "choices": [{ "message": { "content": "{\"score\": 4}" } }]
    });
    assert_eq!(extract_chat_text(&value).as_deref(), Some("{\"score\": 4}"));
  }

  #[test]
  fn extracts_responses_text() {
    let value = json!({ "output_text": "{\"score\": 5}" });
    assert_eq!(
      extract_responses_text(&value).as_deref(),
      Some("{\"score\": 5}")
    );
  }
}
