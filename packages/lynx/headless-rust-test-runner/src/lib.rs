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
use std::sync::{Arc, Mutex as StdMutex, Weak};
use std::time::{Duration, Instant};

use debug_router::DebugRouter;
pub use error::{Error, Result};
pub use fixture::{run_react_fixture, RunReport};
use harness::{initialize_platform, FrameStore, QueueingHost, SharedTasks, TaskPump};
use lynx::{LynxEnv, LynxView, WindowlessRenderer};
use png_encoder::encode_png_async;
pub use protocol::NodeInfo;
use protocol::{
  ComputedStyleProperty, GetAttributesResult, GetBoxModelResult, GetComputedStyleResult,
  GetDocumentResult, QuerySelectorResult, Session,
};
use resource::ResourceContext;
use serde_json::{json, Value};

const DEFAULT_VIEWPORT_WIDTH: usize = 800;
const DEFAULT_VIEWPORT_HEIGHT: usize = 600;
const DEFAULT_DEVICE_PIXEL_RATIO: f32 = 1.0;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
const APP_NAME: &str = "HeadlessRustTestRunner";
const LYNX_CORE_JS_SDK_RELATIVE_PATH: &str = "resources/lynx_core.js";

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
  env: &'static LynxEnv,
  debug_router: DebugRouter,
  devtool_schema: Option<String>,
  lynx_core_path: PathBuf,
  lynx_core_source: Option<PathBuf>,
  page_owner: PageOwner,
  session_locks: Arc<SessionLocks>,
}

#[derive(Default)]
struct PageOwner {
  claim: StdMutex<Option<std::thread::ThreadId>>,
}

impl PageOwner {
  fn claim(&self) -> Result<()> {
    let current = std::thread::current().id();
    let mut claim = self.claim.lock().expect("page owner lock poisoned");
    match *claim {
      Some(owner) if owner != current => Err(Error::ThreadAffinity {
        owner: format!("{owner:?}"),
        current: format!("{current:?}"),
      }),
      Some(_) => Ok(()),
      None => {
        *claim = Some(current);
        Ok(())
      }
    }
  }
}

#[derive(Default)]
struct SessionLocks {
  locks: StdMutex<HashMap<String, Weak<tokio::sync::RwLock<()>>>>,
}

impl SessionLocks {
  fn for_url(&self, url: &str) -> Arc<tokio::sync::RwLock<()>> {
    let key = final_url_component(url).unwrap_or(url);
    let mut locks = self.locks.lock().expect("session lock map poisoned");
    locks.retain(|_, lock| lock.strong_count() > 0);
    if let Some(lock) = locks.get(key).and_then(Weak::upgrade) {
      return lock;
    }
    let lock = Arc::new(tokio::sync::RwLock::new(()));
    locks.insert(key.to_string(), Arc::downgrade(&lock));
    lock
  }
}

/// A cloneable, thread-safe handle to the process-wide Lynx runtime.
///
/// [`Lynx::new_page`] binds native pages to the first caller thread.
#[derive(Clone)]
pub struct Lynx {
  process: Arc<LynxProcess>,
  lynx_core_path: PathBuf,
  options: ConnectOptions,
}

impl Lynx {
  pub async fn connect(options: ConnectOptions) -> Result<Self> {
    let lynx_core_source = resolve_lynx_core_source(options.lynx_core_path.as_deref());
    let process = initialize_process(&options, lynx_core_source.as_deref()).await?;
    ensure_compatible_lynx_core_source(
      process.lynx_core_source.as_deref(),
      lynx_core_source.as_deref(),
    )?;
    if process.devtool_schema != options.devtool_schema {
      return Err(Error::Protocol(format!(
        "Lynx was already initialized with debug-router schema {:?}, cannot reconnect with {:?}",
        process.devtool_schema, options.devtool_schema
      )));
    }
    let lynx_core_path = process.lynx_core_path.clone();
    Ok(Self {
      process,
      lynx_core_path,
      options,
    })
  }

  pub fn new_page(&self) -> Result<Page> {
    self.process.page_owner.claim()?;
    let global_tasks = initialize_platform(self.process.env)?;
    let renderer_tasks = SharedTasks::new();
    let frames = FrameStore::default();
    let renderer = WindowlessRenderer::software(
      self.process.env,
      frames.clone(),
      QueueingHost::new(renderer_tasks.clone()),
    )?;
    let resources = ResourceContext::new(
      self.options.resources_path.clone(),
      self.lynx_core_path.clone(),
    );
    let view = LynxView::builder(self.process.env, renderer)
      .viewport(
        self.options.width as f32,
        self.options.height as f32,
        self.options.device_pixel_ratio,
      )
      .resource_fetcher(resources.fetcher())?
      .build()?;
    view.enter_foreground();
    let pump = TaskPump::new(self.process.env, renderer_tasks, global_tasks);
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

  pub fn close(self) {}
}

async fn initialize_process(
  options: &ConnectOptions,
  lynx_core_source: Option<&Path>,
) -> Result<Arc<LynxProcess>> {
  static PROCESS: tokio::sync::OnceCell<Arc<LynxProcess>> = tokio::sync::OnceCell::const_new();

  PROCESS
    .get_or_try_init(|| async {
      let lynx_core_path = install_lynx_core_resource(lynx_core_source).await?;
      let env = LynxEnv::load()?;
      set_icu_data_path_if_available(env)?;
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
        lynx_core_path,
        lynx_core_source: lynx_core_source.map(PathBuf::from),
        page_owner: PageOwner::default(),
        session_locks: Arc::new(SessionLocks::default()),
      }))
    })
    .await
    .cloned()
}

struct PageRuntime {
  view: LynxView,
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
    validate_navigation_options(&url, &options)?;
    let session_lock = self.runtime.session_locks.for_url(&url);
    let _session_write_guard = if attach_dom {
      Some(Arc::clone(&session_lock).write_owned().await)
    } else {
      None
    };
    let _session_read_guard = if attach_dom {
      None
    } else {
      Some(session_lock.read_owned().await)
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
    let previous_sequence = self.runtime.frames.sequence();

    let initial_data_json = options.initial_data_json.as_deref().or(Some("{}"));
    if is_lynx_ml_url(&url) {
      let source = decode_lynx_ml_source(&url, &bytes)?;
      self
        .runtime
        .view
        .load_lynx_ml(source, &url, initial_data_json)?;
    } else {
      let global_props = options
        .global_props_json
        .as_deref()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| self.default_global_props_json());
      self.runtime.view.load_template_bytes_with_global_props(
        &url,
        &bytes,
        initial_data_json,
        Some(&global_props),
      )?;
    }
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

fn resolve_lynx_core_source(configured_path: Option<&Path>) -> Option<PathBuf> {
  select_lynx_core_source(
    configured_path.map(PathBuf::from),
    std::env::var_os("LYNX_CORE_JS_PATH").map(PathBuf::from),
    std::env::var_os("LYNX_SDK_DIR").map(PathBuf::from),
    option_env!("LYNX_CORE_JS_PATH").map(PathBuf::from),
    option_env!("LYNX_SDK_DIR").map(PathBuf::from),
  )
}

fn select_lynx_core_source(
  configured_path: Option<PathBuf>,
  runtime_core_path: Option<PathBuf>,
  runtime_sdk_dir: Option<PathBuf>,
  build_core_path: Option<PathBuf>,
  build_sdk_dir: Option<PathBuf>,
) -> Option<PathBuf> {
  configured_path
    .or(runtime_core_path)
    .or_else(|| runtime_sdk_dir.map(lynx_core_path_in_sdk))
    .or(build_core_path)
    .or_else(|| build_sdk_dir.map(lynx_core_path_in_sdk))
}

fn lynx_core_path_in_sdk(sdk_dir: PathBuf) -> PathBuf {
  sdk_dir.join(LYNX_CORE_JS_SDK_RELATIVE_PATH)
}

fn resolve_lynx_sdk_dir() -> Option<PathBuf> {
  std::env::var_os("LYNX_SDK_DIR")
    .map(PathBuf::from)
    .or_else(|| option_env!("LYNX_SDK_DIR").map(PathBuf::from))
}

fn ensure_compatible_lynx_core_source(
  initialized_source: Option<&Path>,
  requested_source: Option<&Path>,
) -> Result<()> {
  let Some(requested_source) = requested_source else {
    return Ok(());
  };
  if initialized_source == Some(requested_source) {
    return Ok(());
  }
  let initialized_source = initialized_source
    .map(|source| source.display().to_string())
    .unwrap_or_else(|| "the existing executable resource".into());
  Err(Error::Protocol(format!(
    "Lynx was already initialized with lynx_core.js source {initialized_source}, cannot reconnect with {}",
    requested_source.display()
  )))
}

async fn install_lynx_core_resource(source: Option<&Path>) -> Result<PathBuf> {
  let executable = std::env::current_exe()?;
  let executable_dir = executable
    .parent()
    .ok_or_else(|| Error::Protocol("current executable has no parent".into()))?;
  let destination = if cfg!(target_os = "macos") {
    executable_dir.join("LynxResources.bundle/lynx_core.js")
  } else {
    executable_dir.join("lynx_core.js")
  };

  let Some(source) = source.map(PathBuf::from) else {
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

fn set_icu_data_path_if_available(env: &LynxEnv) -> Result<()> {
  let Some(sdk_dir) = resolve_lynx_sdk_dir() else {
    return Ok(());
  };
  let path = sdk_dir.join("data/icudtl.dat");
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

fn is_lynx_ml_url(url: &str) -> bool {
  final_url_component(url).is_some_and(|component| component.ends_with(".lynxml"))
}

fn decode_lynx_ml_source<'a>(url: &str, bytes: &'a [u8]) -> Result<&'a str> {
  std::str::from_utf8(bytes).map_err(|source| Error::InvalidLynxMlUtf8 {
    url: url.to_string(),
    source,
  })
}

fn validate_navigation_options(url: &str, options: &GotoOptions) -> Result<()> {
  if is_lynx_ml_url(url) && options.global_props_json.is_some() {
    return Err(Error::UnsupportedLynxMlGlobalProps);
  }
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_send_sync<T: Send + Sync>() {}

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
  fn session_locks_use_the_same_filename_equivalence_as_discovery() {
    let locks = SessionLocks::default();
    let first = locks.for_url("file:///first/main.lynx.bundle?one");
    let second = locks.for_url("file:///second/main.lynx.bundle#two");
    assert!(Arc::ptr_eq(&first, &second));
  }

  #[test]
  fn session_locks_allow_readers_and_exclude_writers() {
    let lock = SessionLocks::default().for_url("file:///fixture/main.lynx.bundle");
    let first_reader = Arc::clone(&lock).try_read_owned().unwrap();
    let second_reader = Arc::clone(&lock).try_read_owned().unwrap();
    assert!(Arc::clone(&lock).try_write_owned().is_err());
    drop((first_reader, second_reader));
    assert!(lock.try_write_owned().is_ok());
  }

  #[test]
  fn lynx_core_source_allows_implicit_or_matching_reuse() {
    let source = Path::new("first/lynx_core.js");
    assert!(ensure_compatible_lynx_core_source(Some(source), None).is_ok());
    assert!(ensure_compatible_lynx_core_source(Some(source), Some(source)).is_ok());
  }

  #[test]
  fn lynx_core_source_rejects_a_different_explicit_source() {
    let error = ensure_compatible_lynx_core_source(
      Some(Path::new("first/lynx_core.js")),
      Some(Path::new("second/lynx_core.js")),
    )
    .unwrap_err();
    assert!(error.to_string().contains("first/lynx_core.js"));
    assert!(error.to_string().contains("second/lynx_core.js"));
  }

  #[test]
  fn lynx_core_source_prefers_runtime_configuration_before_build_defaults() {
    let selected = select_lynx_core_source(
      None,
      None,
      Some(PathBuf::from("runtime-sdk")),
      Some(PathBuf::from("build/lynx_core.js")),
      Some(PathBuf::from("build-sdk")),
    );
    assert_eq!(
      selected,
      Some(PathBuf::from("runtime-sdk/resources/lynx_core.js"))
    );
  }

  #[test]
  fn lynx_core_source_falls_back_to_build_sdk() {
    let selected =
      select_lynx_core_source(None, None, None, None, Some(PathBuf::from("build-sdk")));
    assert_eq!(
      selected,
      Some(PathBuf::from("build-sdk/resources/lynx_core.js"))
    );
  }

  #[test]
  fn explicit_lynx_core_source_wins_over_all_sdk_fallbacks() {
    let selected = select_lynx_core_source(
      Some(PathBuf::from("explicit/core.js")),
      Some(PathBuf::from("runtime/core.js")),
      Some(PathBuf::from("runtime-sdk")),
      Some(PathBuf::from("build/core.js")),
      Some(PathBuf::from("build-sdk")),
    );
    assert_eq!(selected, Some(PathBuf::from("explicit/core.js")));
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

  #[test]
  fn recognizes_lynx_ml_urls_and_paths() {
    assert!(is_lynx_ml_url("file:///tmp/counter.lynxml"));
    assert!(is_lynx_ml_url(
      "https://example.test/counter.lynxml?version=1#document"
    ));
    assert!(is_lynx_ml_url("fixtures/counter.lynxml"));
    assert!(!is_lynx_ml_url("file:///tmp/main.lynx.bundle"));
    assert!(!is_lynx_ml_url("file:///tmp/counter.lynxml.map"));
  }

  #[test]
  fn rejects_global_properties_for_lynx_ml() {
    let options = GotoOptions {
      global_props_json: Some(r#"{"theme":"dark"}"#.into()),
      ..GotoOptions::default()
    };
    let error = validate_navigation_options("file:///tmp/counter.lynxml", &options).unwrap_err();
    assert!(matches!(error, Error::UnsupportedLynxMlGlobalProps));
    assert!(validate_navigation_options("file:///tmp/main.lynx.bundle", &options).is_ok());
  }

  #[test]
  fn rejects_non_utf8_lynx_ml_source() {
    let url = "file:///tmp/counter.lynxml";
    let error = decode_lynx_ml_source(url, &[0xff]).unwrap_err();
    assert!(matches!(error, Error::InvalidLynxMlUtf8 { .. }));
    assert!(error.to_string().contains(url));
  }
}
