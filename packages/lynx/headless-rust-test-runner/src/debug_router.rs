use std::collections::HashMap;
use std::fmt;
use std::net::Ipv4Addr;
use std::thread;
use std::time::Duration;

use serde::de::DeserializeOwned;
use serde::Serialize;
use serde_json::Value;
use tokio::net::{tcp::OwnedWriteHalf, TcpStream};
use tokio::sync::{mpsc, oneshot};
use tokio::time::{sleep, sleep_until, timeout, Instant};

use crate::protocol::{
  cdp_request, cdp_response_id, global_switch_request, initialize_request, list_session_request,
  parse_cdp_response, parse_global_switch_response, parse_initialize_response,
  parse_session_list_response, read_peertalk_message, session_list_response_id,
  write_peertalk_message, Session,
};
use crate::{Error, Result};

const FIRST_DEBUG_ROUTER_PORT: u16 = 8901;
const LAST_DEBUG_ROUTER_PORT: u16 = 8910;
const REQUEST_TIMEOUT: Duration = Duration::from_secs(5);
const SCAN_TIMEOUT: Duration = Duration::from_millis(500);
const COMMAND_CHANNEL_CAPACITY: usize = 128;
const INCOMING_CHANNEL_CAPACITY: usize = 128;
const FIRST_MESSAGE_ID: u32 = 10_000;

#[derive(Clone)]
pub(crate) struct DebugRouter {
  app_name: String,
  port: u16,
  commands: mpsc::Sender<Command>,
}

impl fmt::Debug for DebugRouter {
  fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
    formatter
      .debug_struct("DebugRouter")
      .field("app_name", &self.app_name)
      .field("port", &self.port)
      .finish_non_exhaustive()
  }
}

impl DebugRouter {
  pub(crate) async fn connect(app_name: &str, connect_timeout: Duration) -> Result<Self> {
    Self::start_actor(app_name, connect_timeout).await
  }

  pub(crate) async fn list_sessions(&self) -> Result<Vec<Session>> {
    let (reply, response) = oneshot::channel();
    self
      .send_command(
        Command::ListSessions { reply },
        response,
        "listing sessions",
      )
      .await
  }

  pub(crate) async fn send_cdp<T, P>(&self, session_id: i64, method: &str, params: P) -> Result<T>
  where
    T: DeserializeOwned,
    P: Serialize,
  {
    let params = serde_json::to_value(params)?;
    let (reply, response) = oneshot::channel();
    let value = self
      .send_command(
        Command::Cdp {
          session_id,
          method: method.to_string(),
          params,
          reply,
        },
        response,
        method,
      )
      .await?;
    Ok(serde_json::from_value(value)?)
  }

  async fn send_command<T>(
    &self,
    command: Command,
    response: oneshot::Receiver<Result<T>>,
    operation: &str,
  ) -> Result<T> {
    let port = self.port;
    timeout(REQUEST_TIMEOUT, async {
      self.commands.send(command).await.map_err(|_| {
        Error::Protocol(format!("debug-router actor on port {port} is not running"))
      })?;
      response.await.map_err(|_| {
        Error::Protocol(format!(
          "debug-router actor on port {port} stopped while {operation}"
        ))
      })?
    })
    .await
    .map_err(|_| Error::Timeout(format!("debug-router request {operation} on port {port}")))?
  }

  async fn start_actor(app_name: &str, connect_timeout: Duration) -> Result<Self> {
    let (commands, command_receiver) = mpsc::channel(COMMAND_CHANNEL_CAPACITY);
    let (ready, ready_receiver) = oneshot::channel();
    let actor_app_name = app_name.to_string();

    thread::Builder::new()
      .name("lynx-debug-router".into())
      .spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
          .enable_io()
          .enable_time()
          .build();
        match runtime {
          Ok(runtime) => runtime.block_on(async move {
            match establish_connection(&actor_app_name, connect_timeout).await {
              Ok((port, stream)) => {
                if ready.send(Ok(port)).is_ok() {
                  run_actor(port, stream, command_receiver).await;
                }
              }
              Err(error) => {
                let _ = ready.send(Err(error));
              }
            }
          }),
          Err(error) => {
            let _ = ready.send(Err(Error::Io(error)));
          }
        }
      })?;

    let port = ready_receiver
      .await
      .map_err(|_| Error::Protocol("debug-router actor stopped during initialization".into()))??;
    Ok(Self {
      app_name: app_name.to_string(),
      port,
      commands,
    })
  }
}

enum Command {
  ListSessions {
    reply: oneshot::Sender<Result<Vec<Session>>>,
  },
  Cdp {
    session_id: i64,
    method: String,
    params: Value,
    reply: oneshot::Sender<Result<Value>>,
  },
}

struct PendingList {
  id: u32,
  deadline: Instant,
  replies: Vec<oneshot::Sender<Result<Vec<Session>>>>,
}

struct PendingCdp {
  deadline: Instant,
  reply: oneshot::Sender<Result<Value>>,
}

struct ActorState {
  next_id: u32,
  list: Option<PendingList>,
  cdp: HashMap<u32, PendingCdp>,
}

impl ActorState {
  fn new() -> Self {
    Self {
      next_id: FIRST_MESSAGE_ID,
      list: None,
      cdp: HashMap::new(),
    }
  }

  fn allocate_id(&mut self) -> u32 {
    loop {
      let id = self.next_id;
      self.next_id = self.next_id.wrapping_add(1);
      if self.next_id < FIRST_MESSAGE_ID {
        self.next_id = FIRST_MESSAGE_ID;
      }
      let used_by_list = self.list.as_ref().is_some_and(|pending| pending.id == id);
      if !used_by_list && !self.cdp.contains_key(&id) {
        return id;
      }
    }
  }

  fn next_deadline(&self) -> Instant {
    let list_deadline = self.list.as_ref().map(|pending| pending.deadline);
    let cdp_deadline = self.cdp.values().map(|pending| pending.deadline).min();
    list_deadline
      .into_iter()
      .chain(cdp_deadline)
      .min()
      .unwrap_or_else(|| Instant::now() + Duration::from_secs(24 * 60 * 60))
  }

  fn expire(&mut self, port: u16) {
    let now = Instant::now();
    if self
      .list
      .as_ref()
      .is_some_and(|pending| pending.deadline <= now)
    {
      let pending = self.list.take().expect("checked above");
      for reply in pending.replies {
        let _ = reply.send(Err(Error::Timeout(format!(
          "debug-router ListSession request on port {port}"
        ))));
      }
    }

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
    if let Some(pending) = self.list.take() {
      for reply in pending.replies {
        let _ = reply.send(Err(Error::Protocol(message.to_string())));
      }
    }
    for (_, pending) in self.cdp.drain() {
      let _ = pending
        .reply
        .send(Err(Error::Protocol(message.to_string())));
    }
  }
}

async fn run_actor(port: u16, stream: TcpStream, mut commands: mpsc::Receiver<Command>) {
  let (mut reader, mut writer) = stream.into_split();
  let (incoming, mut messages) = mpsc::channel(INCOMING_CHANNEL_CAPACITY);
  let reader_task = tokio::spawn(async move {
    loop {
      let message = read_peertalk_message(&mut reader).await;
      let failed = message.is_err();
      if incoming.send(message).await.is_err() || failed {
        return;
      }
    }
  });
  let mut state = ActorState::new();

  loop {
    let deadline = state.next_deadline();
    tokio::select! {
      command = commands.recv() => {
        let Some(command) = command else {
          break;
        };
        if let Err(error) = handle_command(port, &mut writer, &mut state, command).await {
          let message = format!("debug-router connection on port {port} failed: {error}");
          state.fail_all(&message);
          break;
        }
      }
      message = messages.recv() => {
        match message {
          Some(Ok(message)) => handle_message(&mut state, message),
          Some(Err(error)) => {
            let message = format!("debug-router connection on port {port} closed: {error}");
            state.fail_all(&message);
            break;
          }
          None => {
            state.fail_all(&format!("debug-router reader on port {port} stopped"));
            break;
          }
        }
      }
      _ = sleep_until(deadline) => state.expire(port),
    }
  }

  reader_task.abort();
}

async fn handle_command(
  port: u16,
  writer: &mut OwnedWriteHalf,
  state: &mut ActorState,
  command: Command,
) -> Result<()> {
  match command {
    Command::ListSessions { reply } => {
      // Old routers omit the correlation id in SessionList. Coalesce every
      // concurrent caller so only one ambiguous request is ever in flight.
      if let Some(pending) = state.list.as_mut() {
        pending.replies.push(reply);
        return Ok(());
      }
      let id = state.allocate_id();
      write_request(port, writer, &list_session_request(port, id)).await?;
      state.list = Some(PendingList {
        id,
        deadline: Instant::now() + REQUEST_TIMEOUT,
        replies: vec![reply],
      });
    }
    Command::Cdp {
      session_id,
      method,
      params,
      reply,
    } => {
      let id = state.allocate_id();
      write_request(
        port,
        writer,
        &cdp_request(port, session_id, id, &method, params),
      )
      .await?;
      state.cdp.insert(
        id,
        PendingCdp {
          deadline: Instant::now() + REQUEST_TIMEOUT,
          reply,
        },
      );
    }
  }
  Ok(())
}

fn handle_message(state: &mut ActorState, message: Value) {
  match parse_session_list_response(&message) {
    Ok(Some(sessions)) => {
      let matches = state.list.as_ref().is_some_and(|pending| {
        session_list_response_id(&message).is_none_or(|id| id == pending.id)
      });
      if matches {
        let pending = state.list.take().expect("checked above");
        for reply in pending.replies {
          let _ = reply.send(Ok(sessions.clone()));
        }
      }
      return;
    }
    Err(error) => {
      if let Some(pending) = state.list.take() {
        let message = format!("invalid SessionList response: {error}");
        for reply in pending.replies {
          let _ = reply.send(Err(Error::Protocol(message.clone())));
        }
      }
      return;
    }
    Ok(None) => {}
  }

  // Notifications have no id and are intentionally ignored. Responses for
  // every outstanding id are dispatched here, so an event or a response for
  // another caller can no longer be consumed by the wrong request.
  let Ok(Some(id)) = cdp_response_id(&message) else {
    return;
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

async fn write_request(port: u16, writer: &mut OwnedWriteHalf, request: &Value) -> Result<()> {
  timeout(REQUEST_TIMEOUT, write_peertalk_message(writer, request))
    .await
    .map_err(|_| Error::Timeout(format!("writing debug-router request on port {port}")))??;
  Ok(())
}

async fn establish_connection(
  app_name: &str,
  connect_timeout: Duration,
) -> Result<(u16, TcpStream)> {
  timeout(connect_timeout, async {
    loop {
      for port in FIRST_DEBUG_ROUTER_PORT..=LAST_DEBUG_ROUTER_PORT {
        if let Ok((mut stream, info)) = initialize(port).await {
          if info.app == app_name {
            set_global_switch(&mut stream, port, "enable_devtool", true)
              .await
              .map_err(|error| {
                Error::Protocol(format!(
                  "failed to enable debug-router switch enable_devtool: {error}"
                ))
              })?;
            set_global_switch(&mut stream, port, "enable_dom_tree", true)
              .await
              .map_err(|error| {
                Error::Protocol(format!(
                  "failed to enable debug-router switch enable_dom_tree: {error}"
                ))
              })?;
            return Ok((port, stream));
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

async fn set_global_switch(
  stream: &mut TcpStream,
  port: u16,
  key: &str,
  value: bool,
) -> Result<()> {
  write_peertalk_message(stream, &global_switch_request(port, key, value)).await?;
  timeout(REQUEST_TIMEOUT, async {
    loop {
      let message = read_peertalk_message(stream).await?;
      if parse_global_switch_response(&message)?.is_some() {
        return Ok(());
      }
    }
  })
  .await
  .map_err(|_| Error::Timeout(format!("setting debug-router switch {key} on port {port}")))?
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

#[cfg(test)]
mod tests {
  use serde_json::json;
  use tokio::net::TcpListener;

  use super::*;

  fn assert_send_sync<T: Send + Sync>() {}

  #[test]
  fn handle_is_clone_send_and_sync() {
    assert_send_sync::<DebugRouter>();
  }

  async fn connected_test_router() -> (DebugRouter, TcpStream) {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await.unwrap();
    let address = listener.local_addr().unwrap();
    let client = TcpStream::connect(address).await.unwrap();
    let (server, _) = listener.accept().await.unwrap();
    let (commands, command_receiver) = mpsc::channel(COMMAND_CHANNEL_CAPACITY);
    let port = address.port();
    tokio::spawn(run_actor(port, client, command_receiver));
    (
      DebugRouter {
        app_name: "test".into(),
        port,
        commands,
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

  #[tokio::test]
  async fn routes_out_of_order_cdp_responses_around_notifications() {
    let (router, mut server) = connected_test_router().await;
    let serve = async move {
      let first = read_peertalk_message(&mut server).await.unwrap();
      let second = read_peertalk_message(&mut server).await.unwrap();
      let first_id = first
        .pointer("/data/data/message/id")
        .unwrap()
        .as_u64()
        .unwrap() as u32;
      let second_id = second
        .pointer("/data/data/message/id")
        .unwrap()
        .as_u64()
        .unwrap() as u32;
      let notification = json!({
        "event": "Customized",
        "data": {
          "type": "CDP",
          "data": { "message": json!({ "method": "DOM.documentUpdated" }).to_string() },
        },
      });
      write_peertalk_message(&mut server, &notification)
        .await
        .unwrap();
      write_peertalk_message(&mut server, &response(second_id))
        .await
        .unwrap();
      write_peertalk_message(&mut server, &response(first_id))
        .await
        .unwrap();
    };
    let first = router.send_cdp::<Value, _>(1, "DOM.first", json!({}));
    let second = router.send_cdp::<Value, _>(1, "DOM.second", json!({}));
    let (first, second, ()) = tokio::join!(first, second, serve);
    assert_ne!(
      first.unwrap().get("requestId"),
      second.unwrap().get("requestId")
    );
  }

  #[tokio::test(flavor = "current_thread")]
  async fn shared_handle_accepts_requests_from_multiple_os_threads() {
    let (router, mut server) = connected_test_router().await;
    let callers = (0..2)
      .map(|index| {
        let router = router.clone();
        std::thread::spawn(move || {
          tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .unwrap()
            .block_on(router.send_cdp::<Value, _>(1, &format!("DOM.thread{index}"), json!({})))
        })
      })
      .collect::<Vec<_>>();

    let mut ids = Vec::new();
    for _ in 0..callers.len() {
      let request = read_peertalk_message(&mut server).await.unwrap();
      ids.push(
        request
          .pointer("/data/data/message/id")
          .and_then(Value::as_u64)
          .unwrap() as u32,
      );
    }
    ids.reverse();
    for id in &ids {
      write_peertalk_message(&mut server, &response(*id))
        .await
        .unwrap();
    }

    let results = tokio::task::spawn_blocking(move || {
      callers
        .into_iter()
        .map(|caller| caller.join().unwrap().unwrap())
        .collect::<Vec<Value>>()
    })
    .await
    .unwrap();
    assert_eq!(results.len(), 2);
    assert_ne!(results[0].get("requestId"), results[1].get("requestId"));
  }

  #[tokio::test]
  async fn coalesces_uncorrelated_session_list_requests() {
    let (router, mut server) = connected_test_router().await;
    let serve = async move {
      let request = read_peertalk_message(&mut server).await.unwrap();
      assert!(request
        .pointer("/data/id")
        .and_then(Value::as_u64)
        .is_some());
      sleep(Duration::from_millis(50)).await;
      let response = json!({
        "event": "Customized",
        "data": {
          "type": "SessionList",
          "data": [{ "session_id": 7, "url": "main.lynx.bundle" }],
        },
      });
      write_peertalk_message(&mut server, &response)
        .await
        .unwrap();
      assert!(timeout(
        Duration::from_millis(50),
        read_peertalk_message(&mut server)
      )
      .await
      .is_err());
    };
    let first = router.list_sessions();
    let second = router.list_sessions();
    let (first, second, ()) = tokio::join!(first, second, serve);
    assert_eq!(first.unwrap(), second.unwrap());
  }
}
