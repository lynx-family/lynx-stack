// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::prelude::{Engine, BASE64_STANDARD};
use serde_json::{json, Value};
use thiserror::Error;
use tokio::time::sleep;

use crate::adb::AndroidDevice;
use crate::protocol::{
  ComputedStyleProperty, GetAttributesResult, GetBoxModelResult, GetComputedStyleResult,
  GetDocumentResult, NodeInfo, QuerySelectorResult, ScreenshotEventParams, Session,
};
use crate::transport::Connector;

pub type Result<T> = std::result::Result<T, Error>;

#[derive(Debug, Error)]
pub enum Error {
  #[error("no Android device connected")]
  NoDevice,
  #[error("Android device not found: {0}")]
  DeviceNotFound(String),
  #[error("package not found on selected Android device: {0}")]
  PackageNotFound(String),
  #[error("failed to launch Android app: {0}")]
  AppLaunch(String),
  #[error("failed to find Lynx debug-router client for package: {0}")]
  ClientNotFound(String),
  #[error("cannot find session for URL: {0}")]
  SessionNotFound(String),
  #[error("operation timed out: {0}")]
  Timeout(String),
  #[error("protocol error: {0}")]
  Protocol(String),
  #[error("CDP request error: {0}")]
  Cdp(String),
  #[error("App request error: {0}")]
  App(String),
  #[error("ADB error: {0}")]
  Adb(#[from] droidrun_adb::AdbError),
  #[error("I/O error: {0}")]
  Io(#[from] std::io::Error),
  #[error("JSON error: {0}")]
  Json(#[from] serde_json::Error),
  #[error("base64 error: {0}")]
  Base64(#[from] base64::DecodeError),
  #[error("image error: {0}")]
  Image(#[from] image::ImageError),
}

#[derive(Debug, Clone)]
pub struct ConnectOptions {
  pub device_id: Option<String>,
  pub app_package: String,
  pub clear_data: bool,
}

impl Default for ConnectOptions {
  fn default() -> Self {
    Self {
      device_id: None,
      app_package: "com.lynx.explorer".to_string(),
      clear_data: false,
    }
  }
}

#[derive(Debug, Clone, Default)]
pub struct ScreenshotOptions {
  pub path: Option<PathBuf>,
}

#[derive(Debug)]
pub struct Lynx {
  connector: Arc<Connector>,
  client_port: u16,
}

impl Lynx {
  pub async fn connect(options: ConnectOptions) -> Result<Self> {
    let device = AndroidDevice::choose(options.device_id.as_deref(), &options.app_package).await?;
    device
      .prepare_app(&options.app_package, options.clear_data)
      .await?;

    let connector = Arc::new(Connector::new(device));
    let client = wait_for_client(&connector, &options.app_package, Duration::from_secs(60)).await?;

    Ok(Self {
      connector,
      client_port: client.port,
    })
  }

  pub fn new_page(&self) -> Page {
    Page::new(Arc::clone(&self.connector), self.client_port)
  }

  pub fn device_serial(&self) -> &str {
    self.connector.device().serial()
  }

  pub async fn reverse(&self, remote_port: u16, local_port: u16) -> Result<()> {
    self
      .connector
      .device()
      .reverse(remote_port, local_port)
      .await
  }

  pub async fn remove_reverse(&self, remote_port: u16) -> Result<()> {
    self.connector.device().remove_reverse(remote_port).await
  }
}

#[derive(Debug)]
pub struct Page {
  connector: Arc<Connector>,
  client_port: u16,
  session_id: Option<i64>,
  root_node_id: Option<i64>,
  url: String,
}

impl Page {
  fn new(connector: Arc<Connector>, client_port: u16) -> Self {
    Self {
      connector,
      client_port,
      session_id: None,
      root_node_id: None,
      url: String::new(),
    }
  }

  pub async fn goto(&mut self, url: &str, timeout_duration: Duration) -> Result<()> {
    self.wait_for_devtool(Duration::from_secs(60)).await?;
    let existing = self
      .connector
      .list_sessions(self.client_port)
      .await
      .unwrap_or_default()
      .into_iter()
      .map(|session| session.session_id)
      .collect::<Vec<_>>();

    if self
      .connector
      .send_app_open_page(self.client_port, url)
      .await
      .is_err()
    {
      let _ = self.connector.send_open_card(self.client_port, url).await;
    }

    let session = self
      .wait_for_session(url, &existing, timeout_duration)
      .await
      .ok_or_else(|| Error::SessionNotFound(url.to_string()))?;

    self.attach_to_session(session.session_id).await?;
    self.url = url.to_string();
    Ok(())
  }

  pub fn url(&self) -> &str {
    &self.url
  }

  pub async fn locator(&self, selector: &str) -> Result<Option<Element>> {
    let session_id = self.session_id()?;
    let root_node_id = self
      .root_node_id
      .ok_or_else(|| Error::Protocol("page has no root node; call goto first".into()))?;
    let mut result = self
      .query_selector(session_id, root_node_id, selector)
      .await?;

    if result.node_id == -1 {
      let refreshed_root_node_id = self.current_root_node_id(session_id).await?;
      result = self
        .query_selector(session_id, refreshed_root_node_id, selector)
        .await?;
      if result.node_id == -1 {
        return Ok(None);
      }
    }

    Ok(Some(Element {
      connector: Arc::clone(&self.connector),
      client_port: self.client_port,
      session_id,
      node_id: result.node_id,
    }))
  }

  async fn query_selector(
    &self,
    session_id: i64,
    root_node_id: i64,
    selector: &str,
  ) -> Result<QuerySelectorResult> {
    self
      .connector
      .send_cdp(
        self.client_port,
        session_id,
        "DOM.querySelector",
        json!({ "nodeId": root_node_id, "selector": selector }),
      )
      .await
  }

  async fn current_root_node_id(&self, session_id: i64) -> Result<i64> {
    let document: GetDocumentResult = self
      .connector
      .send_cdp(
        self.client_port,
        session_id,
        "DOM.getDocument",
        json!({ "depth": -1 }),
      )
      .await?;
    Ok(
      document
        .root
        .children
        .first()
        .unwrap_or(&document.root)
        .node_id,
    )
  }

  pub async fn content(&self) -> Result<String> {
    let session_id = self.session_id()?;
    let document: GetDocumentResult = self
      .connector
      .send_cdp(
        self.client_port,
        session_id,
        "DOM.getDocument",
        json!({ "depth": -1 }),
      )
      .await?;

    let mut buffer = String::new();
    content_to_string(&mut buffer, &document.root);
    Ok(buffer)
  }

  pub async fn screenshot(&self, options: ScreenshotOptions) -> Result<Vec<u8>> {
    let session_id = self.session_id()?;
    let event: Value = self
      .connector
      .send_cdp_event(
        self.client_port,
        session_id,
        "Lynx.getScreenshot",
        json!({}),
        "Lynx.screenshotCaptured",
        Duration::from_secs(10),
      )
      .await?;
    let params: ScreenshotEventParams = serde_json::from_value(
      event
        .get("params")
        .cloned()
        .ok_or_else(|| Error::Protocol("screenshot event missing params".into()))?,
    )?;
    let data = BASE64_STANDARD.decode(strip_base64_whitespace(&params.data))?;

    if let Some(path) = options.path {
      std::fs::write(path, &data)?;
    }

    Ok(data)
  }

  async fn wait_for_devtool(&self, timeout_duration: Duration) -> Result<()> {
    let start = Instant::now();
    while start.elapsed() < timeout_duration {
      if self.connector.list_sessions(self.client_port).await.is_ok() {
        return Ok(());
      }
      sleep(Duration::from_millis(500)).await;
    }

    Err(Error::Timeout(
      "timed out waiting for Lynx App devtool to boot".into(),
    ))
  }

  async fn wait_for_session(
    &self,
    url: &str,
    existing_session_ids: &[i64],
    timeout_duration: Duration,
  ) -> Option<Session> {
    let url_path = url.rsplit('/').next().unwrap_or(url);
    let start = Instant::now();
    let mut fallback_match = None;

    while start.elapsed() < timeout_duration {
      sleep(Duration::from_millis(500)).await;
      let Ok(sessions) = self.connector.list_sessions(self.client_port).await else {
        continue;
      };

      let matches = sessions
        .into_iter()
        .filter(|session| session_url_matches(url, url_path, &session.url))
        .collect::<Vec<_>>();

      if let Some(new_match) = matches
        .iter()
        .find(|session| !existing_session_ids.contains(&session.session_id))
      {
        return Some(new_match.clone());
      }

      fallback_match = matches.into_iter().max_by_key(|session| session.session_id);
    }

    fallback_match
  }

  async fn attach_to_session(&mut self, session_id: i64) -> Result<()> {
    let _: Value = self
      .connector
      .send_cdp(self.client_port, session_id, "DOM.enable", json!({}))
      .await?;
    let document: GetDocumentResult = self
      .connector
      .send_cdp(
        self.client_port,
        session_id,
        "DOM.getDocument",
        json!({ "depth": -1 }),
      )
      .await?;
    let root = document
      .root
      .children
      .first()
      .unwrap_or(&document.root)
      .node_id;

    self.session_id = Some(session_id);
    self.root_node_id = Some(root);
    Ok(())
  }

  fn session_id(&self) -> Result<i64> {
    self
      .session_id
      .ok_or_else(|| Error::Protocol("page is not attached; call goto first".into()))
  }
}

#[derive(Debug, Clone)]
pub struct Element {
  connector: Arc<Connector>,
  client_port: u16,
  session_id: i64,
  pub node_id: i64,
}

impl Element {
  pub async fn tap(&self) -> Result<()> {
    let result: GetBoxModelResult = self
      .connector
      .send_cdp(
        self.client_port,
        self.session_id,
        "DOM.getBoxModel",
        json!({ "nodeId": self.node_id }),
      )
      .await?;
    if result.model.content.len() != 8 {
      return Err(Error::Protocol(format!(
        "could not determine coordinates for node {}",
        self.node_id
      )));
    }

    let x = (result.model.content[0] + result.model.content[4]) / 2.0;
    let y = (result.model.content[1] + result.model.content[5]) / 2.0;

    let _: Value = self
      .connector
      .send_cdp(
        self.client_port,
        self.session_id,
        "Input.emulateTouchFromMouseEvent",
        json!({ "type": "mousePressed", "x": x, "y": y, "button": "left" }),
      )
      .await?;
    sleep(Duration::from_millis(50)).await;
    let _: Value = self
      .connector
      .send_cdp(
        self.client_port,
        self.session_id,
        "Input.emulateTouchFromMouseEvent",
        json!({ "type": "mouseReleased", "x": x, "y": y, "button": "left" }),
      )
      .await?;
    Ok(())
  }

  pub async fn get_attribute(&self, name: &str) -> Result<Option<String>> {
    let lookup_name = if name == "id" { "idSelector" } else { name };
    let result: GetAttributesResult = self
      .connector
      .send_cdp(
        self.client_port,
        self.session_id,
        "DOM.getAttributes",
        json!({ "nodeId": self.node_id }),
      )
      .await?;
    let attributes = result
      .attributes
      .chunks(2)
      .filter_map(|chunk| Some((chunk.first()?.to_string(), chunk.get(1)?.to_string())))
      .collect::<BTreeMap<_, _>>();

    Ok(attributes.get(lookup_name).cloned())
  }

  pub async fn computed_style_map(&self) -> Result<BTreeMap<String, String>> {
    let result: GetComputedStyleResult = self
      .connector
      .send_cdp(
        self.client_port,
        self.session_id,
        "CSS.getComputedStyleForNode",
        json!({ "nodeId": self.node_id }),
      )
      .await?;

    Ok(
      result
        .computed_style
        .into_iter()
        .map(|ComputedStyleProperty { name, value }| (name, value))
        .collect(),
    )
  }
}

async fn wait_for_client(
  connector: &Connector,
  package_name: &str,
  timeout_duration: Duration,
) -> Result<crate::protocol::Client> {
  let start = Instant::now();
  while start.elapsed() < timeout_duration {
    if let Some(client) = connector
      .list_clients()
      .await
      .into_iter()
      .find(|client| client.info.matches_package(package_name))
    {
      return Ok(client);
    }
    sleep(Duration::from_secs(1)).await;
  }

  Err(Error::ClientNotFound(package_name.to_string()))
}

fn strip_base64_whitespace(value: &str) -> String {
  value
    .chars()
    .filter(|character| !character.is_ascii_whitespace())
    .collect()
}

fn content_to_string(buffer: &mut String, node: &NodeInfo) {
  let tag_name = node.node_name.to_lowercase();
  buffer.push('<');
  buffer.push_str(&tag_name);

  for pair in node.attributes.chunks(2) {
    let Some(key) = pair.first() else {
      continue;
    };
    let Some(value) = pair.get(1) else {
      continue;
    };

    let key = if key.eq_ignore_ascii_case("idselector") {
      "id".to_string()
    } else {
      key.to_lowercase()
    };
    buffer.push(' ');
    buffer.push_str(&key);
    buffer.push_str("=\"");
    buffer.push_str(value);
    buffer.push('"');
  }

  buffer.push('>');
  for child in &node.children {
    content_to_string(buffer, child);
  }
  buffer.push_str("</");
  buffer.push_str(&tag_name);
  buffer.push('>');
}

fn session_url_matches(url: &str, url_path: &str, session_url: &str) -> bool {
  session_url == url
    || session_url == url_path
    || url.ends_with(session_url)
    || session_url.ends_with(url_path)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn matches_session_url_like_typescript_implementation() {
    assert!(session_url_matches(
      "http://127.0.0.1:3001/react-example.lynx.bundle",
      "react-example.lynx.bundle",
      "react-example.lynx.bundle"
    ));
    assert!(session_url_matches(
      "http://127.0.0.1:3001/react-example.lynx.bundle",
      "react-example.lynx.bundle",
      "http://127.0.0.1:3001/react-example.lynx.bundle"
    ));
    assert!(!session_url_matches(
      "http://127.0.0.1:3001/react-example.lynx.bundle",
      "react-example.lynx.bundle",
      "other.lynx.bundle"
    ));
  }

  #[test]
  fn serializes_content_and_maps_id_selector() {
    let node = NodeInfo {
      node_id: 1,
      node_name: "VIEW".into(),
      attributes: vec![
        "idSelector".into(),
        "main".into(),
        "class".into(),
        "Root".into(),
      ],
      children: vec![NodeInfo {
        node_id: 2,
        node_name: "TEXT".into(),
        attributes: vec!["text".into(), "hello".into()],
        children: vec![],
      }],
    };
    let mut output = String::new();
    content_to_string(&mut output, &node);
    assert_eq!(
      output,
      r#"<view id="main" class="Root"><text text="hello"></text></view>"#
    );
  }

  #[test]
  fn strips_base64_whitespace() {
    assert_eq!(strip_base64_whitespace("YW Jj\nZA==\r\n"), "YWJjZA==");
  }
}
