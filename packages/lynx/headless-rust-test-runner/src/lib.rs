//! A Rust-only headless Lynx test runner.
//!
//! The API is deliberately blocking. A [`LynxContainer`] owns the native Lynx
//! state for the process owner thread. The process hosts one live [`LynxPage`]
//! at a time, and every page operation drives the native task pump inline on
//! that thread.
//! Higher-level consumers may run work concurrently before and after native
//! capture, but native containers never move between owner threads.
//!
//! ```no_run
//! use lynx_headless_rust_test_runner::{ContainerOptions, GotoOptions, LynxContainer, ScreenshotOptions};
//!
//! # fn main() -> lynx_headless_rust_test_runner::Result<()> {
//! let container = LynxContainer::new(ContainerOptions::default())?;
//! let mut page = container.new_page()?;
//! page.goto("file:///tmp/main.lynx.bundle", GotoOptions::default())?;
//! let bmp = page.screenshot(ScreenshotOptions::default())?;
//! # let _ = bmp;
//! # Ok(())
//! # }
//! ```

mod bmp;
mod debug_router;
mod error;
mod fixture;
mod harness;
mod protocol;
mod resource;

use std::cell::RefCell;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::rc::{Rc, Weak};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

use debug_router::{DebugRouter, PendingRequest};
use harness::{
  claim_process_owner_thread, pump_platform_events, register_container_thread,
  run_ready_global_tasks, FrameStore, QueueingHost, SharedTasks,
};
use lynx::{LynxEnv, LynxView, WindowlessRenderer};
use resource::ResourceContext;
use serde_json::{json, Value};

pub use bmp::{decode as decode_screenshot, Bitmap};
pub use error::{Error, Result};
pub use fixture::{run_react_fixture, RunReport};
pub use protocol::NodeInfo;
use protocol::{
  ComputedStyleProperty, GetAttributesResult, GetBoxModelResult, GetComputedStyleResult,
  GetDocumentResult, QuerySelectorResult,
};

const DEFAULT_VIEWPORT_WIDTH: usize = 800;
const DEFAULT_VIEWPORT_HEIGHT: usize = 600;
const DEFAULT_DEVICE_PIXEL_RATIO: f32 = 1.0;
const DEFAULT_TIMEOUT: Duration = Duration::from_secs(30);
const DOM_RETRY_INTERVAL: Duration = Duration::from_millis(50);
const TAP_SETTLE: Duration = Duration::from_millis(50);
const APP_NAME: &str = "HeadlessRustTestRunner";
const LYNX_CORE_JS_SDK_RELATIVE_PATH: &str = "resources/lynx_core.js";

static PROCESS_PAGE_ACTIVE: AtomicBool = AtomicBool::new(false);

/// Settings for a [`LynxContainer`] and the pages it creates.
#[derive(Clone, Debug)]
pub struct ContainerOptions {
  pub width: usize,
  pub height: usize,
  pub device_pixel_ratio: f32,
  pub timeout: Duration,
  pub lynx_core_path: Option<PathBuf>,
  pub resources_path: Option<PathBuf>,
  pub devtool_schema: Option<String>,
}

impl Default for ContainerOptions {
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
  /// Restricts this navigation and all of its resources to this directory.
  ///
  /// When set, HTTP(S) resources are rejected and `zip://` URLs resolve
  /// relative to the canonicalized directory. The directory must remain
  /// private and unmodified until the page is finished using its resources.
  pub base_dir: Option<PathBuf>,
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

/// The native Lynx state owned by the process owner thread.
///
/// Containers create and destroy pages sequentially and drive their live page
/// whenever they wait. A process may have only one live page across all of its
/// containers, and every container must be created on the same thread. The type
/// is neither `Send` nor `Sync` because the page and view it owns are bound to
/// that owner.
pub struct LynxContainer {
  shared: Rc<ContainerShared>,
}

struct ContainerShared {
  env: &'static LynxEnv,
  debug_router: DebugRouter,
  global_tasks: SharedTasks,
  lynx_core_path: PathBuf,
  options: ContainerOptions,
  pages: RefCell<Vec<Weak<PageShared>>>,
}

struct PageShared {
  view: LynxView,
  tasks: SharedTasks,
  frames: FrameStore,
  resources: ResourceContext,
  // Fields drop in declaration order. Keep this last so another page cannot
  // acquire the process slot until the native view has been dropped.
  _process_page_lease: ProcessPageLease,
}

struct ProcessPageLease;

impl ProcessPageLease {
  fn acquire() -> Result<Self> {
    PROCESS_PAGE_ACTIVE
      .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
      .map(|_| Self)
      .map_err(|_| Error::PageAlreadyOpen)
  }
}

impl Drop for ProcessPageLease {
  fn drop(&mut self) {
    PROCESS_PAGE_ACTIVE.store(false, Ordering::Release);
  }
}

impl LynxContainer {
  /// Prepares the process-wide Lynx runtime if needed and binds its first
  /// container as the permanent process owner.
  pub fn new(options: ContainerOptions) -> Result<Self> {
    let lynx_core_source = resolve_lynx_core_source(options.lynx_core_path.as_deref());
    let lynx_core_path = process_lynx_core_path(lynx_core_source.as_deref())?;
    claim_process_owner_thread()?;
    let env = process_env(&options)?;
    let debug_router = process_debug_router(options.timeout)?;
    let global_tasks = register_container_thread(env)?;
    Ok(Self {
      shared: Rc::new(ContainerShared {
        env,
        debug_router,
        global_tasks,
        lynx_core_path,
        options,
        pages: RefCell::new(Vec::new()),
      }),
    })
  }

  /// Creates a page inside this container.
  ///
  /// [`LynxPage`] has no public constructor: a page only exists as part of the
  /// container that owns its native view and drives its task queue. Drop the
  /// process's current page and every [`ElementNode`] derived from it before
  /// creating the next page, including through another container.
  pub fn new_page(&self) -> Result<LynxPage> {
    let process_page_lease = ProcessPageLease::acquire()?;
    let options = &self.shared.options;
    let tasks = SharedTasks::new();
    let frames = FrameStore::default();
    let renderer = WindowlessRenderer::software(
      self.shared.env,
      frames.clone(),
      QueueingHost::new(tasks.clone()),
    )?;
    let resources = ResourceContext::new(
      options.resources_path.clone(),
      self.shared.lynx_core_path.clone(),
    );
    let view = LynxView::builder(self.shared.env, renderer)
      .viewport(
        options.width as f32,
        options.height as f32,
        options.device_pixel_ratio,
      )
      .resource_fetcher(resources.fetcher())?
      .build()?;
    view.enter_foreground();
    let page = Rc::new(PageShared {
      view,
      tasks,
      frames,
      resources,
      _process_page_lease: process_page_lease,
    });
    let mut pages = self.shared.pages.borrow_mut();
    pages.retain(|page| page.strong_count() > 0);
    pages.push(Rc::downgrade(&page));
    drop(pages);
    Ok(LynxPage {
      container: Rc::clone(&self.shared),
      page,
      root_node_id: None,
      session_id: None,
      timeout: options.timeout,
      url: String::new(),
    })
  }
}

impl ContainerShared {
  /// Runs every native task that is ready across all live pages.
  fn pump_once(&self) {
    let pages = {
      let mut pages = self.pages.borrow_mut();
      pages.retain(|page| page.strong_count() > 0);
      pages.iter().filter_map(Weak::upgrade).collect::<Vec<_>>()
    };
    let mut ran_task = false;
    for page in pages {
      for task in page.tasks.drain_ready() {
        page.view.renderer().run_task(task);
        ran_task = true;
      }
    }
    ran_task |= run_ready_global_tasks(self.env, &self.global_tasks);
    let max_wait = if ran_task {
      Duration::ZERO
    } else {
      Duration::from_millis(1)
    };
    let _ = pump_platform_events(max_wait);
  }

  fn pump_for(&self, duration: Duration) {
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline {
      self.pump_once();
    }
  }

  /// Pumps until `ready` produces a value or the deadline passes.
  fn pump_until<T>(&self, deadline: Instant, mut ready: impl FnMut() -> Option<T>) -> Option<T> {
    loop {
      if let Some(value) = ready() {
        return Some(value);
      }
      if Instant::now() >= deadline {
        return None;
      }
      self.pump_once();
    }
  }

  /// Sends a CDP request, keeping the native pump running until it resolves.
  fn send_cdp<T, P>(&self, session_id: i64, method: &str, params: P) -> Result<T>
  where
    T: serde::de::DeserializeOwned,
    P: serde::Serialize,
  {
    let pending: PendingRequest = self.debug_router.send_cdp(session_id, method, params)?;
    loop {
      if let Some(result) = pending.poll::<T>() {
        return result;
      }
      self.pump_once();
    }
  }
}

/// A page inside a [`LynxContainer`].
///
/// Node lookup, simulated interaction, and screenshots all live here.
pub struct LynxPage {
  container: Rc<ContainerShared>,
  page: Rc<PageShared>,
  root_node_id: Option<i64>,
  session_id: Option<i64>,
  /// The budget the last `goto` used, reused when the DOM attaches lazily.
  timeout: Duration,
  url: String,
}

impl LynxPage {
  /// Loads a compiled `.lynx.bundle` or a UTF-8 `.lynxml` document and waits
  /// for the first new frame.
  ///
  /// The DOM session is attached lazily, so a screenshot-only caller never pays
  /// for DevTools setup.
  pub fn goto(&mut self, input: &str, options: GotoOptions) -> Result<()> {
    let timeout = options.timeout.unwrap_or(self.container.options.timeout);
    let (url, bytes, base_dir) = self
      .page
      .resources
      .read_template(input, options.base_dir.as_deref())?;
    validate_navigation_options(&url, &options)?;
    self.page.resources.set_navigation(&url, base_dir);
    let previous_sequence = self.page.frames.sequence();

    let initial_data_json = options.initial_data_json.as_deref().or(Some("{}"));
    if is_lynx_ml_url(&url) {
      let source = decode_lynx_ml_source(&url, &bytes)?;
      self
        .page
        .view
        .load_lynx_ml(source, &url, initial_data_json)?;
    } else {
      let global_props = options
        .global_props_json
        .as_deref()
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| self.default_global_props_json());
      self.page.view.load_template_bytes_with_global_props(
        &url,
        &bytes,
        initial_data_json,
        Some(&global_props),
      )?;
    }
    self.page.view.enter_foreground();
    self.page.view.set_frame(
      0.0,
      0.0,
      self.container.options.width as f32,
      self.container.options.height as f32,
    );

    // A newly presented frame is the readiness signal, even when every pixel
    // is still transparent.
    let deadline = Instant::now() + timeout;
    let frames = self.page.frames.clone();
    self
      .container
      .pump_until(deadline, || {
        frames
          .latest()
          .filter(|frame| frame.sequence > previous_sequence)
      })
      .ok_or_else(|| Error::Timeout("waiting for a rendered frame".into()))?;

    // The previous document's node ids do not survive navigation.
    self.root_node_id = None;
    self.session_id = None;
    self.timeout = timeout;
    self.url = url;
    Ok(())
  }

  pub fn url(&self) -> &str {
    &self.url
  }

  /// Serializes the current DOM.
  pub fn content(&mut self) -> Result<String> {
    let session_id = self.attached_session()?;
    let document: GetDocumentResult =
      self
        .container
        .send_cdp(session_id, "DOM.getDocument", json!({ "depth": -1 }))?;
    let mut buffer = String::new();
    content_to_string(&mut buffer, &document.root);
    Ok(buffer)
  }

  /// Looks up a node by CSS selector.
  pub fn locator(&mut self, selector: &str) -> Result<Option<ElementNode>> {
    let session_id = self.attached_session()?;
    let root_node_id = self.root_node_id.ok_or(Error::PageNotLoaded)?;
    let mut result = self.query_selector(session_id, root_node_id, selector)?;
    if result.node_id == -1 {
      // A re-rendered document invalidates the cached root node id.
      let root_node_id = self.current_root_node_id(session_id)?;
      self.root_node_id = Some(root_node_id);
      result = self.query_selector(session_id, root_node_id, selector)?;
    }
    if result.node_id == -1 {
      return Ok(None);
    }
    Ok(Some(ElementNode {
      node_id: result.node_id,
      session_id,
      container: Rc::clone(&self.container),
      page: Rc::clone(&self.page),
    }))
  }

  /// Captures the latest presented frame as a 32-bit BMP.
  pub fn screenshot(&mut self, options: ScreenshotOptions) -> Result<Vec<u8>> {
    if !options.settle.is_zero() {
      self.container.pump_for(options.settle);
    }
    let frame = self.page.frames.latest().ok_or(Error::FrameNotAvailable)?;
    let bitmap = bmp::encode(frame.width, frame.height, &frame.rgba)?;
    if let Some(path) = options.path {
      if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
      }
      std::fs::write(path, &bitmap)?;
    }
    Ok(bitmap)
  }

  /// Drives the container for `duration` so pending work can settle.
  pub fn wait_for_timeout(&mut self, duration: Duration) {
    self.container.pump_for(duration);
  }

  fn default_global_props_json(&self) -> String {
    json!({
      "initialPage": "home",
      "platform": std::env::consts::OS,
      "screenWidth": self.container.options.width,
      "screenHeight": self.container.options.height,
      "pixelRatio": self.container.options.device_pixel_ratio,
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

  /// Returns this page's DevTools session, attaching on first use.
  ///
  /// The session id comes from the page's own native view, so successive pages
  /// that load the same URL cannot be confused for one another.
  fn attached_session(&mut self) -> Result<i64> {
    if let Some(session_id) = self.session_id {
      return Ok(session_id);
    }
    if self.url.is_empty() {
      return Err(Error::PageNotLoaded);
    }
    // The lazy attach belongs to the navigation that produced this document,
    // so it gets that call's budget rather than the container default.
    let deadline = Instant::now() + self.timeout;
    let session_id = self.wait_for_devtool_session(deadline)?;
    self.enable_dom(session_id, deadline)?;
    self.session_id = Some(session_id);
    Ok(session_id)
  }

  fn wait_for_devtool_session(&self, deadline: Instant) -> Result<i64> {
    loop {
      match self.page.view.devtool_target() {
        Ok(Some(target)) => return Ok(i64::from(target.session_id)),
        Ok(None) => {}
        Err(lynx::Error::UnsupportedRuntimeApi { .. }) => {
          return Err(Error::DevtoolTargetUnavailable)
        }
        Err(error) => return Err(Error::from(error)),
      }
      if Instant::now() >= deadline {
        return Err(Error::Timeout(format!(
          "waiting for a DevTools session for {}",
          self.url
        )));
      }
      self.container.pump_once();
    }
  }

  fn enable_dom(&mut self, session_id: i64, deadline: Instant) -> Result<()> {
    let mut last_error = None;
    while Instant::now() < deadline {
      match self.container.send_cdp::<Value, _>(
        session_id,
        "DOM.enable",
        json!({ "useCompression": false }),
      ) {
        Ok(_) => match self.current_root_node_id(session_id) {
          Ok(root_node_id) => {
            self.root_node_id = Some(root_node_id);
            return Ok(());
          }
          Err(error) => last_error = Some(error.to_string()),
        },
        Err(error) => last_error = Some(error.to_string()),
      }
      self.container.pump_for(DOM_RETRY_INTERVAL);
    }
    Err(Error::Timeout(format!(
      "attaching to DOM session {session_id}; last error: {}",
      last_error.unwrap_or_else(|| "none".into())
    )))
  }

  fn current_root_node_id(&self, session_id: i64) -> Result<i64> {
    let document: GetDocumentResult =
      self
        .container
        .send_cdp(session_id, "DOM.getDocument", json!({ "depth": -1 }))?;
    Ok(
      document
        .root
        .children
        .first()
        .unwrap_or(&document.root)
        .node_id,
    )
  }

  fn query_selector(
    &self,
    session_id: i64,
    root_node_id: i64,
    selector: &str,
  ) -> Result<QuerySelectorResult> {
    self.container.send_cdp(
      session_id,
      "DOM.querySelector",
      json!({ "nodeId": root_node_id, "selector": selector }),
    )
  }
}

/// A node located on a [`LynxPage`].
#[derive(Clone)]
pub struct ElementNode {
  pub node_id: i64,
  session_id: i64,
  container: Rc<ContainerShared>,
  page: Rc<PageShared>,
}

impl ElementNode {
  /// Dispatches a native `tap` directly to this node id.
  ///
  /// Overlay and stacking relationships can make coordinate hit-testing pick a
  /// different node, so the node id is the input, not a derived point.
  pub fn tap(&self) -> Result<()> {
    let node_id = i32::try_from(self.node_id)
      .map_err(|_| Error::Protocol(format!("node id {} is out of range", self.node_id)))?;
    self.page.view.send_touch_event("tap", node_id)?;
    self.container.pump_for(TAP_SETTLE);
    Ok(())
  }

  pub fn bounding_box(&self) -> Result<BoundingBox> {
    let result: GetBoxModelResult = self.container.send_cdp(
      self.session_id,
      "DOM.getBoxModel",
      json!({ "nodeId": self.node_id }),
    )?;
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

  pub fn get_attribute(&self, name: &str) -> Result<Option<String>> {
    let name = if name == "id" { "idSelector" } else { name };
    let result: GetAttributesResult = self.container.send_cdp(
      self.session_id,
      "DOM.getAttributes",
      json!({ "nodeId": self.node_id }),
    )?;
    Ok(result.attributes.chunks(2).find_map(|pair| {
      (pair.first().map(String::as_str) == Some(name))
        .then(|| pair.get(1).cloned())
        .flatten()
    }))
  }

  pub fn computed_style_map(&self) -> Result<BTreeMap<String, String>> {
    let result: GetComputedStyleResult = self.container.send_cdp(
      self.session_id,
      "CSS.getComputedStyleForNode",
      json!({ "nodeId": self.node_id }),
    )?;
    Ok(
      result
        .computed_style
        .into_iter()
        .map(|ComputedStyleProperty { name, value }| (name, value))
        .collect(),
    )
  }
}

/// Loads the runtime and applies the process-wide devtool settings once.
fn process_env(options: &ContainerOptions) -> Result<&'static LynxEnv> {
  static ENV: OnceLock<std::result::Result<&'static LynxEnv, String>> = OnceLock::new();
  static SCHEMA: Mutex<Option<Option<String>>> = Mutex::new(None);

  let env = ENV
    .get_or_init(|| {
      let env = LynxEnv::load().map_err(|error| error.to_string())?;
      set_icu_data_path_if_available(env).map_err(|error| error.to_string())?;
      let app_name = process_app_name();
      env
        .set_devtool_app_info("App", app_name)
        .and_then(|()| env.set_devtool_app_info("AppVersion", env!("CARGO_PKG_VERSION")))
        .and_then(|()| env.set_devtool_app_info("AppProcessName", app_name))
        .and_then(|()| env.set_devtool_app_info("deviceModel", "headless"))
        .and_then(|()| env.set_devtool_app_info("osVersion", std::env::consts::OS))
        .and_then(|()| env.set_devtool_app_info("sdkVersion", &env.sdk_version()))
        .map_err(|error| error.to_string())?;
      env.set_devtool_enabled(true);
      if let Some(schema) = &options.devtool_schema {
        match env.connect_devtool(schema) {
          Ok(true) => {}
          Ok(false) => return Err(format!("failed to connect debug-router schema: {schema}")),
          Err(error) => return Err(error.to_string()),
        }
      }
      Ok(env)
    })
    .as_ref()
    .map(|env| *env)
    .map_err(|message| Error::Protocol(message.clone()))?;

  // The devtool schema is a process-wide switch, so a second container cannot
  // silently ask for a different one.
  let mut schema = SCHEMA
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner());
  match schema.as_ref() {
    None => *schema = Some(options.devtool_schema.clone()),
    Some(existing) if existing == &options.devtool_schema => {}
    Some(existing) => {
      return Err(Error::Protocol(format!(
        "Lynx was already initialized with debug-router schema {existing:?}, cannot reuse it with {:?}",
        options.devtool_schema
      )))
    }
  }
  Ok(env)
}

fn process_app_name() -> &'static str {
  static APP: OnceLock<String> = OnceLock::new();
  APP.get_or_init(|| format!("{APP_NAME}-{}", std::process::id()))
}

/// Connects the single DebugRouter client this process is allowed to hold.
fn process_debug_router(timeout: Duration) -> Result<DebugRouter> {
  static ROUTER: OnceLock<DebugRouter> = OnceLock::new();
  static CONNECTING: Mutex<()> = Mutex::new(());

  if let Some(router) = ROUTER.get() {
    return Ok(router.clone());
  }
  // Serialize the fallible connect separately from `OnceLock` so a failed
  // first attempt does not permanently poison the process.
  let _guard = CONNECTING
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner());
  if let Some(router) = ROUTER.get() {
    return Ok(router.clone());
  }
  let router = DebugRouter::connect(process_app_name(), timeout)?;
  let _ = ROUTER.set(router.clone());
  Ok(router)
}

/// Installs `lynx_core.js` next to the executable once per process.
fn process_lynx_core_path(source: Option<&Path>) -> Result<PathBuf> {
  static CORE: OnceLock<(PathBuf, Option<PathBuf>)> = OnceLock::new();
  static INSTALLING: Mutex<()> = Mutex::new(());

  if CORE.get().is_none() {
    let _guard = INSTALLING
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    if CORE.get().is_none() {
      let installed = install_lynx_core_resource(source)?;
      let _ = CORE.set((installed, source.map(PathBuf::from)));
    }
  }
  let (path, installed_source) = CORE.get().expect("Lynx core installation is serialized");
  ensure_compatible_lynx_core_source(installed_source.as_deref(), source)?;
  Ok(path.clone())
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
    "Lynx was already initialized with lynx_core.js source {initialized_source}, cannot reuse it with {}",
    requested_source.display()
  )))
}

fn install_lynx_core_resource(source: Option<&Path>) -> Result<PathBuf> {
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
    return destination
      .is_file()
      .then_some(destination)
      .ok_or(Error::MissingLynxCore);
  };
  if !source.is_file() {
    return Err(Error::LynxCoreNotFound(source));
  }
  if let Some(parent) = destination.parent() {
    std::fs::create_dir_all(parent)?;
  }
  std::fs::copy(source, &destination)?;
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

  // Containers, pages, and nodes own thread-bound native handles. Gaining an
  // unsafe `Send` would let a caller move a live view off its owner thread.
  static_assertions::assert_not_impl_any!(LynxContainer: Send, Sync);
  static_assertions::assert_not_impl_any!(LynxPage: Send, Sync);
  static_assertions::assert_not_impl_any!(ElementNode: Send, Sync);

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
