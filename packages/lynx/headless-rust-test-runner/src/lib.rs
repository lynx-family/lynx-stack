mod debug_router;
mod error;
mod fixture;
mod harness;
mod png_encoder;
mod protocol;
mod resource;

use std::collections::{BTreeMap, HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::{Arc, Mutex as StdMutex, OnceLock, Weak};
use std::time::{Duration, Instant};

use debug_router::DebugRouter;
pub use error::{Error, Result};
pub use fixture::{run_react_fixture, RunReport};
use harness::{initialize_platform, FrameStore, QueueingHost, SharedTasks, TaskPump};
use lynx::{Env, HeadlessView, WindowlessRenderer};
use png_encoder::encode_png_async;
pub use protocol::NodeInfo;
use protocol::{
  ComputedStyleProperty, GetAttributesResult, GetBoxModelResult, GetComputedStyleResult,
  GetDocumentResult, QuerySelectorResult, Session,
};
use resource::ResourceContext;
use serde_json::{json, Value};
use tokio_util::task::LocalPoolHandle;

const DEFAULT_VIEWPORT_WIDTH: usize = 800;
const DEFAULT_VIEWPORT_HEIGHT: usize = 600;
const DEFAULT_DEVICE_PIXEL_RATIO: f32 = 1.0;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
const APP_NAME: &str = "HeadlessRustTestRunner";
const MAX_CONCURRENT_VISITS: usize = 4;

#[derive(Clone, Debug)]
pub struct ConnectOptions {
  pub width: usize,
  pub height: usize,
  pub device_pixel_ratio: f32,
  pub timeout: Duration,
  pub lynx_core_path: Option<PathBuf>,
  pub resources_path: Option<PathBuf>,
  pub devtool_schema: Option<String>,
}

impl Default for ConnectOptions {
  fn default() -> Self {
    Self {
      width: DEFAULT_VIEWPORT_WIDTH,
      height: DEFAULT_VIEWPORT_HEIGHT,
      device_pixel_ratio: DEFAULT_DEVICE_PIXEL_RATIO,
      timeout: DEFAULT_TIMEOUT,
      lynx_core_path: None,
      resources_path: None,
      devtool_schema: None,
    }
  }
}

#[derive(Clone, Debug, Default)]
pub struct GotoOptions {
  pub timeout: Option<Duration>,
  pub initial_data_json: Option<String>,
  pub global_props_json: Option<String>,
}

#[derive(Clone, Debug, Default)]
pub struct ScreenshotOptions {
  pub path: Option<PathBuf>,
  pub settle: Duration,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct BoundingBox {
  pub x: f64,
  pub y: f64,
  pub width: f64,
  pub height: f64,
}

struct LynxProcess {
  env: Env,
  debug_router: DebugRouter,
  devtool_schema: Option<String>,
  page_owner: PageOwner,
  visit_dispatcher: OnceLock<std::result::Result<VisitDispatcher, String>>,
  session_locks: Arc<SessionLocks>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum PageOwnerMode {
  Direct,
  VisitDispatcher,
}

#[derive(Clone, Copy)]
struct PageOwnerClaim {
  thread: std::thread::ThreadId,
  mode: PageOwnerMode,
}

#[derive(Default)]
struct PageOwner {
  claim: StdMutex<Option<PageOwnerClaim>>,
}

impl PageOwner {
  fn claim(&self) -> Result<()> {
    let current = std::thread::current().id();
    let mut claim = self.claim.lock().expect("page owner lock poisoned");
    match *claim {
      Some(owner) if owner.mode == PageOwnerMode::VisitDispatcher => {
        Err(Error::VisitDispatcher(format!(
          "direct new_page mode is unavailable because the native owner is the visit dispatcher on thread {:?}; use visit_screenshot",
          owner.thread
        )))
      }
      Some(owner) if owner.thread != current => Err(Error::ThreadAffinity {
        owner: format!("{:?} ({:?} mode)", owner.thread, owner.mode),
        current: format!("{current:?}"),
      }),
      Some(_) => Ok(()),
      None => {
        *claim = Some(PageOwnerClaim {
          thread: current,
          mode: PageOwnerMode::Direct,
        });
        Ok(())
      }
    }
  }

  fn ensure_visit_dispatcher_owner(&self) -> Result<()> {
    let current = std::thread::current().id();
    let claim = self.claim.lock().expect("page owner lock poisoned");
    match *claim {
      Some(owner) if owner.thread == current && owner.mode == PageOwnerMode::VisitDispatcher => {
        Ok(())
      }
      Some(owner) => Err(Error::VisitDispatcher(format!(
        "native visit was executed on {current:?}, but {:?} mode owns thread {:?}",
        owner.mode, owner.thread
      ))),
      None => Err(Error::VisitDispatcher(
        "native page owner was not initialized".into(),
      )),
    }
  }

  fn claim_visit_dispatcher(&self) -> std::result::Result<(), String> {
    let current = std::thread::current().id();
    let mut claim = self.claim.lock().expect("page owner lock poisoned");
    match *claim {
      Some(owner)
        if owner.thread == current && owner.mode == PageOwnerMode::VisitDispatcher =>
      {
        Ok(())
      }
      Some(owner) => Err(format!(
        "native page ownership was already claimed by {:?} mode on thread {:?}; call visit_screenshot before creating direct pages",
        owner.mode, owner.thread
      )),
      None => {
        *claim = Some(PageOwnerClaim {
          thread: current,
          mode: PageOwnerMode::VisitDispatcher,
        });
        Ok(())
      }
    }
  }
}

#[derive(Clone)]
struct VisitDispatcher {
  pool: LocalPoolHandle,
  permits: Arc<tokio::sync::Semaphore>,
}

#[derive(Default)]
struct SessionLocks {
  locks: StdMutex<HashMap<String, Weak<tokio::sync::Mutex<()>>>>,
}

impl SessionLocks {
  fn for_url(&self, url: &str) -> Arc<tokio::sync::Mutex<()>> {
    let key = final_url_component(url).unwrap_or(url);
    let mut locks = self.locks.lock().expect("session lock map poisoned");
    locks.retain(|_, lock| lock.strong_count() > 0);
    if let Some(lock) = locks.get(key).and_then(Weak::upgrade) {
      return lock;
    }
    let lock = Arc::new(tokio::sync::Mutex::new(()));
    locks.insert(key.to_string(), Arc::downgrade(&lock));
    lock
  }
}

/// A cloneable, thread-safe handle to the process-wide Lynx runtime.
///
/// Direct [`Lynx::new_page`] calls bind native pages to the first caller thread.
/// Alternatively, [`Lynx::visit_screenshot`] lazily starts a dedicated owner
/// that accepts visits from any thread. The two ownership modes are exclusive.
#[derive(Clone)]
pub struct Lynx {
  process: Arc<LynxProcess>,
  lynx_core_path: PathBuf,
  options: ConnectOptions,
}

impl Lynx {
  pub async fn connect(options: ConnectOptions) -> Result<Self> {
    let lynx_core_path = install_lynx_core_resource(options.lynx_core_path.as_deref()).await?;
    let process = initialize_process(&options).await?;
    if process.devtool_schema != options.devtool_schema {
      return Err(Error::Protocol(format!(
        "Lynx was already initialized with debug-router schema {:?}, cannot reconnect with {:?}",
        process.devtool_schema, options.devtool_schema
      )));
    }
    Ok(Self {
      process,
      lynx_core_path,
      options,
    })
  }

  pub fn new_page(&self) -> Result<Page> {
    self.process.page_owner.claim()?;
    self.new_page_on_owner()
  }

  fn new_page_for_visit_dispatcher(&self) -> Result<Page> {
    self.process.page_owner.ensure_visit_dispatcher_owner()?;
    self.new_page_on_owner()
  }

  fn new_page_on_owner(&self) -> Result<Page> {
    let global_tasks = initialize_platform(&self.process.env)?;
    let renderer_tasks = SharedTasks::new();
    let frames = FrameStore::default();
    let renderer = WindowlessRenderer::software(
      &self.process.env,
      frames.clone(),
      QueueingHost::new(renderer_tasks.clone()),
    )?;
    let resources = ResourceContext::new(
      self.options.resources_path.clone(),
      self.lynx_core_path.clone(),
    );
    let view = HeadlessView::builder(self.process.env.clone(), renderer)
      .viewport(
        self.options.width as f32,
        self.options.height as f32,
        self.options.device_pixel_ratio,
      )
      .resource_fetcher(resources.fetcher())?
      .build()?;
    view.enter_foreground();
    let pump = TaskPump::new(self.process.env.clone(), renderer_tasks, global_tasks);
    let runtime = Rc::new(PageRuntime {
      view,
      pump,
      frames,
      debug_router: self.process.debug_router.clone(),
      session_locks: Arc::clone(&self.process.session_locks),
      resources,
      width: self.options.width,
      height: self.options.height,
      device_pixel_ratio: self.options.device_pixel_ratio,
      timeout: self.options.timeout,
    });
    Ok(Page {
      runtime,
      root_node_id: None,
      session_id: None,
      url: String::new(),
    })
  }

  /// Runs one screenshot visit on the process-wide native page owner.
  ///
  /// Unlike [`Lynx::new_page`], this method may be called from any OS thread.
  /// Admission is bounded before the request is submitted to a single-worker
  /// local pool; the native page is created, navigated, captured, and dropped
  /// on that worker. This mode and direct `new_page` mode are mutually
  /// exclusive.
  pub async fn visit_screenshot(
    &self,
    input: String,
    goto_options: GotoOptions,
    screenshot_options: ScreenshotOptions,
  ) -> Result<Vec<u8>> {
    let dispatcher = self.visit_dispatcher()?;
    let permit = Arc::clone(&dispatcher.permits)
      .acquire_owned()
      .await
      .map_err(|_| Error::VisitDispatcher("native visit admission has closed".into()))?;
    let lynx = self.clone();
    dispatcher
      .pool
      .spawn_pinned(move || async move {
        let _permit = permit;
        run_screenshot_visit(&lynx, &input, goto_options, screenshot_options).await
      })
      .await
      .map_err(|error| {
        Error::VisitDispatcher(format!(
          "native owner task stopped before completing the visit: {error}"
        ))
      })?
  }

  fn visit_dispatcher(&self) -> Result<VisitDispatcher> {
    match self
      .process
      .visit_dispatcher
      .get_or_init(|| start_visit_dispatcher(Arc::clone(&self.process)))
    {
      Ok(dispatcher) => Ok(dispatcher.clone()),
      Err(message) => Err(Error::VisitDispatcher(message.clone())),
    }
  }

  pub fn close(self) {}
}

fn start_visit_dispatcher(
  process: Arc<LynxProcess>,
) -> std::result::Result<VisitDispatcher, String> {
  let pool = std::panic::catch_unwind(|| LocalPoolHandle::new(1))
    .map_err(|_| "failed to start native owner local pool".to_string())?;
  // Claim ownership before publishing the pool. This one-shot handshake keeps
  // dispatcher initialization atomic even if the first async caller is later
  // cancelled; it is not a request queue.
  let (ready, initialized) = std::sync::mpsc::sync_channel(1);
  std::mem::drop(pool.spawn_pinned(move || async move {
    let _ = ready.send(process.page_owner.claim_visit_dispatcher());
  }));
  initialized
    .recv()
    .map_err(|_| "native owner task stopped during initialization".to_string())??;
  Ok(VisitDispatcher {
    pool,
    permits: Arc::new(tokio::sync::Semaphore::new(MAX_CONCURRENT_VISITS)),
  })
}

async fn run_screenshot_visit(
  lynx: &Lynx,
  input: &str,
  goto_options: GotoOptions,
  screenshot_options: ScreenshotOptions,
) -> Result<Vec<u8>> {
  let mut page = lynx.new_page_for_visit_dispatcher()?;
  page.goto_for_screenshot(input, goto_options).await?;
  let png = page.screenshot(screenshot_options).await?;
  drop(page);
  Ok(png)
}

async fn initialize_process(options: &ConnectOptions) -> Result<Arc<LynxProcess>> {
  static PROCESS: tokio::sync::OnceCell<Arc<LynxProcess>> = tokio::sync::OnceCell::const_new();

  PROCESS
    .get_or_try_init(|| async {
      let env = Env::load()?;
      set_icu_data_path_if_available(&env)?;
      let app_name = format!("{APP_NAME}-{}", std::process::id());

      env.set_devtool_app_info("App", &app_name)?;
      env.set_devtool_app_info("AppVersion", env!("CARGO_PKG_VERSION"))?;
      env.set_devtool_app_info("AppProcessName", &app_name)?;
      env.set_devtool_app_info("deviceModel", "headless")?;
      env.set_devtool_app_info("osVersion", std::env::consts::OS)?;
      env.set_devtool_app_info("sdkVersion", &env.sdk_version())?;
      env.set_devtool_enabled(true);
      if let Some(schema) = &options.devtool_schema {
        if !env.connect_devtool(schema)? {
          return Err(Error::Protocol(format!(
            "failed to connect debug-router schema: {schema}"
          )));
        }
      }

      let debug_router = DebugRouter::connect(&app_name, options.timeout).await?;
      Ok(Arc::new(LynxProcess {
        env,
        debug_router,
        devtool_schema: options.devtool_schema.clone(),
        page_owner: PageOwner::default(),
        visit_dispatcher: OnceLock::new(),
        session_locks: Arc::new(SessionLocks::default()),
      }))
    })
    .await
    .cloned()
}

struct PageRuntime {
  view: HeadlessView,
  pump: TaskPump,
  frames: FrameStore,
  debug_router: DebugRouter,
  session_locks: Arc<SessionLocks>,
  resources: ResourceContext,
  width: usize,
  height: usize,
  device_pixel_ratio: f32,
  timeout: Duration,
}

impl PageRuntime {
  async fn send_cdp<T, P>(&self, session_id: i64, method: &str, params: P) -> Result<T>
  where
    T: serde::de::DeserializeOwned,
    P: serde::Serialize,
  {
    let request = self.debug_router.send_cdp(session_id, method, params);
    tokio::pin!(request);
    loop {
      tokio::select! {
        result = &mut request => return result,
        _ = tokio::time::sleep(Duration::from_millis(1)) => {
          self.pump.pump_once(&self.view);
        }
      }
    }
  }

  async fn list_sessions(&self) -> Result<Vec<Session>> {
    let request = self.debug_router.list_sessions();
    tokio::pin!(request);
    loop {
      tokio::select! {
        result = &mut request => return result,
        _ = tokio::time::sleep(Duration::from_millis(1)) => {
          self.pump.pump_once(&self.view);
        }
      }
    }
  }

  async fn tap_node(&self, node_id: i64) -> Result<()> {
    let node_id = i32::try_from(node_id)
      .map_err(|_| Error::Protocol(format!("node id {node_id} is out of range")))?;
    self.view.send_touch_event("tap", node_id)?;
    self.pump_for(Duration::from_millis(50)).await;
    Ok(())
  }

  async fn pump_for(&self, duration: Duration) {
    self.pump.pump_for(&self.view, duration).await;
  }
}

pub struct Page {
  runtime: Rc<PageRuntime>,
  root_node_id: Option<i64>,
  session_id: Option<i64>,
  url: String,
}

impl Page {
  pub async fn goto(&mut self, input: &str, options: GotoOptions) -> Result<()> {
    self.goto_internal(input, options, true).await
  }

  /// Loads a page through the native renderer without attaching a DOM session.
  ///
  /// This is the preferred navigation path when the only consumer is
  /// [`Page::screenshot`]. DOM APIs remain unavailable until a later regular
  /// [`Page::goto`] call.
  pub async fn goto_for_screenshot(&mut self, input: &str, options: GotoOptions) -> Result<()> {
    self.goto_internal(input, options, false).await
  }

  async fn goto_internal(
    &mut self,
    input: &str,
    options: GotoOptions,
    attach_dom: bool,
  ) -> Result<()> {
    let timeout = options.timeout.unwrap_or(self.runtime.timeout);
    let (url, bytes) = self.runtime.resources.read_template(input).await?;
    let _session_guard = if attach_dom {
      Some(self.runtime.session_locks.for_url(&url).lock_owned().await)
    } else {
      None
    };
    let existing_session_ids = if attach_dom {
      self
        .runtime
        .list_sessions()
        .await?
        .into_iter()
        .map(|session| session.session_id)
        .collect::<HashSet<_>>()
    } else {
      HashSet::new()
    };
    self.runtime.resources.set_base_url(&url);
    let global_props = options
      .global_props_json
      .unwrap_or_else(|| self.default_global_props_json());
    let previous_sequence = self.runtime.frames.sequence();

    self.runtime.view.load_template_bytes_with_global_props(
      &url,
      &bytes,
      options.initial_data_json.as_deref().or(Some("{}")),
      Some(&global_props),
    )?;
    self.runtime.view.enter_foreground();
    self.runtime.view.set_frame(
      0.0,
      0.0,
      self.runtime.width as f32,
      self.runtime.height as f32,
    );
    self
      .runtime
      .pump
      .wait_for_frame(
        &self.runtime.view,
        &self.runtime.frames,
        previous_sequence,
        timeout,
      )
      .await?;

    if attach_dom {
      let session = self
        .wait_for_session(&url, &existing_session_ids, timeout)
        .await?;
      self.attach_to_session(session.session_id, timeout).await?;
    } else {
      self.root_node_id = None;
      self.session_id = None;
    }
    self.url = url;
    Ok(())
  }

  pub fn url(&self) -> &str {
    &self.url
  }

  pub async fn content(&self) -> Result<String> {
    let session_id = self.session_id()?;
    let document: GetDocumentResult = self
      .runtime
      .send_cdp(session_id, "DOM.getDocument", json!({ "depth": -1 }))
      .await?;
    let mut buffer = String::new();
    content_to_string(&mut buffer, &document.root);
    Ok(buffer)
  }

  pub async fn locator(&mut self, selector: &str) -> Result<Option<ElementNode>> {
    let session_id = self.session_id()?;
    let root_node_id = self.root_node_id.ok_or(Error::PageNotLoaded)?;
    let mut result = self
      .query_selector(session_id, root_node_id, selector)
      .await?;
    if result.node_id == -1 {
      let root_node_id = self.current_root_node_id(session_id).await?;
      self.root_node_id = Some(root_node_id);
      result = self
        .query_selector(session_id, root_node_id, selector)
        .await?;
    }
    if result.node_id == -1 {
      return Ok(None);
    }
    Ok(Some(ElementNode {
      node_id: result.node_id,
      session_id,
      runtime: Rc::clone(&self.runtime),
    }))
  }

  pub async fn screenshot(&self, options: ScreenshotOptions) -> Result<Vec<u8>> {
    if !options.settle.is_zero() {
      self.runtime.pump_for(options.settle).await;
    }
    let frame = self
      .runtime
      .frames
      .latest()
      .ok_or(Error::FrameNotAvailable)?;
    let png = encode_png_async(frame.width, frame.height, frame.rgba).await?;
    if let Some(path) = options.path {
      if let Some(parent) = path.parent() {
        tokio::fs::create_dir_all(parent).await?;
      }
      tokio::fs::write(path, &png).await?;
    }
    Ok(png)
  }

  pub async fn wait_for_timeout(&self, duration: Duration) {
    self.runtime.pump_for(duration).await;
  }

  fn default_global_props_json(&self) -> String {
    json!({
      "initialPage": "home",
      "platform": std::env::consts::OS,
      "screenWidth": self.runtime.width,
      "screenHeight": self.runtime.height,
      "pixelRatio": self.runtime.device_pixel_ratio,
      "theme": "light",
      "frontendTheme": "light",
      "preferredTheme": "light",
      "safeAreaTop": 0,
      "safeAreaBottom": 0,
      "safeAreaLeft": 0,
      "safeAreaRight": 0,
    })
    .to_string()
  }

  async fn wait_for_session(
    &self,
    url: &str,
    existing_session_ids: &HashSet<i64>,
    timeout: Duration,
  ) -> Result<Session> {
    let deadline = Instant::now() + timeout;
    let mut last_error = None;
    while Instant::now() < deadline {
      match self.runtime.list_sessions().await {
        Ok(sessions) => {
          if std::env::var_os("HEADLESS_RUST_TEST_RUNNER_DEBUG").is_some() {
            eprintln!("[headless-rust-test-runner] sessions: {sessions:?}");
          }
          if let Some(session) =
            select_session(sessions, url, existing_session_ids, self.session_id)
          {
            return Ok(session);
          }
        }
        Err(error) => {
          last_error = Some(error.to_string());
        }
      }
      self.runtime.pump_for(Duration::from_millis(100)).await;
    }
    if let Some(last_error) = last_error {
      return Err(Error::Protocol(format!(
        "failed while waiting for a debug session for {url}: {last_error}"
      )));
    }
    Err(Error::SessionNotFound(url.to_string()))
  }

  async fn attach_to_session(&mut self, session_id: i64, timeout: Duration) -> Result<()> {
    let deadline = Instant::now() + timeout;
    let mut last_error = None;
    while Instant::now() < deadline {
      let enabled = self
        .runtime
        .send_cdp::<Value, _>(session_id, "DOM.enable", json!({ "useCompression": false }))
        .await;
      if let Err(error) = enabled {
        last_error = Some(error.to_string());
        self.runtime.pump_for(Duration::from_millis(250)).await;
        continue;
      }
      match self.current_root_node_id(session_id).await {
        Ok(root_node_id) => {
          self.root_node_id = Some(root_node_id);
          self.session_id = Some(session_id);
          return Ok(());
        }
        Err(error) => {
          last_error = Some(error.to_string());
          self.runtime.pump_for(Duration::from_millis(250)).await;
        }
      }
    }
    Err(Error::Timeout(format!(
      "attaching to DOM session {session_id}; last error: {}",
      last_error.unwrap_or_else(|| "none".into())
    )))
  }

  async fn current_root_node_id(&self, session_id: i64) -> Result<i64> {
    let document: GetDocumentResult = self
      .runtime
      .send_cdp(session_id, "DOM.getDocument", json!({ "depth": -1 }))
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

  async fn query_selector(
    &self,
    session_id: i64,
    root_node_id: i64,
    selector: &str,
  ) -> Result<QuerySelectorResult> {
    self
      .runtime
      .send_cdp(
        session_id,
        "DOM.querySelector",
        json!({ "nodeId": root_node_id, "selector": selector }),
      )
      .await
  }

  fn session_id(&self) -> Result<i64> {
    self.session_id.ok_or(Error::PageNotLoaded)
  }
}

#[derive(Clone)]
pub struct ElementNode {
  pub node_id: i64,
  session_id: i64,
  runtime: Rc<PageRuntime>,
}

impl ElementNode {
  pub async fn tap(&self) -> Result<()> {
    self.runtime.tap_node(self.node_id).await
  }

  pub async fn bounding_box(&self) -> Result<BoundingBox> {
    let result: GetBoxModelResult = self
      .runtime
      .send_cdp(
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
    let x_values = [
      result.model.content[0],
      result.model.content[2],
      result.model.content[4],
      result.model.content[6],
    ];
    let y_values = [
      result.model.content[1],
      result.model.content[3],
      result.model.content[5],
      result.model.content[7],
    ];
    let min_x = x_values.into_iter().fold(f64::INFINITY, f64::min);
    let max_x = x_values.into_iter().fold(f64::NEG_INFINITY, f64::max);
    let min_y = y_values.into_iter().fold(f64::INFINITY, f64::min);
    let max_y = y_values.into_iter().fold(f64::NEG_INFINITY, f64::max);
    Ok(BoundingBox {
      x: min_x,
      y: min_y,
      width: max_x - min_x,
      height: max_y - min_y,
    })
  }

  pub async fn get_attribute(&self, name: &str) -> Result<Option<String>> {
    let name = if name == "id" { "idSelector" } else { name };
    let result: GetAttributesResult = self
      .runtime
      .send_cdp(
        self.session_id,
        "DOM.getAttributes",
        json!({ "nodeId": self.node_id }),
      )
      .await?;
    Ok(result.attributes.chunks(2).find_map(|pair| {
      (pair.first().map(String::as_str) == Some(name))
        .then(|| pair.get(1).cloned())
        .flatten()
    }))
  }

  pub async fn computed_style_map(&self) -> Result<BTreeMap<String, String>> {
    let result: GetComputedStyleResult = self
      .runtime
      .send_cdp(
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

async fn install_lynx_core_resource(configured_path: Option<&Path>) -> Result<PathBuf> {
  let executable = std::env::current_exe()?;
  let executable_dir = executable
    .parent()
    .ok_or_else(|| Error::Protocol("current executable has no parent".into()))?;
  let destination = if cfg!(target_os = "macos") {
    executable_dir.join("LynxResources.bundle/lynx_core.js")
  } else {
    executable_dir.join("lynx_core.js")
  };

  let source = configured_path
    .map(PathBuf::from)
    .or_else(|| std::env::var_os("LYNX_CORE_JS_PATH").map(PathBuf::from));
  let Some(source) = source else {
    return tokio::fs::metadata(&destination)
      .await
      .map(|metadata| metadata.is_file())
      .unwrap_or(false)
      .then_some(destination)
      .ok_or(Error::MissingLynxCore);
  };
  if !tokio::fs::metadata(&source)
    .await
    .map(|metadata| metadata.is_file())
    .unwrap_or(false)
  {
    return Err(Error::LynxCoreNotFound(source));
  }
  if let Some(parent) = destination.parent() {
    tokio::fs::create_dir_all(parent).await?;
  }
  tokio::fs::copy(source, &destination).await?;
  Ok(destination)
}

fn set_icu_data_path_if_available(env: &Env) -> Result<()> {
  let Some(sdk_dir) = std::env::var_os("LYNX_SDK_DIR") else {
    return Ok(());
  };
  let path = PathBuf::from(sdk_dir).join("data/icudtl.dat");
  if path.is_file() {
    env.set_icu_data_path(
      path
        .to_str()
        .ok_or_else(|| Error::Protocol("ICU data path is not UTF-8".into()))?,
    )?;
  }
  Ok(())
}

fn content_to_string(buffer: &mut String, node: &NodeInfo) {
  let tag_name = node.node_name.to_lowercase();
  buffer.push('<');
  buffer.push_str(&tag_name);
  for pair in node.attributes.chunks(2) {
    let (Some(key), Some(value)) = (pair.first(), pair.get(1)) else {
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

fn session_url_matches(url: &str, session_url: &str) -> bool {
  if session_url.is_empty() {
    return false;
  }
  session_url == url
    || match (final_url_component(url), final_url_component(session_url)) {
      (Some(expected), Some(actual)) => actual == expected,
      _ => false,
    }
}

fn select_session(
  sessions: Vec<Session>,
  url: &str,
  existing_session_ids: &HashSet<i64>,
  current_session_id: Option<i64>,
) -> Option<Session> {
  let matches = sessions
    .into_iter()
    .filter(|session| session_url_matches(url, &session.url))
    .collect::<Vec<_>>();
  matches
    .iter()
    .filter(|session| !existing_session_ids.contains(&session.session_id))
    .max_by_key(|session| session.session_id)
    .cloned()
    .or_else(|| {
      current_session_id.and_then(|current_session_id| {
        matches
          .into_iter()
          .find(|session| session.session_id == current_session_id)
      })
    })
}

fn final_url_component(url: &str) -> Option<&str> {
  url
    .split(['?', '#'])
    .next()
    .unwrap_or(url)
    .trim_end_matches('/')
    .rsplit('/')
    .next()
    .filter(|component| !component.is_empty())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_send<T: Send>(_: T) {}
  fn assert_send_sync<T: Send + Sync>() {}

  #[allow(dead_code)]
  fn assert_visit_screenshot_future_is_send(lynx: &Lynx) {
    assert_send(lynx.visit_screenshot(
      String::new(),
      GotoOptions::default(),
      ScreenshotOptions::default(),
    ));
  }

  #[test]
  fn lynx_handle_is_send_and_sync() {
    assert_send_sync::<Lynx>();
  }

  #[test]
  fn page_owner_rejects_a_second_os_thread() {
    let owner = Arc::new(PageOwner::default());
    owner.claim().unwrap();
    let other_thread = std::thread::spawn({
      let owner = Arc::clone(&owner);
      move || owner.claim()
    });
    let error = other_thread.join().unwrap().unwrap_err();
    assert!(error.to_string().contains("bound to owner thread"));
  }

  #[test]
  fn direct_page_mode_rejects_visit_dispatcher_mode() {
    let owner = PageOwner::default();
    owner.claim().unwrap();
    let error = owner.claim_visit_dispatcher().unwrap_err();
    assert!(error.to_string().contains("direct"));
  }

  #[test]
  fn visit_dispatcher_mode_rejects_direct_page_mode() {
    let owner = PageOwner::default();
    owner.claim_visit_dispatcher().unwrap();
    let error = owner.claim().unwrap_err();
    assert!(error.to_string().contains("use visit_screenshot"));
  }

  #[test]
  fn session_locks_use_the_same_filename_equivalence_as_discovery() {
    let locks = SessionLocks::default();
    let first = locks.for_url("file:///first/main.lynx.bundle?one");
    let second = locks.for_url("file:///second/main.lynx.bundle#two");
    assert!(Arc::ptr_eq(&first, &second));
  }

  #[test]
  fn repeated_navigation_can_reuse_the_current_debug_session() {
    let current = Session {
      session_id: 7,
      r#type: "page".into(),
      url: "file:///fixture/main.lynx.bundle".into(),
    };
    let selected = select_session(
      vec![current.clone()],
      &current.url,
      &HashSet::from([current.session_id]),
      Some(current.session_id),
    );
    assert_eq!(selected, Some(current));
  }

  #[test]
  fn serializes_content_and_maps_id_selector() {
    let node = NodeInfo {
      node_id: 1,
      node_name: "VIEW".into(),
      attributes: vec!["idSelector".into(), "main".into()],
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
      r#"<view id="main"><text text="hello"></text></view>"#
    );
  }

  #[test]
  fn matches_session_url_by_exact_filename() {
    assert!(session_url_matches(
      "file:///tmp/main.lynx.bundle",
      "main.lynx.bundle"
    ));
    assert!(session_url_matches(
      "https://example.test/main.lynx.bundle?version=1",
      "file:///tmp/main.lynx.bundle#document"
    ));
  }

  #[test]
  fn rejects_missing_or_suffix_session_urls() {
    assert!(!session_url_matches("file:///tmp/main.lynx.bundle", ""));
    assert!(!session_url_matches(
      "file:///tmp/main.lynx.bundle",
      "not-main.lynx.bundle"
    ));
    assert!(!session_url_matches(
      "file:///tmp/main.lynx.bundle",
      "main.lynx.bundle.map"
    ));
  }
}
