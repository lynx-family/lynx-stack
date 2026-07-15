use std::net::Ipv4Addr;
use std::sync::atomic::{AtomicU32, Ordering};
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use tokio::net::TcpStream;
use tokio::sync::Mutex;
use tokio::time::{sleep, timeout};

use crate::protocol::{
  cdp_request, global_switch_request, initialize_request, list_session_request, parse_cdp_response,
  parse_global_switch_response, parse_initialize_response, parse_session_list_response,
  read_peertalk_message, write_peertalk_message, Session,
};
use crate::{Error, Result};

const FIRST_DEBUG_ROUTER_PORT: u16 = 8901;
const LAST_DEBUG_ROUTER_PORT: u16 = 8910;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const SCAN_TIMEOUT: Duration = Duration::from_millis(500);

#[derive(Clone, Copy)]
enum ResponseKind {
  SessionList,
  GlobalSwitch,
  Cdp(u32),
}

impl ResponseKind {
  fn matches(self, message: &Value) -> Result<bool> {
    match self {
      Self::SessionList => Ok(parse_session_list_response(message)?.is_some()),
      Self::GlobalSwitch => Ok(parse_global_switch_response(message)?.is_some()),
      Self::Cdp(id) => Ok(parse_cdp_response::<Value>(message, id)?.is_some()),
    }
  }
}

#[derive(Debug)]
pub(crate) struct DebugRouter {
  port: u16,
  stream: Mutex<TcpStream>,
  next_id: AtomicU32,
}

impl DebugRouter {
  pub(crate) async fn connect(app_name: &str, connect_timeout: Duration) -> Result<Self> {
    timeout(connect_timeout, async {
      loop {
        for port in FIRST_DEBUG_ROUTER_PORT..=LAST_DEBUG_ROUTER_PORT {
          if let Ok((stream, info)) = initialize(port).await {
            if info.app == app_name {
              let router = Self {
                port,
                stream: Mutex::new(stream),
                next_id: AtomicU32::new(10_000),
              };
              router
                .set_global_switch("enable_devtool", true)
                .await
                .map_err(|error| {
                  Error::Protocol(format!(
                    "failed to enable debug-router switch enable_devtool: {error}"
                  ))
                })?;
              router
                .set_global_switch("enable_dom_tree", true)
                .await
                .map_err(|error| {
                  Error::Protocol(format!(
                    "failed to enable debug-router switch enable_dom_tree: {error}"
                  ))
                })?;
              return Ok(router);
            }
          }
        }
        sleep(Duration::from_millis(100)).await;
      }
    })
    .await
    .map_err(|_| {
      Error::Timeout(format!(
        "connecting to debug-router client {app_name} within {connect_timeout:?}"
      ))
    })?
  }

  pub(crate) async fn list_sessions(&self) -> Result<Vec<Session>> {
    let response = self
      .request_until(
        list_session_request(self.port),
        REQUEST_TIMEOUT,
        ResponseKind::SessionList,
      )
      .await?;
    parse_session_list_response(&response)?
      .ok_or_else(|| Error::Protocol("matched SessionList response could not be parsed".into()))
  }

  pub(crate) async fn send_cdp<T, P>(&self, session_id: i64, method: &str, params: P) -> Result<T>
  where
    T: DeserializeOwned,
    P: Serialize,
  {
    let id = self.next_message_id();
    let request = cdp_request(
      self.port,
      session_id,
      id,
      method,
      serde_json::to_value(params)?,
    );
    let response = self
      .request_until(request, REQUEST_TIMEOUT, ResponseKind::Cdp(id))
      .await?;
    parse_cdp_response(&response, id)?
      .ok_or_else(|| Error::Protocol(format!("matched CDP response {id} could not be parsed")))
  }

  async fn set_global_switch(&self, key: &str, value: bool) -> Result<()> {
    let response = self
      .request_until(
        global_switch_request(self.port, key, value),
        REQUEST_TIMEOUT,
        ResponseKind::GlobalSwitch,
      )
      .await?;
    parse_global_switch_response(&response)?.ok_or_else(|| {
      Error::Protocol(format!(
        "matched SetGlobalSwitch response for {key} could not be parsed"
      ))
    })
  }

  async fn request_until(
    &self,
    request: Value,
    request_timeout: Duration,
    response_kind: ResponseKind,
  ) -> Result<Value> {
    let mut stream = self.stream.lock().await;
    write_peertalk_message(&mut *stream, &request).await?;
    let port = self.port;
    timeout(request_timeout, async {
      loop {
        let message = read_peertalk_message(&mut *stream).await?;
        if response_kind.matches(&message)? {
          return Ok(message);
        }
      }
    })
    .await
    .map_err(|_| Error::Timeout(format!("debug-router request on port {port}")))?
  }

  fn next_message_id(&self) -> u32 {
    let id = self.next_id.fetch_add(1, Ordering::Relaxed);
    if id >= 50_000 {
      self.next_id.store(10_000, Ordering::Relaxed);
    }
    id
  }
}

async fn initialize(port: u16) -> Result<(TcpStream, crate::protocol::AppInfo)> {
  timeout(SCAN_TIMEOUT, async {
    let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port)).await?;
    stream.set_nodelay(true)?;
    write_peertalk_message(&mut stream, &initialize_request(port)).await?;
    loop {
      let message = read_peertalk_message(&mut stream).await?;
      if let Some(info) = parse_initialize_response(&message)? {
        return Ok((stream, info));
      }
    }
  })
  .await
  .map_err(|_| Error::Timeout(format!("initializing debug-router port {port}")))?
}
