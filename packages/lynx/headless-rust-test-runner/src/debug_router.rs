//! A blocking DebugRouter client for the local desktop devtool socket.
//!
//! One process-wide actor thread owns the connection, serializes writes, and
//! routes responses back to callers by request id. A second thread does the
//! blocking reads so a slow response can never stall an outgoing request.
//! Callers get a [`PendingRequest`] instead of a future: the container polls it
//! while it drives the native task pump, which is what keeps the engine running
//! during a CDP round trip without an async runtime.

use std::fmt;
use std::io::{self, ErrorKind};
use std::net::{Ipv4Addr, SocketAddr, TcpStream};
use std::sync::mpsc::{self, Receiver, RecvTimeoutError, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::{Duration, Instant};

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;

use crate::protocol::{
  cdp_request, cdp_response_id, global_switch_request, initialize_request, parse_cdp_response,
  parse_global_switch_response, parse_initialize_response, read_peertalk_message,
  write_peertalk_message,
};
use crate::{Error, Result};

const FIRST_DEBUG_ROUTER_PORT: u16 = 8901;
const LAST_DEBUG_ROUTER_PORT: u16 = 8910;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const SCAN_TIMEOUT: Duration = Duration::from_millis(500);
const FIRST_MESSAGE_ID: u32 = 10_000;

/// A cloneable handle to the process-wide DebugRouter actor.
#[derive(Clone)]
pub(crate) struct DebugRouter {
  port: u16,
  commands: Arc<Mutex<Sender<Command>>>,
}

impl fmt::Debug for DebugRouter {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter
      .debug_struct("DebugRouter")
      .field("port", &self.port)
      .finish_non_exhaustive()
  }
}

impl DebugRouter {
  pub(crate) fn connect(app_name: &str, connect_timeout: Duration) -> Result<Self> {
    let (port, stream) = establish_connection(app_name, connect_timeout)?;
    let (commands, command_receiver) = mpsc::channel();
    let reader_commands = commands.clone();
    let reader_stream = stream.try_clone()?;
    thread::Builder::new()
      .name("lynx-debug-router-reader".into())
      .spawn(move || read_messages(reader_stream, reader_commands))?;
    thread::Builder::new()
      .name("lynx-debug-router".into())
      .spawn(move || run_actor(port, stream, command_receiver))?;
    Ok(Self {
      port,
      commands: Arc::new(Mutex::new(commands)),
    })
  }

  /// Submits a CDP request and returns a handle the caller polls while it
  /// keeps the native renderer pumping.
  pub(crate) fn send_cdp<P: Serialize>(
    &self,
    session_id: i64,
    method: &str,
    params: P,
  ) -> Result<PendingRequest> {
    let params = serde_json::to_value(params)?;
    let (reply, response) = mpsc::channel();
    self.send(Command::Cdp {
      session_id,
      method: method.to_string(),
      params,
      reply,
    })?;
    Ok(PendingRequest {
      port: self.port,
      response,
    })
  }

  fn send(&self, command: Command) -> Result<()> {
    let port = self.port;
    self
      .commands
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .send(command)
      .map_err(|_| Error::Protocol(format!("debug-router actor on port {port} is not running")))
  }
}

/// An in-flight DebugRouter request.
pub(crate) struct PendingRequest {
  port: u16,
  response: Receiver<Result<Value>>,
}

impl PendingRequest {
  /// Returns the response once the actor has routed it, without blocking.
  pub(crate) fn poll<T: DeserializeOwned>(&self) -> Option<Result<T>> {
    match self.response.try_recv() {
      Ok(Ok(value)) => Some(serde_json::from_value(value).map_err(Error::from)),
      Ok(Err(error)) => Some(Err(error)),
      Err(TryRecvError::Empty) => None,
      Err(TryRecvError::Disconnected) => Some(Err(Error::Protocol(format!(
        "debug-router actor on port {} stopped before replying",
        self.port
      )))),
    }
  }
}

enum Command {
  Cdp {
    session_id: i64,
    method: String,
    params: Value,
    reply: Sender<Result<Value>>,
  },
  Incoming(Result<Value>),
}

struct PendingCdp {
  deadline: Instant,
  reply: Sender<Result<Value>>,
}

struct ActorState {
  next_id: u32,
  cdp: std::collections::HashMap<u32, PendingCdp>,
}

impl ActorState {
  fn new() -> Self {
    Self {
      next_id: FIRST_MESSAGE_ID,
      cdp: std::collections::HashMap::new(),
    }
  }

  fn allocate_id(&mut self) -> u32 {
    loop {
      let id = self.next_id;
      self.next_id = self.next_id.wrapping_add(1);
      if self.next_id < FIRST_MESSAGE_ID {
        self.next_id = FIRST_MESSAGE_ID;
      }
      if !self.cdp.contains_key(&id) {
        return id;
      }
    }
  }

  fn next_timeout(&self) -> Duration {
    let now = Instant::now();
    self
      .cdp
      .values()
      .map(|pending| pending.deadline.saturating_duration_since(now))
      .min()
      .unwrap_or(REQUEST_TIMEOUT)
  }

  fn expire(&mut self, port: u16) {
    let now = Instant::now();
    let expired = self
      .cdp
      .iter()
      .filter_map(|(&id, pending)| (pending.deadline <= now).then_some(id))
      .collect::<Vec<_>>();
    for id in expired {
      if let Some(pending) = self.cdp.remove(&id) {
        let _ = pending.reply.send(Err(Error::Timeout(format!(
          "debug-router CDP request {id} on port {port}"
        ))));
      }
    }
  }

  fn fail_all(&mut self, message: &str) {
    for (_, pending) in self.cdp.drain() {
      let _ = pending
        .reply
        .send(Err(Error::Protocol(message.to_string())));
    }
  }
}

fn read_messages(mut stream: TcpStream, commands: Sender<Command>) {
  loop {
    let message = read_peertalk_message(&mut stream);
    let failed = message.is_err();
    if commands.send(Command::Incoming(message)).is_err() || failed {
      return;
    }
  }
}

fn run_actor(port: u16, mut stream: TcpStream, commands: Receiver<Command>) {
  let mut state = ActorState::new();
  loop {
    match commands.recv_timeout(state.next_timeout()) {
      Ok(Command::Incoming(Ok(message))) => handle_message(&mut state, message),
      Ok(Command::Incoming(Err(error))) => {
        state.fail_all(&format!(
          "debug-router connection on port {port} closed: {error}"
        ));
        return;
      }
      Ok(command) => {
        if let Err(error) = handle_command(port, &mut stream, &mut state, command) {
          state.fail_all(&format!(
            "debug-router connection on port {port} failed: {error}"
          ));
          return;
        }
      }
      Err(RecvTimeoutError::Timeout) => state.expire(port),
      Err(RecvTimeoutError::Disconnected) => {
        state.fail_all(&format!("debug-router callers on port {port} are gone"));
        return;
      }
    }
  }
}

fn handle_command(
  port: u16,
  stream: &mut TcpStream,
  state: &mut ActorState,
  command: Command,
) -> Result<()> {
  let Command::Cdp {
    session_id,
    method,
    params,
    reply,
  } = command
  else {
    return Ok(());
  };
  let id = state.allocate_id();
  write_peertalk_message(stream, &cdp_request(port, session_id, id, &method, params))?;
  state.cdp.insert(
    id,
    PendingCdp {
      deadline: Instant::now() + REQUEST_TIMEOUT,
      reply,
    },
  );
  Ok(())
}

fn handle_message(state: &mut ActorState, message: Value) {
  // Notifications have no id and are intentionally ignored. Responses for
  // every outstanding id are dispatched here, so an event or a response for
  // another caller can no longer be consumed by the wrong request.
  let id = match cdp_response_id(&message) {
    Ok(Some(id)) => id,
    Ok(None) => return,
    Err(error) => {
      state.fail_all(&format!("invalid CDP response: {error}"));
      return;
    }
  };
  let Some(pending) = state.cdp.remove(&id) else {
    return;
  };
  let response = match parse_cdp_response::<Value>(&message, id) {
    Ok(Some(result)) => Ok(result),
    Ok(None) => Err(Error::Protocol(format!(
      "matched CDP response {id} could not be parsed"
    ))),
    Err(error) => Err(error),
  };
  let _ = pending.reply.send(response);
}

fn establish_connection(app_name: &str, connect_timeout: Duration) -> Result<(u16, TcpStream)> {
  let deadline = Instant::now() + connect_timeout;
  let mut last_error = None;
  loop {
    for port in FIRST_DEBUG_ROUTER_PORT..=LAST_DEBUG_ROUTER_PORT {
      match connect_to_port(port, app_name) {
        Ok(Some(stream)) => return Ok((port, stream)),
        Ok(None) => {}
        // A router that answered but could not be configured is not a usable
        // connection. Keep scanning instead of adopting a half-set-up socket,
        // and report the reason if nothing else works out.
        Err(error) => last_error = Some(error.to_string()),
      }
      if Instant::now() >= deadline {
        break;
      }
    }
    if Instant::now() >= deadline {
      return Err(Error::Timeout(match last_error {
        Some(error) => format!(
          "connecting to debug-router client {app_name} within {connect_timeout:?}; last error: {error}"
        ),
        None => format!("connecting to debug-router client {app_name} within {connect_timeout:?}"),
      }));
    }
    thread::sleep(Duration::from_millis(100));
  }
}

/// Returns a fully configured connection to `port`, if it belongs to this app.
fn connect_to_port(port: u16, app_name: &str) -> Result<Option<TcpStream>> {
  let Ok((mut stream, info)) = initialize(port) else {
    return Ok(None);
  };
  if info.app != app_name {
    return Ok(None);
  }
  // The scan budget is deliberately short; setup exchanges get the full
  // request budget so a busy router is not mistaken for the wrong port.
  stream.set_read_timeout(Some(REQUEST_TIMEOUT))?;
  stream.set_write_timeout(Some(REQUEST_TIMEOUT))?;
  for key in ["enable_devtool", "enable_dom_tree"] {
    set_global_switch(&mut stream, port, key, true).map_err(|error| {
      Error::Protocol(format!(
        "failed to enable debug-router switch {key}: {error}"
      ))
    })?;
  }
  // The reader thread owns this socket from here and must block for messages.
  stream.set_read_timeout(None)?;
  Ok(Some(stream))
}

fn set_global_switch(stream: &mut TcpStream, port: u16, key: &str, value: bool) -> Result<()> {
  write_peertalk_message(stream, &global_switch_request(port, key, value))?;
  let deadline = Instant::now() + REQUEST_TIMEOUT;
  loop {
    if Instant::now() >= deadline {
      return Err(Error::Timeout(format!(
        "setting debug-router switch {key} on port {port}"
      )));
    }
    let message = read_peertalk_message(stream)?;
    if parse_global_switch_response(&message)?.is_some() {
      return Ok(());
    }
  }
}

fn initialize(port: u16) -> Result<(TcpStream, crate::protocol::AppInfo)> {
  let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
  let mut stream = TcpStream::connect_timeout(&address, SCAN_TIMEOUT).map_err(scan_error)?;
  stream.set_nodelay(true)?;
  stream.set_read_timeout(Some(SCAN_TIMEOUT))?;
  stream.set_write_timeout(Some(SCAN_TIMEOUT))?;
  write_peertalk_message(&mut stream, &initialize_request(port))?;
  let deadline = Instant::now() + SCAN_TIMEOUT;
  loop {
    if Instant::now() >= deadline {
      return Err(Error::Timeout(format!(
        "initializing debug-router port {port}"
      )));
    }
    let message = read_peertalk_message(&mut stream)?;
    if let Some(info) = parse_initialize_response(&message)? {
      return Ok((stream, info));
    }
  }
}

fn scan_error(error: io::Error) -> Error {
  if matches!(error.kind(), ErrorKind::TimedOut | ErrorKind::WouldBlock) {
    Error::Timeout(format!("connecting to debug-router port: {error}"))
  } else {
    Error::Io(error)
  }
}

#[cfg(test)]
mod tests {
  use std::net::TcpListener;

  use serde_json::json;

  use super::*;

  fn assert_send_sync<T: Send + Sync>() {}

  #[test]
  fn handle_is_clone_send_and_sync() {
    assert_send_sync::<DebugRouter>();
  }

  fn connected_test_router() -> (DebugRouter, TcpStream) {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).expect("bind test listener");
    let address = listener.local_addr().expect("test listener address");
    let client = TcpStream::connect(address).expect("connect test client");
    let (server, _) = listener.accept().expect("accept test client");
    let (commands, command_receiver) = mpsc::channel();
    let port = address.port();
    let reader_stream = client.try_clone().expect("clone test client");
    let reader_commands = commands.clone();
    thread::spawn(move || read_messages(reader_stream, reader_commands));
    thread::spawn(move || run_actor(port, client, command_receiver));
    (
      DebugRouter {
        port,
        commands: Arc::new(Mutex::new(commands)),
      },
      server,
    )
  }

  fn response(id: u32) -> Value {
    json!({
      "event": "Customized",
      "data": {
        "type": "CDP",
        "data": {
          "message": json!({ "id": id, "result": { "requestId": id } }).to_string(),
        },
      },
    })
  }

  fn block_on(pending: &PendingRequest) -> Result<Value> {
    let deadline = Instant::now() + Duration::from_secs(10);
    loop {
      if let Some(result) = pending.poll::<Value>() {
        return result;
      }
      assert!(Instant::now() < deadline, "pending request never resolved");
      thread::sleep(Duration::from_millis(1));
    }
  }

  fn request_id(message: &Value) -> u32 {
    message
      .pointer("/data/data/message/id")
      .and_then(Value::as_u64)
      .expect("request id") as u32
  }

  #[test]
  fn routes_out_of_order_cdp_responses_around_notifications() {
    let (router, mut server) = connected_test_router();
    let first = router
      .send_cdp(1, "DOM.first", json!({}))
      .expect("submit first request");
    let second = router
      .send_cdp(1, "DOM.second", json!({}))
      .expect("submit second request");

    let first_id = request_id(&read_peertalk_message(&mut server).expect("first request"));
    let second_id = request_id(&read_peertalk_message(&mut server).expect("second request"));
    let notification = json!({
      "event": "Customized",
      "data": {
        "type": "CDP",
        "data": { "message": json!({ "method": "DOM.documentUpdated" }).to_string() },
      },
    });
    write_peertalk_message(&mut server, &notification).expect("write notification");
    write_peertalk_message(&mut server, &response(second_id)).expect("write second response");
    write_peertalk_message(&mut server, &response(first_id)).expect("write first response");

    assert_ne!(
      block_on(&first).expect("first response").get("requestId"),
      block_on(&second).expect("second response").get("requestId")
    );
  }

  #[test]
  fn surfaces_malformed_cdp_response_id() {
    let (router, mut server) = connected_test_router();
    let pending = router
      .send_cdp(1, "DOM.getDocument", json!({}))
      .expect("submit request");
    read_peertalk_message(&mut server).expect("read request");
    let malformed = json!({
      "event": "Customized",
      "data": {
        "type": "CDP",
        "data": { "message": { "id": "not-an-id", "result": {} } },
      },
    });
    write_peertalk_message(&mut server, &malformed).expect("write malformed response");

    let message = match block_on(&pending) {
      Err(Error::Protocol(message)) => message,
      other => panic!("expected protocol error, got {other:?}"),
    };
    assert!(message.contains("invalid CDP response"));
    assert!(message.contains("CDP response id is not an unsigned integer"));
  }

  #[test]
  fn shared_handle_accepts_requests_from_multiple_os_threads() {
    let (router, mut server) = connected_test_router();
    let callers = (0..2)
      .map(|index| {
        let router = router.clone();
        thread::spawn(move || {
          let pending = router
            .send_cdp(1, &format!("DOM.thread{index}"), json!({}))
            .expect("submit request");
          block_on(&pending)
        })
      })
      .collect::<Vec<_>>();

    let mut ids = Vec::new();
    for _ in 0..callers.len() {
      ids.push(request_id(
        &read_peertalk_message(&mut server).expect("read request"),
      ));
    }
    ids.reverse();
    for id in &ids {
      write_peertalk_message(&mut server, &response(*id)).expect("write response");
    }

    let results = callers
      .into_iter()
      .map(|caller| caller.join().expect("caller thread").expect("response"))
      .collect::<Vec<Value>>();
    assert_eq!(results.len(), 2);
    assert_ne!(results[0].get("requestId"), results[1].get("requestId"));
  }

  #[test]
  fn expires_a_request_the_router_never_answers() {
    let (router, mut server) = connected_test_router();
    let pending = router
      .send_cdp(1, "DOM.getDocument", json!({}))
      .expect("submit request");
    read_peertalk_message(&mut server).expect("read request");

    let deadline = Instant::now() + REQUEST_TIMEOUT + Duration::from_secs(5);
    let error = loop {
      if let Some(result) = pending.poll::<Value>() {
        break result.expect_err("unanswered request must time out");
      }
      assert!(Instant::now() < deadline, "request never expired");
      thread::sleep(Duration::from_millis(10));
    };
    assert!(matches!(error, Error::Timeout(_)), "got {error:?}");
  }
}
