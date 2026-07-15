// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::collections::VecDeque;
use std::fmt;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use agent_sdk::llm::{
  ChatOutcome, ChatRequest, ChatResponse, Content, ContentBlock, ContentSource, LlmProvider,
  Message, Role, StopReason, Usage,
};
use agent_sdk::{
  run_structured, ResponseFormat, StructuredConfig, StructuredOutputError, StructuredOutputSupport,
};
use anyhow::{anyhow, Result as AnyhowResult};
use async_trait::async_trait;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use reqwest::{Client as HttpClient, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use thiserror::Error;

const DEFAULT_BASE_URL: &str = "https://api.openai.com/v1";
const DEFAULT_MODEL: &str = "gpt-4o-mini";
const DEFAULT_TIMEOUT_MS: u64 = 120_000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ModelApi {
  Chat,
  Responses,
}

#[derive(Clone, Default)]
pub struct ModelOptions {
  pub api: Option<ModelApi>,
  pub api_key: Option<String>,
  pub base_url: Option<String>,
  pub default_headers: Vec<(String, String)>,
  pub default_query: Vec<(String, String)>,
  pub family: Option<String>,
  pub model: Option<String>,
  pub timeout_ms: Option<u64>,
}

impl fmt::Debug for ModelOptions {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter
      .debug_struct("ModelOptions")
      .field("api", &self.api)
      .field("api_key", &self.api_key.as_ref().map(|_| "[REDACTED]"))
      .field("base_url", &self.base_url.as_ref().map(|_| "[CONFIGURED]"))
      .field("default_headers", &self.default_headers.len())
      .field("default_query", &self.default_query.len())
      .field("family", &self.family)
      .field("model", &self.model)
      .field("timeout_ms", &self.timeout_ms)
      .finish()
  }
}

impl ModelOptions {
  pub fn from_env() -> Result<Self, ModelError> {
    let init_config = midscene_openai_init_config()?;
    Ok(Self::from_config(init_config.as_ref()))
  }

  fn from_config(init_config: Option<&Value>) -> Self {
    Self {
      api: first_env(&["MIDSCENE_MODEL_API", "OPENAI_API_STYLE"])
        .or_else(|| {
          json_config_string(
            init_config,
            &["api", "apiStyle", "api_style", "OPENAI_API_STYLE"],
          )
        })
        .and_then(|value| parse_model_api(&value)),
      api_key: first_env(&["MIDSCENE_MODEL_API_KEY", "OPENAI_API_KEY"]).or_else(|| {
        json_config_string(
          init_config,
          &[
            "apiKey",
            "api_key",
            "MIDSCENE_MODEL_API_KEY",
            "OPENAI_API_KEY",
          ],
        )
      }),
      base_url: first_env(&[
        "MIDSCENE_MODEL_BASE_URL",
        "OPENAI_BASE_URL",
        "OPENAI_API_BASE",
      ])
      .or_else(|| {
        json_config_string(
          init_config,
          &[
            "baseURL",
            "baseUrl",
            "base_url",
            "MIDSCENE_MODEL_BASE_URL",
            "OPENAI_BASE_URL",
            "OPENAI_API_BASE",
          ],
        )
      }),
      default_headers: model_default_headers(init_config),
      default_query: json_config_pairs(init_config, &["defaultQuery", "default_query"]),
      family: first_env(&[
        "MIDSCENE_MODEL_FAMILY",
        "OPENAI_MODEL_FAMILY",
        "MODEL_FAMILY",
      ])
      .or_else(|| {
        json_config_string(
          init_config,
          &[
            "family",
            "modelFamily",
            "model_family",
            "MIDSCENE_MODEL_FAMILY",
            "OPENAI_MODEL_FAMILY",
          ],
        )
      }),
      model: first_env(&["MIDSCENE_MODEL_NAME", "OPENAI_MODEL"]).or_else(|| {
        json_config_string(
          init_config,
          &[
            "model",
            "modelName",
            "model_name",
            "MIDSCENE_MODEL_NAME",
            "OPENAI_MODEL",
          ],
        )
      }),
      timeout_ms: first_env(&[
        "MIDSCENE_MODEL_TIMEOUT",
        "MIDSCENE_MODEL_TIMEOUT_MS",
        "JUDGE_TIMEOUT_MS",
        "OPENAI_TIMEOUT_MS",
      ])
      .and_then(|value| value.parse::<u64>().ok())
      .or_else(|| {
        json_config_u64(
          init_config,
          &[
            "timeout",
            "timeoutMs",
            "timeout_ms",
            "MIDSCENE_MODEL_TIMEOUT",
            "MIDSCENE_MODEL_TIMEOUT_MS",
            "JUDGE_TIMEOUT_MS",
            "OPENAI_TIMEOUT_MS",
          ],
        )
      }),
    }
  }
}

#[derive(Clone)]
pub struct ModelClient {
  mock_response: Option<String>,
  mock_responses: Option<Arc<Mutex<VecDeque<String>>>>,
  provider: OpenAiCompatibleProvider,
}

impl fmt::Debug for ModelClient {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter
      .debug_struct("ModelClient")
      .field(
        "mock_response",
        &self.mock_response.as_ref().map(|_| "configured"),
      )
      .field(
        "mock_responses",
        &self.mock_responses.as_ref().map(|_| "configured"),
      )
      .field("provider", &self.provider)
      .finish()
  }
}

#[derive(Debug, Error)]
pub enum ModelError {
  #[error("OpenAI-compatible credentials not provided: set MIDSCENE_MODEL_API_KEY or MIDSCENE_MODEL_INIT_CONFIG_JSON")]
  MissingApiKey,
  #[error("model init config must be valid JSON: {0}")]
  InvalidInitConfig(String),
  #[error("model HTTP client setup failed: {0}")]
  Request(#[from] reqwest::Error),
  #[error("agent SDK structured evaluation failed: {0}")]
  Structured(#[from] StructuredOutputError),
  #[error("UI_JUDGE_MODEL_RESPONSES_JSON must be a JSON array: {0}")]
  InvalidMockResponses(String),
  #[error("UI_JUDGE_MODEL_RESPONSES_JSON ran out of scripted responses")]
  MockResponsesExhausted,
  #[error("UI_JUDGE_MODEL_RESPONSES_JSON state is unavailable")]
  MockResponsesUnavailable,
  #[error("the /crawl model endpoint supports chat completions only; set MIDSCENE_MODEL_API=chat")]
  ResponsesUnsupportedForCrawl,
}

impl ModelClient {
  pub fn new(options: ModelOptions) -> Result<Self, ModelError> {
    let mock_response = first_env(&["UI_JUDGE_MODEL_RESPONSE_JSON"]);
    let mock_responses = first_env(&["UI_JUDGE_MODEL_RESPONSES_JSON"])
      .map(|value| parse_mock_responses(&value).map(|responses| Arc::new(Mutex::new(responses))))
      .transpose()
      .map_err(ModelError::InvalidMockResponses)?;
    let api_key = options
      .api_key
      .or_else(|| {
        (mock_response.is_some() || mock_responses.is_some()).then(|| "ui-judge-mock".to_string())
      })
      .ok_or(ModelError::MissingApiKey)?;
    let api = options.api.unwrap_or(ModelApi::Chat);
    let base_url = options.base_url.as_deref().unwrap_or(DEFAULT_BASE_URL);
    if api == ModelApi::Responses && uses_query_ak_auth(base_url) {
      return Err(ModelError::ResponsesUnsupportedForCrawl);
    }
    let endpoint = model_endpoint(api, base_url);
    let timeout = Duration::from_millis(options.timeout_ms.unwrap_or(DEFAULT_TIMEOUT_MS));
    let http_client = HttpClient::builder().timeout(timeout).build()?;

    Ok(Self {
      mock_response,
      mock_responses,
      provider: OpenAiCompatibleProvider {
        api,
        api_key,
        default_headers: options.default_headers,
        default_query: options.default_query,
        endpoint,
        family: options.family,
        http_client,
        model: options.model.unwrap_or_else(|| DEFAULT_MODEL.to_string()),
      },
    })
  }

  #[cfg(test)]
  pub(crate) fn mock(response: impl Into<String>) -> Self {
    let mut client = Self::new(ModelOptions {
      api_key: Some("ui-judge-test".to_string()),
      ..ModelOptions::default()
    })
    .expect("construct test model client");
    client.mock_response = Some(response.into());
    client.mock_responses = None;
    client
  }

  pub async fn evaluate_structured(
    &self,
    system_prompt: &str,
    prompt: &str,
    image_data_urls: &[&str],
    schema_name: &str,
    schema: Value,
  ) -> Result<String, ModelError> {
    self
      .evaluate_with_schema(
        system_prompt,
        prompt,
        image_data_urls,
        schema_name,
        schema,
        true,
      )
      .await
  }

  async fn evaluate_with_schema(
    &self,
    system_prompt: &str,
    prompt: &str,
    image_data_urls: &[&str],
    schema_name: &str,
    schema: Value,
    strict: bool,
  ) -> Result<String, ModelError> {
    if let Some(responses) = &self.mock_responses {
      return responses
        .lock()
        .map_err(|_| ModelError::MockResponsesUnavailable)?
        .pop_front()
        .ok_or(ModelError::MockResponsesExhausted);
    }
    if let Some(response) = &self.mock_response {
      return Ok(response.clone());
    }

    let request = ChatRequest::new(
      system_prompt,
      vec![Message::user_with_content(user_content(
        prompt,
        image_data_urls,
      ))],
    )
    .with_response_format(ResponseFormat::new(schema_name, schema).with_strict(strict));
    let output = run_structured(&self.provider, request, StructuredConfig::default()).await?;
    Ok(output.value.to_string())
  }
}

/// A deliberately small OpenAI-compatible provider.
///
/// UI Judge owns the wire adapter so its preserved MIDSCENE endpoint and
/// `/crawl?ak=` authentication conventions can still feed Agent SDK's
/// structured-output runner without depending on Midscene itself.
#[derive(Clone)]
struct OpenAiCompatibleProvider {
  api: ModelApi,
  api_key: String,
  default_headers: Vec<(String, String)>,
  default_query: Vec<(String, String)>,
  endpoint: String,
  family: Option<String>,
  http_client: HttpClient,
  model: String,
}

impl fmt::Debug for OpenAiCompatibleProvider {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter
      .debug_struct("OpenAiCompatibleProvider")
      .field("api", &self.api)
      .field("api_key", &"[REDACTED]")
      .field("default_headers", &self.default_headers.len())
      .field("default_query", &self.default_query.len())
      .field("endpoint", &"[CONFIGURED]")
      .field("family", &self.family)
      .field("model", &self.model)
      .finish_non_exhaustive()
  }
}

#[async_trait]
impl LlmProvider for OpenAiCompatibleProvider {
  async fn chat(&self, request: ChatRequest) -> AnyhowResult<ChatOutcome> {
    let include_structured_format = !uses_query_ak_auth(&self.endpoint)
      && !self
        .family
        .as_deref()
        .is_some_and(family_avoids_openai_response_format);
    let mut body = match self.api {
      ModelApi::Chat => chat_request_body(&self.model, &request, include_structured_format),
      ModelApi::Responses => {
        responses_request_body(&self.model, &request, include_structured_format)
      }
    };
    let mut reply = self.post_json(&body).await?;

    // A number of otherwise OpenAI-compatible gateways predate JSON-schema
    // wire constraints. Keep the SDK's local validation while retrying once
    // without that optional wire constraint when the gateway says so.
    if reply.status.is_client_error()
      && has_structured_format(self.api, &body)
      && response_format_is_unsupported(&reply.body)
    {
      remove_structured_format(self.api, &mut body);
      reply = self.post_json(&body).await?;
    }

    http_reply_to_outcome(reply, &self.model, self.api)
  }

  fn model(&self) -> &str {
    &self.model
  }

  fn provider(&self) -> &'static str {
    match self.api {
      ModelApi::Chat => "ui-judge-openai-chat",
      ModelApi::Responses => "ui-judge-openai-responses",
    }
  }

  fn structured_output_support(&self) -> StructuredOutputSupport {
    // The provider returns the JSON document in assistant text. Whether the
    // remote endpoint honors response_format or the prompt alone produces it,
    // run_structured parses and validates that text locally.
    StructuredOutputSupport::Native
  }
}

impl OpenAiCompatibleProvider {
  async fn post_json(&self, body: &Value) -> AnyhowResult<HttpReply> {
    let request = self.request_builder(body)?;

    let response = request
      .send()
      .await
      .map_err(|error| anyhow!(error.without_url()))?;
    let status = response.status();
    let retry_after = response
      .headers()
      .get(reqwest::header::RETRY_AFTER)
      .and_then(|value| value.to_str().ok())
      .and_then(parse_retry_after_seconds);
    let mut body = response
      .text()
      .await
      .map_err(|error| anyhow!(error.without_url()))?;
    if !status.is_success() {
      body = self.redact_error_body(body);
    }
    Ok(HttpReply {
      body,
      retry_after,
      status,
    })
  }

  fn request_builder(&self, body: &Value) -> AnyhowResult<reqwest::RequestBuilder> {
    let query_ak_auth = uses_query_ak_auth(&self.endpoint);
    let mut url = reqwest::Url::parse(&self.endpoint)
      .map_err(|error| anyhow!("invalid model endpoint URL: {error}"))?;
    let mut query = url.query_pairs().into_owned().collect::<Vec<_>>();
    for (name, value) in &self.default_query {
      replace_query_value(&mut query, name, value);
    }
    if query_ak_auth {
      replace_query_value(&mut query, "ak", &self.api_key);
    }
    url.set_query(None);
    if !query.is_empty() {
      url
        .query_pairs_mut()
        .extend_pairs(query.iter().map(|(name, value)| (name, value)));
    }

    let mut request = self.http_client.post(url).json(body);
    if !query_ak_auth {
      request = request.bearer_auth(&self.api_key);
    }
    let mut headers = HeaderMap::new();
    for (name, value) in &self.default_headers {
      let name = HeaderName::from_bytes(name.as_bytes())
        .map_err(|error| anyhow!("invalid default header name: {error}"))?;
      let mut value = HeaderValue::from_str(value)
        .map_err(|error| anyhow!("invalid value for default header {name}: {error}"))?;
      value.set_sensitive(true);
      headers.insert(name, value);
    }
    // Match the OpenAI client used by the previous implementation: JSON body
    // headers are applied after defaultHeaders, so the wire content type stays
    // application/json even when defaultHeaders contains Content-Type.
    headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
    request = request.headers(headers);
    Ok(request)
  }

  fn redact_error_body(&self, mut body: String) -> String {
    for secret in std::iter::once(self.api_key.as_str())
      .chain(self.default_headers.iter().map(|(_, value)| value.as_str()))
      .chain(self.default_query.iter().map(|(_, value)| value.as_str()))
      .filter(|value| !value.is_empty())
    {
      body = body.replace(secret, "[REDACTED]");
    }
    body
  }
}

fn replace_query_value(query: &mut Vec<(String, String)>, name: &str, value: &str) {
  query.retain(|(candidate, _)| candidate != name);
  query.push((name.to_string(), value.to_string()));
}

#[derive(Debug)]
struct HttpReply {
  body: String,
  retry_after: Option<Duration>,
  status: StatusCode,
}

fn http_reply_to_outcome(
  reply: HttpReply,
  fallback_model: &str,
  api: ModelApi,
) -> AnyhowResult<ChatOutcome> {
  if reply.status == StatusCode::TOO_MANY_REQUESTS {
    return Ok(ChatOutcome::RateLimited(reply.retry_after));
  }
  if reply.status.is_client_error() {
    return Ok(ChatOutcome::InvalidRequest(reply.body));
  }
  if reply.status.is_server_error() {
    return Ok(ChatOutcome::ServerError(reply.body));
  }
  if !reply.status.is_success() {
    return Err(anyhow!(
      "model API returned HTTP {}: {}",
      reply.status.as_u16(),
      reply.body
    ));
  }

  let value: Value = serde_json::from_str(&reply.body)
    .map_err(|error| anyhow!("invalid JSON response: {error}; body: {}", reply.body))?;
  match api {
    ModelApi::Chat => chat_value_to_outcome(&value, fallback_model),
    ModelApi::Responses => responses_value_to_outcome(&value, fallback_model),
  }
}

fn chat_value_to_outcome(value: &Value, fallback_model: &str) -> AnyhowResult<ChatOutcome> {
  let choice = value
    .get("choices")
    .and_then(Value::as_array)
    .and_then(|choices| choices.first())
    .ok_or_else(|| anyhow!("model API response did not contain a chat completion choice"))?;
  let message = choice
    .get("message")
    .ok_or_else(|| anyhow!("model API response choice did not contain a message"))?;
  let content = message
    .get("content")
    .and_then(extract_text_value)
    .map(|text| vec![ContentBlock::Text { text }])
    .unwrap_or_default();
  let stop_reason = choice
    .get("finish_reason")
    .and_then(Value::as_str)
    .map(chat_stop_reason);
  let usage = value.get("usage");

  Ok(ChatOutcome::Success(ChatResponse {
    id: value
      .get("id")
      .and_then(Value::as_str)
      .unwrap_or("ui-judge-chat-completion")
      .to_string(),
    content,
    model: value
      .get("model")
      .and_then(Value::as_str)
      .unwrap_or(fallback_model)
      .to_string(),
    stop_reason,
    usage: Usage {
      input_tokens: usage_token(usage, "prompt_tokens"),
      output_tokens: usage_token(usage, "completion_tokens"),
      cached_input_tokens: usage
        .and_then(|usage| usage.get("prompt_tokens_details"))
        .map(|details| usage_token(Some(details), "cached_tokens"))
        .unwrap_or(0),
      cache_creation_input_tokens: 0,
    },
  }))
}

fn responses_value_to_outcome(value: &Value, fallback_model: &str) -> AnyhowResult<ChatOutcome> {
  match value.get("status").and_then(Value::as_str) {
    None | Some("completed") => {}
    Some(status) => {
      let detail = value
        .get("error")
        .and_then(|error| error.get("message"))
        .and_then(Value::as_str)
        .or_else(|| {
          value
            .get("incomplete_details")
            .and_then(|details| details.get("reason"))
            .and_then(Value::as_str)
        })
        .unwrap_or("no error detail was provided");
      return Err(anyhow!(
        "model Responses API returned status {status}: {detail}"
      ));
    }
  }

  let text = value
    .get("output_text")
    .and_then(Value::as_str)
    .map(str::to_string)
    .or_else(|| {
      let text = value
        .get("output")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter(|item| {
          item.get("type").and_then(Value::as_str) == Some("message")
            && item.get("role").and_then(Value::as_str) == Some("assistant")
        })
        .filter_map(|item| item.get("content").and_then(Value::as_array))
        .flatten()
        .filter(|part| {
          matches!(
            part.get("type").and_then(Value::as_str),
            Some("output_text" | "text")
          )
        })
        .filter_map(|part| part.get("text").and_then(Value::as_str))
        .collect::<Vec<_>>()
        .join("\n");
      (!text.is_empty()).then_some(text)
    })
    .ok_or_else(|| anyhow!("model Responses API result did not contain assistant output text"))?;
  let usage = value.get("usage");
  Ok(ChatOutcome::Success(ChatResponse {
    id: value
      .get("id")
      .and_then(Value::as_str)
      .unwrap_or("ui-judge-response")
      .to_string(),
    content: vec![ContentBlock::Text { text }],
    model: value
      .get("model")
      .and_then(Value::as_str)
      .unwrap_or(fallback_model)
      .to_string(),
    stop_reason: Some(StopReason::EndTurn),
    usage: Usage {
      input_tokens: usage_token(usage, "input_tokens"),
      output_tokens: usage_token(usage, "output_tokens"),
      cached_input_tokens: usage
        .and_then(|usage| usage.get("input_tokens_details"))
        .map(|details| usage_token(Some(details), "cached_tokens"))
        .unwrap_or(0),
      cache_creation_input_tokens: 0,
    },
  }))
}

fn chat_request_body(model: &str, request: &ChatRequest, include_response_format: bool) -> Value {
  let mut messages = Vec::with_capacity(request.messages.len() + 1);
  if !request.system.trim().is_empty() {
    messages.push(json!({ "role": "system", "content": request.system }));
  }
  messages.extend(request.messages.iter().map(wire_message));

  let mut body = Map::new();
  body.insert("model".to_string(), Value::String(model.to_string()));
  body.insert("messages".to_string(), Value::Array(messages));
  body.insert("temperature".to_string(), json!(0));
  if request.max_tokens_explicit {
    body.insert("max_tokens".to_string(), json!(request.max_tokens));
  }
  if include_response_format {
    if let Some(format) = &request.response_format {
      body.insert(
        "response_format".to_string(),
        json!({
          "type": "json_schema",
          "json_schema": {
            "name": format.name,
            "schema": format.schema,
            "strict": format.strict
          }
        }),
      );
    }
  }
  Value::Object(body)
}

fn responses_request_body(
  model: &str,
  request: &ChatRequest,
  include_response_format: bool,
) -> Value {
  let mut body = Map::new();
  body.insert("model".to_string(), Value::String(model.to_string()));
  if !request.system.trim().is_empty() {
    body.insert(
      "instructions".to_string(),
      Value::String(request.system.clone()),
    );
  }
  body.insert(
    "input".to_string(),
    Value::Array(
      request
        .messages
        .iter()
        .map(responses_wire_message)
        .collect(),
    ),
  );
  body.insert("temperature".to_string(), json!(0));
  if request.max_tokens_explicit {
    body.insert("max_output_tokens".to_string(), json!(request.max_tokens));
  }
  if include_response_format {
    if let Some(format) = &request.response_format {
      body.insert(
        "text".to_string(),
        json!({
          "format": {
            "type": "json_schema",
            "name": format.name,
            "schema": format.schema,
            "strict": format.strict
          }
        }),
      );
    }
  }
  Value::Object(body)
}

fn responses_wire_message(message: &Message) -> Value {
  json!({
    "role": match message.role {
      Role::User => "user",
      Role::Assistant => "assistant",
    },
    "content": responses_wire_content(&message.content, message.role)
  })
}

fn responses_wire_content(content: &Content, role: Role) -> Value {
  match content {
    Content::Text(text) => json!([{ "type": "input_text", "text": text }]),
    Content::Blocks(blocks) => Value::Array(
      blocks
        .iter()
        .filter_map(|block| match block {
          ContentBlock::Text { text } => Some(json!({ "type": "input_text", "text": text })),
          ContentBlock::Image { source } if role == Role::User => Some(json!({
            "type": "input_image",
            "image_url": image_data_url(source)
          })),
          _ => None,
        })
        .collect(),
    ),
  }
}

fn has_structured_format(api: ModelApi, body: &Value) -> bool {
  match api {
    ModelApi::Chat => body.get("response_format").is_some(),
    ModelApi::Responses => body.get("text").is_some(),
  }
}

fn remove_structured_format(api: ModelApi, body: &mut Value) {
  if let Some(object) = body.as_object_mut() {
    object.remove(match api {
      ModelApi::Chat => "response_format",
      ModelApi::Responses => "text",
    });
  }
}

fn wire_message(message: &Message) -> Value {
  json!({
    "role": match message.role {
      Role::User => "user",
      Role::Assistant => "assistant",
    },
    "content": wire_content(&message.content)
  })
}

fn wire_content(content: &Content) -> Value {
  match content {
    Content::Text(text) => Value::String(text.clone()),
    Content::Blocks(blocks) => {
      let has_attachment = blocks
        .iter()
        .any(|block| matches!(block, ContentBlock::Image { .. }));
      if !has_attachment {
        let texts = blocks
          .iter()
          .filter_map(|block| match block {
            ContentBlock::Text { text } => Some(text.as_str()),
            _ => None,
          })
          .collect::<Vec<_>>();
        if !texts.is_empty() {
          return Value::String(texts.join("\n"));
        }
      }

      Value::Array(
        blocks
          .iter()
          .filter_map(|block| match block {
            ContentBlock::Text { text } => Some(json!({ "type": "text", "text": text })),
            ContentBlock::Image { source } => Some(json!({
              "type": "image_url",
              "image_url": { "url": image_data_url(source) }
            })),
            _ => None,
          })
          .collect(),
      )
    }
  }
}

fn user_content(prompt: &str, image_data_urls: &[&str]) -> Vec<ContentBlock> {
  let mut content = vec![ContentBlock::Text {
    text: prompt.to_string(),
  }];
  content.extend(image_data_urls.iter().map(|image| ContentBlock::Image {
    source: image_content_source(image),
  }));
  content
}

fn image_content_source(data_url: &str) -> ContentSource {
  let Some(rest) = data_url.strip_prefix("data:") else {
    return ContentSource::new("text/uri-list", data_url);
  };
  let Some((metadata, data)) = rest.split_once(',') else {
    return ContentSource::new("text/uri-list", data_url);
  };
  let mut metadata_parts = metadata.split(';');
  let media_type = metadata_parts.next().unwrap_or("application/octet-stream");
  if metadata_parts.any(|part| part.eq_ignore_ascii_case("base64")) {
    ContentSource::new(
      if media_type.is_empty() {
        "application/octet-stream"
      } else {
        media_type
      },
      data,
    )
  } else {
    ContentSource::new("text/uri-list", data_url)
  }
}

fn image_data_url(source: &ContentSource) -> String {
  if source.data.starts_with("data:") || source.media_type == "text/uri-list" {
    source.data.clone()
  } else {
    format!("data:{};base64,{}", source.media_type, source.data)
  }
}

fn chat_stop_reason(value: &str) -> StopReason {
  match value {
    "stop" => StopReason::EndTurn,
    "tool_calls" | "function_call" => StopReason::ToolUse,
    "length" => StopReason::MaxTokens,
    "content_filter" | "refusal" | "sensitive" => StopReason::Refusal,
    _ => StopReason::Unknown,
  }
}

fn usage_token(usage: Option<&Value>, name: &str) -> u32 {
  usage
    .and_then(|usage| usage.get(name))
    .and_then(Value::as_u64)
    .unwrap_or(0)
    .min(u64::from(u32::MAX)) as u32
}

fn extract_text_value(value: &Value) -> Option<String> {
  if let Some(text) = value.as_str() {
    return Some(text.to_string());
  }

  let parts = value
    .as_array()?
    .iter()
    .filter_map(|item| item.get("text").and_then(Value::as_str))
    .collect::<Vec<_>>();
  (!parts.is_empty()).then(|| parts.join("\n"))
}

fn parse_model_api(value: &str) -> Option<ModelApi> {
  match value.trim().to_ascii_lowercase().as_str() {
    "chat" | "chat-completions" | "chat_completions" => Some(ModelApi::Chat),
    "responses" => Some(ModelApi::Responses),
    _ => None,
  }
}

fn parse_mock_responses(value: &str) -> Result<VecDeque<String>, String> {
  let parsed = serde_json::from_str::<Value>(value).map_err(|error| error.to_string())?;
  let Value::Array(responses) = parsed else {
    return Err("expected a JSON array".to_string());
  };
  Ok(
    responses
      .into_iter()
      .map(|response| match response {
        Value::String(response) => response,
        response => response.to_string(),
      })
      .collect(),
  )
}

fn first_env(names: &[&str]) -> Option<String> {
  names.iter().find_map(|name| {
    std::env::var(name)
      .ok()
      .map(|value| value.trim().to_string())
      .filter(|value| !value.is_empty())
  })
}

fn midscene_openai_init_config() -> Result<Option<Value>, ModelError> {
  let Some(value) = first_env(&[
    "MIDSCENE_MODEL_INIT_CONFIG_JSON",
    "MIDSCENE_OPENAI_INIT_CONFIG_JSON",
    "OPENAI_INIT_CONFIG_JSON",
  ]) else {
    return Ok(None);
  };
  parse_model_init_config(&value).map(Some)
}

fn parse_model_init_config(value: &str) -> Result<Value, ModelError> {
  serde_json::from_str::<Value>(value)
    .map_err(|error| ModelError::InvalidInitConfig(error.to_string()))
}

fn json_config_pairs(config: Option<&Value>, keys: &[&str]) -> Vec<(String, String)> {
  find_json_object(config, keys)
    .map(|object| {
      object
        .iter()
        .filter_map(|(name, value)| json_scalar_string(value).map(|value| (name.clone(), value)))
        .collect()
    })
    .unwrap_or_default()
}

fn model_default_headers(config: Option<&Value>) -> Vec<(String, String)> {
  config_headers(
    config,
    first_env(&["OPENAI_ORG_ID"]),
    first_env(&["OPENAI_PROJECT_ID"]),
  )
}

fn config_headers(
  config: Option<&Value>,
  environment_organization: Option<String>,
  environment_project: Option<String>,
) -> Vec<(String, String)> {
  let mut headers = json_config_pairs(config, &["defaultHeaders", "extra_headers", "extraHeaders"]);
  for (config_key, header_name, environment_value) in [
    (
      "organization",
      "OpenAI-Organization",
      environment_organization,
    ),
    ("project", "OpenAI-Project", environment_project),
  ] {
    if headers
      .iter()
      .any(|(name, _)| name.eq_ignore_ascii_case(header_name))
    {
      continue;
    }
    if let Some(value) = json_config_string(config, &[config_key]).or(environment_value) {
      headers.push((header_name.to_string(), value));
    }
  }
  headers
}

fn find_json_object<'a>(value: Option<&'a Value>, keys: &[&str]) -> Option<&'a Map<String, Value>> {
  let object = value?.as_object()?;
  for key in keys {
    if let Some(value) = object.get(*key).and_then(Value::as_object) {
      return Some(value);
    }
  }
  object
    .values()
    .filter(|value| value.is_object())
    .find_map(|value| find_json_object(Some(value), keys))
}

fn json_scalar_string(value: &Value) -> Option<String> {
  match value {
    Value::String(value) => Some(value.clone()),
    Value::Number(value) => Some(value.to_string()),
    Value::Bool(value) => Some(value.to_string()),
    _ => None,
  }
}

fn json_config_string(config: Option<&Value>, keys: &[&str]) -> Option<String> {
  find_json_string(config?, keys)
}

fn json_config_u64(config: Option<&Value>, keys: &[&str]) -> Option<u64> {
  find_json_u64(config?, keys)
}

fn find_json_string(value: &Value, keys: &[&str]) -> Option<String> {
  let object = value.as_object()?;
  for key in keys {
    if let Some(value) = object
      .get(*key)
      .and_then(Value::as_str)
      .map(str::trim)
      .filter(|value| !value.is_empty())
    {
      return Some(value.to_string());
    }
  }
  object
    .values()
    .filter(|value| value.is_object())
    .find_map(|value| find_json_string(value, keys))
}

fn find_json_u64(value: &Value, keys: &[&str]) -> Option<u64> {
  let object = value.as_object()?;
  for key in keys {
    if let Some(value) = object.get(*key) {
      if let Some(value) = value.as_u64().or_else(|| {
        value
          .as_str()
          .map(str::trim)
          .and_then(|value| value.parse::<u64>().ok())
      }) {
        return Some(value);
      }
    }
  }
  object
    .values()
    .filter(|value| value.is_object())
    .find_map(|value| find_json_u64(value, keys))
}

fn model_endpoint(api: ModelApi, base_url: &str) -> String {
  match api {
    ModelApi::Chat => chat_endpoint(base_url),
    ModelApi::Responses => responses_endpoint(base_url),
  }
}

fn chat_endpoint(base_url: &str) -> String {
  let base_url = trim_trailing_slash_before_query(base_url.trim());
  let path = endpoint_path(&base_url);
  if path.ends_with("/chat/completions") || path.ends_with("/crawl") {
    return base_url;
  }

  let base_url = if path.ends_with("/responses") {
    remove_path_suffix(&base_url, "/responses")
  } else {
    base_url
  };
  insert_before_query(&base_url, "/chat/completions")
}

fn responses_endpoint(base_url: &str) -> String {
  let base_url = trim_trailing_slash_before_query(base_url.trim());
  let path = endpoint_path(&base_url);
  if path.ends_with("/responses") {
    return base_url;
  }

  let base_url = if path.ends_with("/chat/completions") {
    remove_path_suffix(&base_url, "/chat/completions")
  } else {
    base_url
  };
  insert_before_query(&base_url, "/responses")
}

fn uses_query_ak_auth(endpoint: &str) -> bool {
  endpoint_path(endpoint).ends_with("/crawl")
}

fn endpoint_path(endpoint: &str) -> &str {
  let without_query = endpoint.split_once('?').map_or(endpoint, |(path, _)| path);
  without_query
    .split_once('#')
    .map_or(without_query, |(path, _)| path)
    .trim_end_matches('/')
}

fn trim_trailing_slash_before_query(value: &str) -> String {
  match value.split_once('?') {
    Some((base, query)) => format!("{}?{query}", base.trim_end_matches('/')),
    None => value.trim_end_matches('/').to_string(),
  }
}

fn insert_before_query(value: &str, suffix: &str) -> String {
  match value.split_once('?') {
    Some((base, query)) => format!("{base}{suffix}?{query}"),
    None => format!("{value}{suffix}"),
  }
}

fn remove_path_suffix(value: &str, suffix: &str) -> String {
  match value.split_once('?') {
    Some((base, query)) => format!("{}?{query}", base.trim_end_matches(suffix)),
    None => value.trim_end_matches(suffix).to_string(),
  }
}

fn family_avoids_openai_response_format(family: &str) -> bool {
  let family = family.trim().to_ascii_lowercase();
  family.starts_with("anthropic") || family.starts_with("claude") || family.starts_with("gemini")
}

fn response_format_is_unsupported(body: &str) -> bool {
  let body = body.to_ascii_lowercase();
  body.contains("response_format") || body.contains("json_schema")
}

fn parse_retry_after_seconds(value: &str) -> Option<Duration> {
  value.trim().parse::<u64>().ok().map(Duration::from_secs)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn resolves_chat_and_crawl_endpoints_without_double_suffixes() {
    assert_eq!(
      chat_endpoint("https://example.com/v1"),
      "https://example.com/v1/chat/completions"
    );
    assert_eq!(
      chat_endpoint("https://example.com/v1/chat/completions/"),
      "https://example.com/v1/chat/completions"
    );
    assert_eq!(
      chat_endpoint("https://example.com/crawl?region=us"),
      "https://example.com/crawl?region=us"
    );
    assert!(uses_query_ak_auth("https://example.com/crawl?region=us"));
    assert_eq!(
      chat_endpoint("https://example.com/v1?region=us"),
      "https://example.com/v1/chat/completions?region=us"
    );
    assert_eq!(
      responses_endpoint("https://example.com/v1"),
      "https://example.com/v1/responses"
    );
    assert_eq!(
      responses_endpoint("https://example.com/v1/chat/completions?region=us"),
      "https://example.com/v1/responses?region=us"
    );
  }

  #[test]
  fn preserves_image_data_urls_on_chat_completions_wire() {
    let data_url = "data:image/png;base64,aGVsbG8=";
    let request = ChatRequest::new(
      "system",
      vec![Message::user_with_content(user_content(
        "compare",
        &[data_url],
      ))],
    )
    .with_response_format(
      ResponseFormat::new("result", json!({ "type": "object" })).with_strict(false),
    );
    let body = chat_request_body("judge-model", &request, true);

    assert_eq!(body["model"], "judge-model");
    assert_eq!(body["messages"][0]["role"], "system");
    assert_eq!(body["messages"][1]["content"][0]["text"], "compare");
    assert_eq!(
      body["messages"][1]["content"][1]["image_url"]["url"],
      data_url
    );
    assert_eq!(body["response_format"]["type"], "json_schema");
  }

  #[test]
  fn converts_chat_response_to_agent_sdk_outcome() {
    let value = json!({
      "id": "completion-1",
      "model": "judge-model",
      "choices": [{
        "finish_reason": "stop",
        "message": { "content": "{\"score\":4}" }
      }],
      "usage": { "prompt_tokens": 12, "completion_tokens": 3 }
    });

    let outcome = chat_value_to_outcome(&value, "fallback").expect("valid response");
    let ChatOutcome::Success(response) = outcome else {
      panic!("expected success");
    };
    assert_eq!(response.first_text(), Some("{\"score\":4}"));
    assert_eq!(response.stop_reason, Some(StopReason::EndTurn));
    assert_eq!(response.usage.input_tokens, 12);
    assert_eq!(response.usage.output_tokens, 3);
  }

  #[test]
  fn preserves_images_and_schema_on_responses_wire() {
    let data_url = "data:image/png;base64,aGVsbG8=";
    let request = ChatRequest::new(
      "system",
      vec![Message::user_with_content(user_content(
        "compare",
        &[data_url],
      ))],
    )
    .with_response_format(
      ResponseFormat::new("result", json!({ "type": "object" })).with_strict(true),
    );
    let body = responses_request_body("judge-model", &request, true);

    assert_eq!(body["instructions"], "system");
    assert_eq!(body["input"][0]["content"][0]["type"], "input_text");
    assert_eq!(body["input"][0]["content"][1]["type"], "input_image");
    assert_eq!(body["input"][0]["content"][1]["image_url"], data_url);
    assert_eq!(body["text"]["format"]["type"], "json_schema");
  }

  #[test]
  fn encodes_responses_retry_messages_as_input_content() {
    let request = ChatRequest::new(
      "system",
      vec![
        Message::user("first attempt"),
        Message::assistant("invalid structured output"),
        Message::user("try again"),
      ],
    );
    let body = responses_request_body("judge-model", &request, false);

    assert_eq!(body["input"][1]["role"], "assistant");
    assert_eq!(body["input"][1]["content"][0]["type"], "input_text");
  }

  #[test]
  fn converts_responses_result_to_agent_sdk_outcome() {
    let value = json!({
      "id": "response-1",
      "model": "judge-model",
      "status": "completed",
      "output": [{
        "type": "message",
        "role": "assistant",
        "content": [{ "type": "output_text", "text": "{\"score\":4}" }]
      }],
      "usage": { "input_tokens": 11, "output_tokens": 4 }
    });

    let outcome = responses_value_to_outcome(&value, "fallback").expect("valid response");
    let ChatOutcome::Success(response) = outcome else {
      panic!("expected success");
    };
    assert_eq!(response.first_text(), Some("{\"score\":4}"));
    assert_eq!(response.stop_reason, Some(StopReason::EndTurn));
    assert_eq!(response.usage.input_tokens, 11);
    assert_eq!(response.usage.output_tokens, 4);
  }

  #[test]
  fn rejects_unsuccessful_responses_statuses() {
    let failed = json!({
      "status": "failed",
      "error": { "message": "upstream failure" },
      "output_text": "{\"score\":4}"
    });
    let error = responses_value_to_outcome(&failed, "fallback")
      .expect_err("failed response must not be accepted")
      .to_string();
    assert!(error.contains("status failed"));
    assert!(error.contains("upstream failure"));

    let incomplete = json!({
      "status": "incomplete",
      "incomplete_details": { "reason": "max_output_tokens" },
      "output_text": "{\"score\":4}"
    });
    assert!(responses_value_to_outcome(&incomplete, "fallback").is_err());
  }

  #[tokio::test(flavor = "current_thread")]
  async fn strips_sensitive_crawl_url_from_transport_errors() {
    let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind unused port");
    let address = listener.local_addr().expect("read unused port");
    drop(listener);
    let secret = "dummy-secret-review-key";
    let provider = OpenAiCompatibleProvider {
      api: ModelApi::Chat,
      api_key: secret.to_string(),
      default_headers: vec![],
      default_query: vec![],
      endpoint: format!("http://{address}/crawl"),
      family: None,
      http_client: HttpClient::builder()
        .timeout(Duration::from_secs(1))
        .build()
        .expect("build client"),
      model: "judge-model".to_string(),
    };

    let error = provider
      .post_json(&json!({ "model": "judge-model" }))
      .await
      .expect_err("closed port must fail")
      .to_string();
    assert!(!error.contains(secret));
    assert!(!error.contains("?ak="));
    assert_eq!(
      provider.redact_error_body(format!("invalid ak: {secret}")),
      "invalid ak: [REDACTED]"
    );
  }

  #[test]
  fn default_headers_and_query_replace_existing_values() {
    let provider = OpenAiCompatibleProvider {
      api: ModelApi::Chat,
      api_key: "crawl-secret".to_string(),
      default_headers: vec![
        (
          "authorization".to_string(),
          "Gateway credential".to_string(),
        ),
        (
          "content-type".to_string(),
          "application/custom+json".to_string(),
        ),
      ],
      default_query: vec![("api-version".to_string(), "new".to_string())],
      endpoint: "https://example.com/v1/chat/completions?api-version=old&keep=yes".to_string(),
      family: None,
      http_client: HttpClient::new(),
      model: "judge-model".to_string(),
    };

    let request = provider
      .request_builder(&json!({ "model": "judge-model" }))
      .expect("build request")
      .build()
      .expect("finish request");
    let query = request.url().query_pairs().into_owned().collect::<Vec<_>>();
    assert_eq!(
      query,
      vec![
        ("keep".to_string(), "yes".to_string()),
        ("api-version".to_string(), "new".to_string()),
      ]
    );
    assert_eq!(request.headers().get_all("authorization").iter().count(), 1);
    assert_eq!(request.headers()["authorization"], "Gateway credential");
    assert_eq!(request.headers()["content-type"], "application/json");

    let mut crawl_provider = provider;
    crawl_provider.endpoint =
      "https://example.com/crawl?api-version=old&keep=yes&ak=old".to_string();
    let crawl_request = crawl_provider
      .request_builder(&json!({ "model": "judge-model" }))
      .expect("build crawl request")
      .build()
      .expect("finish crawl request");
    let crawl_query = crawl_request
      .url()
      .query_pairs()
      .into_owned()
      .collect::<Vec<_>>();
    assert_eq!(
      crawl_query,
      vec![
        ("keep".to_string(), "yes".to_string()),
        ("api-version".to_string(), "new".to_string()),
        ("ak".to_string(), "crawl-secret".to_string()),
      ]
    );
  }

  #[test]
  fn parses_scripted_mock_responses_in_order() {
    let responses = parse_mock_responses(r#"[{"action":"done"},"{\"score\":4}"]"#)
      .expect("valid response queue")
      .into_iter()
      .collect::<Vec<_>>();
    assert_eq!(responses[0], r#"{"action":"done"}"#);
    assert_eq!(responses[1], r#"{"score":4}"#);
    assert!(parse_mock_responses("{}").is_err());
  }

  #[test]
  fn debug_output_redacts_api_keys() {
    let options = ModelOptions {
      api_key: Some("super-secret-key".to_string()),
      ..ModelOptions::default()
    };
    let debug = format!("{options:?}");
    assert!(debug.contains("[REDACTED]"));
    assert!(!debug.contains("super-secret-key"));
  }

  #[test]
  fn extracts_all_midscene_init_config_fields() {
    let config = json!({
      "openai": {
        "apiKey": "key-from-json",
        "baseURL": "https://example.com/v1",
        "defaultHeaders": {
          "x-gateway-key": "gateway-key",
          "x-tenant-id": 42
        },
        "defaultQuery": { "api-version": "2026-07-01" },
        "organization": "org-lynx",
        "project": "proj-ui-judge",
        "modelName": "judge-model",
        "modelFamily": "gemini",
        "apiStyle": "responses",
        "timeoutMs": 30_000
      }
    });
    assert_eq!(
      json_config_string(Some(&config), &["apiKey"]).as_deref(),
      Some("key-from-json")
    );
    assert_eq!(
      json_config_string(Some(&config), &["baseURL"]).as_deref(),
      Some("https://example.com/v1")
    );
    assert_eq!(
      json_config_string(Some(&config), &["modelName"]).as_deref(),
      Some("judge-model")
    );
    assert_eq!(
      json_config_string(Some(&config), &["modelFamily"]).as_deref(),
      Some("gemini")
    );
    assert_eq!(
      json_config_string(Some(&config), &["apiStyle"]).and_then(|value| parse_model_api(&value)),
      Some(ModelApi::Responses)
    );
    assert_eq!(json_config_u64(Some(&config), &["timeoutMs"]), Some(30_000));
    assert_eq!(
      json_config_pairs(Some(&config), &["defaultHeaders"]),
      vec![
        ("x-gateway-key".to_string(), "gateway-key".to_string()),
        ("x-tenant-id".to_string(), "42".to_string()),
      ]
    );
    assert_eq!(
      json_config_pairs(Some(&config), &["defaultQuery"]),
      vec![("api-version".to_string(), "2026-07-01".to_string())]
    );
    assert!(config_headers(Some(&config), None, None)
      .contains(&("OpenAI-Organization".to_string(), "org-lynx".to_string())));
    assert!(config_headers(Some(&config), None, None)
      .contains(&("OpenAI-Project".to_string(), "proj-ui-judge".to_string())));
  }

  #[test]
  fn maps_openai_organization_and_project_environment_fallbacks() {
    let headers = config_headers(
      None,
      Some("org-from-env".to_string()),
      Some("project-from-env".to_string()),
    );
    assert!(headers.contains(&(
      "OpenAI-Organization".to_string(),
      "org-from-env".to_string()
    )));
    assert!(headers.contains(&("OpenAI-Project".to_string(), "project-from-env".to_string())));

    let config = json!({
      "organization": "org-from-config",
      "defaultHeaders": { "OpenAI-Project": "project-from-header" }
    });
    let headers = config_headers(
      Some(&config),
      Some("org-from-env".to_string()),
      Some("project-from-env".to_string()),
    );
    assert!(headers.contains(&(
      "OpenAI-Organization".to_string(),
      "org-from-config".to_string()
    )));
    assert!(headers.contains(&(
      "OpenAI-Project".to_string(),
      "project-from-header".to_string()
    )));
  }

  #[test]
  fn rejects_malformed_model_init_config() {
    assert!(matches!(
      parse_model_init_config("{not-json"),
      Err(ModelError::InvalidInitConfig(_))
    ));
  }

  #[test]
  fn marks_only_response_format_errors_for_compatibility_retry() {
    assert!(response_format_is_unsupported(
      r#"{"error":"response_format json_schema is unsupported"}"#
    ));
    assert!(!response_format_is_unsupported(
      r#"{"error":"unknown model"}"#
    ));
  }
}
