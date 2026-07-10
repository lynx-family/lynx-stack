use serde::de::DeserializeOwned;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use crate::{Error, Result};

const PEERTALK_HEADER_LEN: usize = 20;
const MAX_PEERTALK_PAYLOAD_LEN: usize = 16 * 1024 * 1024;
const PEERTALK_VERSION: u32 = 1;
const PEERTALK_TYPE: u32 = 101;

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct AppInfo {
  #[serde(rename = "App")]
  pub app: String,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub(crate) struct Session {
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
pub(crate) struct GetDocumentResult {
  pub root: NodeInfo,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct QuerySelectorResult {
  #[serde(rename = "nodeId")]
  pub node_id: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GetAttributesResult {
  pub attributes: Vec<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GetBoxModelResult {
  pub model: BoxModel,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct BoxModel {
  #[serde(default)]
  pub content: Vec<f64>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct GetComputedStyleResult {
  #[serde(default, rename = "computedStyle")]
  pub computed_style: Vec<ComputedStyleProperty>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ComputedStyleProperty {
  pub name: String,
  pub value: String,
}

pub(crate) async fn write_peertalk_message<W: AsyncWrite + Unpin, T: Serialize>(
  writer: &mut W,
  message: &T,
) -> Result<()> {
  let body = serde_json::to_vec(message)?;
  let len = body.len();
  let mut frame = vec![0_u8; PEERTALK_HEADER_LEN + len];
  write_u32(&mut frame[0..4], PEERTALK_VERSION);
  write_u32(&mut frame[4..8], PEERTALK_TYPE);
  write_u32(&mut frame[8..12], 0);
  write_u32(&mut frame[12..16], len as u32 + 4);
  write_u32(&mut frame[16..20], len as u32);
  frame[PEERTALK_HEADER_LEN..].copy_from_slice(&body);
  writer.write_all(&frame).await?;
  writer.flush().await?;
  Ok(())
}

pub(crate) async fn read_peertalk_message<R: AsyncRead + Unpin>(reader: &mut R) -> Result<Value> {
  let mut header = [0_u8; PEERTALK_HEADER_LEN];
  reader.read_exact(&mut header).await?;
  let payload_len = read_u32(&header[16..20]) as usize;
  if payload_len > MAX_PEERTALK_PAYLOAD_LEN {
    return Err(Error::Protocol(format!(
      "Peertalk payload length {payload_len} exceeds {MAX_PEERTALK_PAYLOAD_LEN} bytes"
    )));
  }
  let mut payload = vec![0_u8; payload_len];
  reader.read_exact(&mut payload).await?;
  Ok(serde_json::from_slice(&payload)?)
}

pub(crate) fn initialize_request(port: u16) -> Value {
  json!({ "event": "Initialize", "data": port })
}

pub(crate) fn parse_initialize_response(value: &Value) -> Result<Option<AppInfo>> {
  if value.get("event").and_then(Value::as_str) != Some("Register") {
    return Ok(None);
  }
  let info = value
    .get("data")
    .and_then(|data| data.get("info"))
    .ok_or_else(|| Error::Protocol("Register response missing data.info".into()))?;
  Ok(Some(serde_json::from_value(info.clone())?))
}

pub(crate) fn list_session_request(port: u16) -> Value {
  json!({
    "event": "Customized",
    "data": {
      "type": "ListSession",
      "sender": port,
      "data": { "client_id": port },
    },
  })
}

pub(crate) fn parse_session_list_response(value: &Value) -> Result<Option<Vec<Session>>> {
  if customized_type(value) != Some("SessionList") {
    return Ok(None);
  }
  let data = value
    .get("data")
    .and_then(|data| data.get("data"))
    .ok_or_else(|| Error::Protocol("SessionList response missing data.data".into()))?;
  Ok(Some(serde_json::from_value(data.clone())?))
}

pub(crate) fn global_switch_request(port: u16, key: &str, value: bool) -> Value {
  json!({
    "event": "Customized",
    "data": {
      "type": "SetGlobalSwitch",
      "sender": port,
      "data": {
        "client_id": port,
        "session_id": -1,
        "message": { "global_key": key, "global_value": value },
      },
    },
  })
}

pub(crate) fn parse_global_switch_response(value: &Value) -> Result<Option<()>> {
  if customized_type(value) == Some("SetGlobalSwitch") {
    Ok(Some(()))
  } else {
    Ok(None)
  }
}

pub(crate) fn cdp_request(
  port: u16,
  session_id: i64,
  id: u32,
  method: &str,
  params: Value,
) -> Value {
  json!({
    "event": "Customized",
    "data": {
      "type": "CDP",
      "sender": port,
      "data": {
        "client_id": port,
        "session_id": session_id,
        "message": { "id": id, "method": method, "params": params },
      },
    },
  })
}

pub(crate) fn parse_cdp_response<T: DeserializeOwned>(
  value: &Value,
  expected_id: u32,
) -> Result<Option<T>> {
  if customized_type(value) != Some("CDP") {
    return Ok(None);
  }
  let message = value
    .get("data")
    .and_then(|data| data.get("data"))
    .and_then(|data| data.get("message"))
    .and_then(Value::as_str)
    .ok_or_else(|| Error::Protocol("CDP response missing message".into()))?;
  let message: Value = serde_json::from_str(message)?;
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
  let result = message
    .get("result")
    .cloned()
    .ok_or_else(|| Error::Protocol("CDP response missing result".into()))?;
  Ok(Some(serde_json::from_value(result)?))
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
  u32::from_be_bytes(source.try_into().expect("four byte slice"))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn cdp_response(message: Value) -> Value {
    json!({
      "event": "Customized",
      "data": {
        "type": "CDP",
        "data": { "message": message.to_string() },
      },
    })
  }

  #[tokio::test]
  async fn peertalk_frame_roundtrip() {
    let value = json!({ "event": "Initialize", "data": 8901 });
    let (mut writer, mut reader) = tokio::io::duplex(1024);
    write_peertalk_message(&mut writer, &value).await.unwrap();
    assert_eq!(read_peertalk_message(&mut reader).await.unwrap(), value);
  }

  #[test]
  fn parses_session_list() {
    let response = json!({
      "event": "Customized",
      "data": {
        "type": "SessionList",
        "data": [{ "session_id": 1, "url": "main.lynx.bundle" }],
      },
    });
    let sessions = parse_session_list_response(&response).unwrap().unwrap();
    assert_eq!(sessions[0].session_id, 1);
  }

  #[test]
  fn parses_matching_cdp_response() {
    let response = cdp_response(json!({
      "id": 42,
      "result": { "nodeId": 7 },
    }));
    let result: QuerySelectorResult = parse_cdp_response(&response, 42).unwrap().unwrap();
    assert_eq!(result.node_id, 7);
  }

  #[test]
  fn extracts_cdp_protocol_errors() {
    let response = cdp_response(json!({
      "id": 42,
      "error": { "message": "node not found" },
    }));
    assert!(matches!(
      parse_cdp_response::<Value>(&response, 42),
      Err(Error::Cdp(message)) if message == "node not found"
    ));
  }

  #[test]
  fn ignores_cdp_response_with_a_different_id() {
    let response = cdp_response(json!({
      "id": 99,
      "result": {},
    }));
    assert!(parse_cdp_response::<Value>(&response, 42)
      .unwrap()
      .is_none());
  }

  #[test]
  fn rejects_cdp_response_without_a_result() {
    let response = cdp_response(json!({ "id": 42 }));
    assert!(matches!(
      parse_cdp_response::<Value>(&response, 42),
      Err(Error::Protocol(message)) if message == "CDP response missing result"
    ));
  }

  #[test]
  fn parses_initialize_response() {
    let response = json!({
      "event": "Register",
      "data": { "info": { "App": "headless" } },
    });
    let info = parse_initialize_response(&response).unwrap().unwrap();
    assert_eq!(info.app, "headless");

    assert!(parse_initialize_response(&json!({ "event": "Customized" }))
      .unwrap()
      .is_none());
  }

  #[test]
  fn rejects_initialize_response_without_app_info() {
    let missing_info = json!({
      "event": "Register",
      "data": {},
    });
    assert!(matches!(
      parse_initialize_response(&missing_info),
      Err(Error::Protocol(message)) if message == "Register response missing data.info"
    ));

    let missing_app = json!({
      "event": "Register",
      "data": { "info": {} },
    });
    assert!(matches!(
      parse_initialize_response(&missing_app),
      Err(Error::Json(_))
    ));
  }
}
