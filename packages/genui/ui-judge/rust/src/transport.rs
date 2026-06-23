// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::net::TcpStream;
use tokio::time::timeout;

use crate::adb::AndroidDevice;
use crate::api::{Error, Result};
use crate::protocol::{
  app_request, cdp_request, global_switch_request, initialize_request, list_session_request,
  open_card_request, parse_app_response, parse_cdp_event, parse_cdp_response,
  parse_global_switch_response, parse_initialize_response, parse_session_list_response,
  read_peertalk_message, write_peertalk_message, Client, Session,
};

const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const SCAN_TIMEOUT: Duration = Duration::from_secs(2);

#[derive(Debug)]
pub struct Connector {
  device: AndroidDevice,
  next_id: AtomicU32,
}

impl Connector {
  pub fn new(device: AndroidDevice) -> Self {
    Self {
      device,
      next_id: AtomicU32::new(10_000),
    }
  }

  pub fn device(&self) -> &AndroidDevice {
    &self.device
  }

  pub async fn list_clients(&self) -> Vec<Client> {
    let mut clients = Vec::new();

    for port in 8901..=8910 {
      let Ok(info) = self.initialize(port).await else {
        continue;
      };

      let _ = self.set_global_switch(port, "enable_devtool", true).await;
      clients.push(Client { port, info });
    }

    clients
  }

  pub async fn list_sessions(&self, port: u16) -> Result<Vec<Session>> {
    self
      .request_until(
        port,
        list_session_request(port),
        REQUEST_TIMEOUT,
        parse_session_list_response,
      )
      .await
  }

  pub async fn set_global_switch(&self, port: u16, key: &str, value: bool) -> Result<()> {
    self
      .request_until(
        port,
        global_switch_request("SetGlobalSwitch", port, key, Some(value)),
        REQUEST_TIMEOUT,
        |message| parse_global_switch_response(message, "SetGlobalSwitch"),
      )
      .await
      .map(|_: bool| ())
  }

  pub async fn send_app_open_page(&self, port: u16, url: &str) -> Result<()> {
    let id = self.next_message_id();
    self
      .request_until(
        port,
        app_request(port, id, "App.openPage", json!({ "url": url })),
        REQUEST_TIMEOUT,
        |message| parse_app_response(message, id, "App.openPage"),
      )
      .await
      .map(|_: Value| ())
  }

  pub async fn send_open_card(&self, port: u16, url: &str) -> Result<()> {
    self
      .request_any(port, open_card_request(url), REQUEST_TIMEOUT)
      .await
      .map(|_| ())
  }

  pub async fn send_cdp<T, P>(
    &self,
    port: u16,
    session_id: i64,
    method: &str,
    params: P,
  ) -> Result<T>
  where
    T: DeserializeOwned,
    P: Serialize,
  {
    let id = self.next_message_id();
    let params = serde_json::to_value(params)?;
    let result = self
      .request_until(
        port,
        cdp_request(port, session_id, id, method, params),
        REQUEST_TIMEOUT,
        |message| parse_cdp_response(message, id),
      )
      .await?;
    Ok(serde_json::from_value(result)?)
  }

  pub async fn send_cdp_event<T, P>(
    &self,
    port: u16,
    session_id: i64,
    method: &str,
    params: P,
    event_method: &str,
    duration: Duration,
  ) -> Result<T>
  where
    T: DeserializeOwned,
    P: Serialize,
  {
    let id = self.next_message_id();
    let params = serde_json::to_value(params)?;
    let event = self
      .request_until(
        port,
        cdp_request(port, session_id, id, method, params),
        duration,
        |message| parse_cdp_event(message, event_method),
      )
      .await?;
    Ok(serde_json::from_value(event)?)
  }

  async fn initialize(&self, port: u16) -> Result<crate::protocol::AppInfo> {
    self
      .request_until(
        port,
        initialize_request(port),
        SCAN_TIMEOUT,
        parse_initialize_response,
      )
      .await
  }

  async fn request_any(&self, port: u16, request: Value, duration: Duration) -> Result<Value> {
    self
      .request_until(port, request, duration, |message| Ok(Some(message.clone())))
      .await
  }

  async fn request_until<T, F>(
    &self,
    port: u16,
    request: Value,
    duration: Duration,
    mut parse: F,
  ) -> Result<T>
  where
    F: FnMut(&Value) -> Result<Option<T>>,
  {
    let local_port = self.device.forward(port).await?;
    let result = timeout(duration, async {
      let mut stream = TcpStream::connect(("127.0.0.1", local_port)).await?;
      write_peertalk_message(&mut stream, &request).await?;

      loop {
        let message = read_peertalk_message(&mut stream).await?;
        if let Some(result) = parse(&message)? {
          return Ok(result);
        }
      }
    })
    .await;

    let cleanup_result = self.device.remove_forward(local_port).await;

    match result {
      Ok(Ok(value)) => {
        cleanup_result?;
        Ok(value)
      }
      Ok(Err(error)) => Err(error),
      Err(_) => Err(Error::Timeout(format!(
        "timed out waiting for debug-router response on port {port}"
      ))),
    }
  }

  fn next_message_id(&self) -> u32 {
    let id = self.next_id.fetch_add(1, Ordering::Relaxed);
    if id >= 50_000 {
      self.next_id.store(10_000, Ordering::Relaxed);
    }
    id
  }
}
