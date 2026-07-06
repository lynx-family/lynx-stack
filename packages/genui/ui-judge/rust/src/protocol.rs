// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use crate::api::{Error, Result};

const PEERTALK_HEADER_LEN: usize = 20;
const MAX_PEERTALK_PAYLOAD_LEN: usize = 16 * 1024 * 1024;
const PEERTALK_VERSION: u32 = 1;
const PEERTALK_TYPE: u32 = 101;

#[allow(dead_code)]
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub struct AppInfo {
  pub app: String,
  #[serde(default)]
  pub app_version: String,
  #[serde(default, rename = "AppProcessName")]
  pub app_process_name: Option<String>,
  #[serde(default, rename = "bundleId")]
  pub bundle_id: Option<String>,
  #[serde(default, rename = "bundleName")]
  pub bundle_name: Option<String>,
  #[serde(default, rename = "debugRouterId")]
  pub debug_router_id: String,
  #[serde(default, rename = "debugRouterVersion")]
  pub debug_router_version: String,
  #[serde(default, rename = "deviceModel")]
  pub device_model: String,
  #[serde(default)]
  pub network: String,
  #[serde(default, rename = "osVersion")]
  pub os_version: String,
  #[serde(default, rename = "sdkVersion")]
  pub sdk_version: String,
}

impl AppInfo {
  pub fn matches_package(&self, package_name: &str) -> bool {
    self.app_process_name.as_deref() == Some(package_name)
      || self.bundle_id.as_deref() == Some(package_name)
      || self.bundle_name.as_deref() == Some(package_name)
  }
}

#[derive(Debug, Clone)]
pub struct Client {
  pub port: u16,
  pub info: AppInfo,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub struct Session {
  pub session_id: i64,
  #[serde(default)]
  pub r#type: String,
  #[serde(default)]
  pub url: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NodeInfo {
  #[serde(rename = "nodeId")]
  pub node_id: i64,
  #[serde(default)]
  pub children: Vec<NodeInfo>,
  #[serde(default)]
  pub attributes: Vec<String>,
  #[serde(default, rename = "nodeName")]
  pub node_name: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetDocumentResult {
  pub root: NodeInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub struct QuerySelectorResult {
  #[serde(rename = "nodeId")]
  pub node_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetAttributesResult {
  pub attributes: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetBoxModelResult {
  pub model: BoxModel,
}

#[derive(Debug, Clone, Deserialize)]
pub struct BoxModel {
  #[serde(default)]
  pub content: Vec<f64>,
  #[serde(default)]
  pub padding: Vec<f64>,
  #[serde(default)]
  pub border: Vec<f64>,
  #[serde(default)]
  pub margin: Vec<f64>,
  #[serde(default)]
  pub width: f64,
  #[serde(default)]
  pub height: f64,
}

#[derive(Debug, Clone, Deserialize)]
pub struct GetComputedStyleResult {
  #[serde(default, rename = "computedStyle")]
  pub computed_style: Vec<ComputedStyleProperty>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ComputedStyleProperty {
  pub name: String,
  pub value: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ScreenshotEventParams {
  pub data: String,
}

pub fn encode_peertalk_message<T: Serialize>(message: &T) -> Result<Vec<u8>> {
  let body = serde_json::to_vec(message)?;
  let len = body.len();
  let mut frame = vec![0_u8; PEERTALK_HEADER_LEN + len];

  write_u32(&mut frame[0..4], PEERTALK_VERSION);
  write_u32(&mut frame[4..8], PEERTALK_TYPE);
  write_u32(&mut frame[8..12], 0);
  write_u32(&mut frame[12..16], len as u32 + 4);
  write_u32(&mut frame[16..20], len as u32);
  frame[PEERTALK_HEADER_LEN..].copy_from_slice(&body);

  Ok(frame)
}

pub async fn write_peertalk_message<W, T>(writer: &mut W, message: &T) -> Result<()>
where
  W: AsyncWrite + Unpin,
  T: Serialize,
{
  let frame = encode_peertalk_message(message)?;
  writer.write_all(&frame).await?;
  writer.flush().await?;
  Ok(())
}

pub async fn read_peertalk_message<R>(reader: &mut R) -> Result<Value>
where
  R: AsyncRead + Unpin,
{
  let mut header = [0_u8; PEERTALK_HEADER_LEN];
  reader.read_exact(&mut header).await?;
  let payload_len = read_u32(&header[16..20]) as usize;
  if payload_len > MAX_PEERTALK_PAYLOAD_LEN {
    return Err(Error::Protocol(format!(
      "Peertalk payload length {payload_len} exceeds the {} byte limit",
      MAX_PEERTALK_PAYLOAD_LEN,
    )));
  }
  let mut payload = vec![0_u8; payload_len];
  reader.read_exact(&mut payload).await?;
  Ok(serde_json::from_slice(&payload)?)
}

pub fn initialize_request(port: u16) -> Value {
  json!({
      "event": "Initialize",
      "data": port,
  })
}

pub fn parse_initialize_response(value: &Value) -> Result<Option<AppInfo>> {
  if value.get("event").and_then(Value::as_str) != Some("Register") {
    return Ok(None);
  }

  let info = value
    .get("data")
    .and_then(|data| data.get("info"))
    .ok_or_else(|| Error::Protocol("Register response missing data.info".into()))?;
  Ok(Some(serde_json::from_value(info.clone())?))
}

pub fn list_session_request(port: u16) -> Value {
  json!({
      "event": "Customized",
      "data": {
          "type": "ListSession",
          "sender": port,
          "data": {},
      },
  })
}

pub fn parse_session_list_response(value: &Value) -> Result<Option<Vec<Session>>> {
  if customized_type(value) != Some("SessionList") {
    return Ok(None);
  }

  let data = value
    .get("data")
    .and_then(|data| data.get("data"))
    .ok_or_else(|| Error::Protocol("SessionList response missing data.data".into()))?;
  Ok(Some(serde_json::from_value(data.clone())?))
}

pub fn global_switch_request(kind: &str, port: u16, key: &str, value: Option<bool>) -> Value {
  json!({
      "event": "Customized",
      "data": {
          "type": kind,
          "sender": port,
          "data": {
              "client_id": port,
              "session_id": -1,
              "message": {
                  "global_key": key,
                  "global_value": value,
              },
          },
      },
  })
}

pub fn parse_global_switch_response(value: &Value, kind: &str) -> Result<Option<bool>> {
  if customized_type(value) != Some(kind) {
    return Ok(None);
  }

  let message = value
    .get("data")
    .and_then(|data| data.get("data"))
    .and_then(|data| data.get("message"))
    .ok_or_else(|| Error::Protocol(format!("{kind} response missing message")))?;

  Ok(Some(match message {
    Value::Bool(value) => *value,
    Value::String(value) => value == "true",
    Value::Object(object) => object
      .get("global_value")
      .map(|value| value == true || value.as_str() == Some("true"))
      .unwrap_or(false),
    _ => false,
  }))
}

pub fn cdp_request(port: u16, session_id: i64, id: u32, method: &str, params: Value) -> Value {
  json!({
      "event": "Customized",
      "data": {
          "type": "CDP",
          "sender": port,
          "data": {
              "client_id": port,
              "session_id": session_id,
              "message": {
                  "id": id,
                  "method": method,
                  "params": params,
              },
          },
      },
  })
}

pub fn parse_cdp_response(value: &Value, expected_id: u32) -> Result<Option<Value>> {
  let Some(message) = parse_customized_message(value, "CDP")? else {
    return Ok(None);
  };

  if message.get("id").and_then(Value::as_u64) != Some(expected_id as u64) {
    return Ok(None);
  }

  if let Some(error) = message.get("error") {
    let text = error
      .get("message")
      .and_then(Value::as_str)
      .unwrap_or("unknown CDP error");
    return Err(Error::Cdp(text.to_string()));
  }

  message
    .get("result")
    .cloned()
    .map(Some)
    .ok_or_else(|| Error::Protocol("CDP response missing result".into()))
}

pub fn parse_cdp_event(value: &Value, expected_method: &str) -> Result<Option<Value>> {
  let Some(message) = parse_customized_message(value, "CDP")? else {
    return Ok(None);
  };

  if message.get("method").and_then(Value::as_str) != Some(expected_method) {
    return Ok(None);
  }

  Ok(Some(message))
}

pub fn app_request(port: u16, id: u32, method: &str, params: Value) -> Value {
  json!({
      "event": "Customized",
      "data": {
          "type": "App",
          "sender": port,
          "data": {
              "client_id": port,
              "session_id": -1,
              "message": {
                  "id": id,
                  "method": method,
                  "params": params,
              },
          },
      },
  })
}

pub fn parse_app_response(value: &Value, expected_id: u32, method: &str) -> Result<Option<Value>> {
  let Some(message) = parse_customized_message(value, "App")? else {
    return Ok(None);
  };

  if message.get("id").and_then(Value::as_u64) != Some(expected_id as u64) {
    return Ok(None);
  }

  let result = message
    .get("result")
    .and_then(Value::as_str)
    .ok_or_else(|| Error::Protocol("App response missing JSON string result".into()))?;
  let result: Value = serde_json::from_str(result)?;
  let code = result.get("code");
  if code != Some(&Value::from(0)) && code.and_then(Value::as_str) != Some("0") {
    let text = result
      .get("message")
      .and_then(Value::as_str)
      .unwrap_or("unknown App error");
    return Err(Error::App(format!("App request {method} error: {text}")));
  }

  Ok(Some(result))
}

pub fn open_card_request(url: &str) -> Value {
  json!({
      "event": "Customized",
      "data": {
          "type": "OpenCard",
          "data": {
              "type": "url",
              "url": url,
          },
          "sender": -1,
      },
      "from": -1,
  })
}

fn parse_customized_message(value: &Value, expected_type: &str) -> Result<Option<Value>> {
  if customized_type(value) != Some(expected_type) {
    return Ok(None);
  }

  let message = value
    .get("data")
    .and_then(|data| data.get("data"))
    .and_then(|data| data.get("message"))
    .and_then(Value::as_str)
    .ok_or_else(|| Error::Protocol(format!("{expected_type} response missing message")))?;
  Ok(Some(serde_json::from_str(message)?))
}

fn customized_type(value: &Value) -> Option<&str> {
  if value.get("event").and_then(Value::as_str) != Some("Customized") {
    return None;
  }

  value
    .get("data")
    .and_then(|data| data.get("type"))
    .and_then(Value::as_str)
}

fn write_u32(target: &mut [u8], value: u32) {
  target.copy_from_slice(&value.to_be_bytes());
}

fn read_u32(source: &[u8]) -> u32 {
  u32::from_be_bytes(
    source
      .try_into()
      .expect("slice length is checked by caller"),
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn peertalk_frame_roundtrip() {
    let value = json!({ "event": "Initialize", "data": 8901 });
    let frame = encode_peertalk_message(&value).unwrap();

    assert_eq!(read_u32(&frame[0..4]), PEERTALK_VERSION);
    assert_eq!(read_u32(&frame[4..8]), PEERTALK_TYPE);
    assert_eq!(
      read_u32(&frame[16..20]),
      frame.len() as u32 - PEERTALK_HEADER_LEN as u32
    );

    let payload: Value = serde_json::from_slice(&frame[PEERTALK_HEADER_LEN..]).unwrap();
    assert_eq!(payload, value);
  }

  #[tokio::test]
  async fn rejects_oversized_peertalk_frame() {
    let mut frame = [0_u8; PEERTALK_HEADER_LEN];
    write_u32(&mut frame[16..20], MAX_PEERTALK_PAYLOAD_LEN as u32 + 1);

    let mut reader = &frame[..];
    let error = read_peertalk_message(&mut reader)
      .await
      .expect_err("oversized frame is rejected before payload allocation");
    assert!(error
      .to_string()
      .contains("Peertalk payload length 16777217 exceeds"));
  }

  #[test]
  fn parses_session_list() {
    let response = json!({
        "event": "Customized",
        "data": {
            "type": "SessionList",
            "sender": 8901,
            "data": [{ "session_id": 1, "type": "", "url": "main.lynx.bundle" }]
        }
    });

    let sessions = parse_session_list_response(&response).unwrap().unwrap();
    assert_eq!(sessions[0].session_id, 1);
    assert_eq!(sessions[0].url, "main.lynx.bundle");
  }
}
