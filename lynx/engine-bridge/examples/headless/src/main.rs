use lynx::{
  run_global_ui_task, set_global_ui_task_runner, Env, FetchResponse, GlobalUiTaskRunner,
  HeadlessView, LynxGroup, ResourceFetcher, ResourceRequest, SoftwareFrame, SoftwareRenderer, Task,
  ViewClient, ViewClientHandler, WindowlessHost, WindowlessRenderer,
};
use lynx_headless_example::write_png;
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::thread::ThreadId;
use std::time::{Duration, Instant};

const DEFAULT_WIDTH: f32 = 800.0;
const DEFAULT_HEIGHT: f32 = 600.0;
const DEFAULT_DPR: f32 = 1.0;

#[derive(Clone)]
struct SharedTasks {
  queue: Arc<Mutex<Vec<ScheduledTask>>>,
}

struct ScheduledTask {
  task: Task,
  deadline: Instant,
}

impl SharedTasks {
  fn new() -> Self {
    Self {
      queue: Arc::new(Mutex::new(Vec::new())),
    }
  }

  fn push(&self, task: Task, delay: Duration) {
    let deadline = Instant::now()
      .checked_add(delay)
      .unwrap_or_else(Instant::now);
    self
      .queue
      .lock()
      .expect("task queue lock poisoned")
      .push(ScheduledTask { task, deadline });
  }

  fn drain_ready(&self) -> Vec<Task> {
    let now = Instant::now();
    let mut queue = self.queue.lock().expect("task queue lock poisoned");
    let mut ready = Vec::new();
    let mut pending = Vec::with_capacity(queue.len());
    for scheduled in queue.drain(..) {
      if scheduled.deadline <= now {
        ready.push(scheduled.task);
      } else {
        pending.push(scheduled);
      }
    }
    *queue = pending;
    ready
  }

  fn next_deadline(&self) -> Option<Instant> {
    self
      .queue
      .lock()
      .expect("task queue lock poisoned")
      .iter()
      .map(|scheduled| scheduled.deadline)
      .min()
  }
}

struct QueueingHost {
  tasks: SharedTasks,
}

impl WindowlessHost for QueueingHost {
  fn post_task(&mut self, task: Task, interval_nanoseconds: u64) {
    self
      .tasks
      .push(task, Duration::from_nanos(interval_nanoseconds));
  }
}

struct QueueingGlobalRunner {
  tasks: SharedTasks,
  thread_id: ThreadId,
}

impl GlobalUiTaskRunner for QueueingGlobalRunner {
  fn runs_on_current_thread(&mut self) -> bool {
    thread::current().id() == self.thread_id
  }

  fn post_task(&mut self, task: Task, _target_time_nanos: u64) {
    self.tasks.push(task, Duration::ZERO);
  }
}

#[derive(Clone)]
struct FrameSink {
  latest: Arc<Mutex<Option<CapturedFrame>>>,
}

struct CapturedFrame {
  width: usize,
  height: usize,
  rgba: Vec<u8>,
}

impl CapturedFrame {
  fn visible_pixel_count(&self) -> usize {
    self
      .rgba
      .chunks_exact(4)
      .filter(|pixel| pixel[3] != 0)
      .count()
  }
}

impl SoftwareRenderer for FrameSink {
  fn present(&mut self, frame: SoftwareFrame) -> bool {
    let Some(bytes) = (unsafe { frame.bytes() }) else {
      return false;
    };
    if !frame.row_bytes.is_multiple_of(4) {
      return false;
    }
    let width = frame.row_bytes / 4;
    let height = frame.height;
    let rgba = bytes.to_vec();
    let captured = CapturedFrame {
      width,
      height,
      rgba,
    };
    let visible_pixels = captured.visible_pixel_count();
    *self.latest.lock().expect("frame lock poisoned") = Some(captured);
    println!(
      "captured software frame: {}x{} row_bytes={} visible_pixels={}",
      width, height, frame.row_bytes, visible_pixels
    );
    true
  }
}

#[derive(Clone, Default)]
struct LifecycleRecorder {
  state: Arc<Mutex<LifecycleState>>,
}

#[derive(Debug, Default)]
struct LifecycleState {
  page_start_url: Option<String>,
  load_success: bool,
  first_screen: bool,
  page_updates: usize,
  data_updates: usize,
  runtime_ready: bool,
  enter_foreground_count: usize,
  enter_background_count: usize,
  frame_timings: usize,
  destroyed: bool,
  errors: Vec<String>,
}

impl LifecycleRecorder {
  fn state(&self) -> Arc<Mutex<LifecycleState>> {
    self.state.clone()
  }
}

impl LifecycleState {
  fn summary(&self) -> String {
    format!(
      "page_start_url={:?} load_success={} first_screen={} runtime_ready={} page_updates={} data_updates={} enter_foreground={} enter_background={} frame_timings={} destroyed={} errors={:?}",
      self.page_start_url,
      self.load_success,
      self.first_screen,
      self.runtime_ready,
      self.page_updates,
      self.data_updates,
      self.enter_foreground_count,
      self.enter_background_count,
      self.frame_timings,
      self.destroyed,
      self.errors
    )
  }
}

impl ViewClientHandler for LifecycleRecorder {
  fn on_page_start(&mut self, url: &str) {
    println!("view lifecycle: page_start url={url}");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .page_start_url = Some(url.to_string());
  }

  fn on_load_success(&mut self) {
    println!("view lifecycle: load_success");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .load_success = true;
  }

  fn on_first_screen(&mut self) {
    println!("view lifecycle: first_screen");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .first_screen = true;
  }

  fn on_page_updated(&mut self) {
    println!("view lifecycle: page_updated");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .page_updates += 1;
  }

  fn on_data_updated(&mut self) {
    println!("view lifecycle: data_updated");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .data_updates += 1;
  }

  fn on_runtime_ready(&mut self) {
    println!("view lifecycle: runtime_ready");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .runtime_ready = true;
  }

  fn on_received_error(&mut self, error_code: i32, message: &str) {
    println!("view lifecycle: error code={error_code} message={message}");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .errors
      .push(format!("{error_code}: {message}"));
  }

  fn on_enter_foreground(&mut self) {
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .enter_foreground_count += 1;
  }

  fn on_enter_background(&mut self) {
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .enter_background_count += 1;
  }

  fn on_frame_timing(&mut self, frame_start_time_in_ns: i64, frame_finish_time_in_ns: i64) {
    println!(
      "view lifecycle: frame_timing start={frame_start_time_in_ns} finish={frame_finish_time_in_ns}"
    );
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .frame_timings += 1;
  }

  fn on_destroy(&mut self) {
    println!("view lifecycle: destroy");
    self
      .state
      .lock()
      .expect("lifecycle lock poisoned")
      .destroyed = true;
  }
}

struct DirectoryResourceFetcher {
  roots: Vec<PathBuf>,
}

impl DirectoryResourceFetcher {
  fn new(roots: Vec<PathBuf>) -> Self {
    Self { roots }
  }

  fn resolve(&self, url: &str) -> Option<PathBuf> {
    let path = url
      .strip_prefix("file://lynx?")
      .unwrap_or(url)
      .strip_prefix("local://")
      .or_else(|| url.strip_prefix("assets://"))
      .or_else(|| url.strip_prefix("file://"))
      .unwrap_or(url)
      .trim_start_matches('/');
    for root in &self.roots {
      let candidate = root.join(path);
      if candidate.is_file() {
        return Some(candidate);
      }
    }
    None
  }
}

impl ResourceFetcher for DirectoryResourceFetcher {
  fn fetch(&mut self, request: ResourceRequest) -> FetchResponse {
    match self
      .resolve(&request.url)
      .and_then(|path| fs::read(path).ok())
    {
      Some(data) => FetchResponse::ok(data),
      None => FetchResponse::error(-1, format!("resource not found: {}", request.url)),
    }
  }
}

struct Options {
  bundle: PathBuf,
  screenshot: PathBuf,
  asset_roots: Vec<PathBuf>,
  preload_js_paths: Vec<PathBuf>,
  timeout: Duration,
  initial_data_json: String,
  global_props_json: String,
  native_ui_loop: bool,
}

fn main() -> lynx::Result<()> {
  let options = parse_options();
  let env = Env::load()?;
  let sdk_dir = env::var_os("LYNX_SDK_DIR").map(PathBuf::from);
  if let Some(sdk_dir) = &sdk_dir {
    for relative in ["data/icudtl.dat", "icudtl.dat"] {
      let icu_path = sdk_dir.join(relative);
      if icu_path.is_file() {
        env.set_icu_data_path(icu_path.to_string_lossy().as_ref())?;
        break;
      }
    }
  }
  println!("Lynx SDK version: {}", env.sdk_version());

  let renderer_tasks = SharedTasks::new();
  let global_tasks = SharedTasks::new();
  if options.native_ui_loop {
    println!("global UI task runner skipped; using native UI loop");
  } else {
    let global_runner_set = set_global_ui_task_runner(
      &env,
      QueueingGlobalRunner {
        tasks: global_tasks.clone(),
        thread_id: thread::current().id(),
      },
    )?;
    println!("global UI task runner set: {global_runner_set}");
  }

  let frame_slot = Arc::new(Mutex::new(None));
  let renderer = WindowlessRenderer::software(
    &env,
    FrameSink {
      latest: frame_slot.clone(),
    },
    QueueingHost {
      tasks: renderer_tasks.clone(),
    },
  )?;

  let mut roots = options.asset_roots.clone();
  if let Some(parent) = options.bundle.parent() {
    roots.push(parent.to_path_buf());
  }
  let mut preload_js_paths = options.preload_js_paths.clone();
  if preload_js_paths.is_empty() {
    if let Some(sdk_dir) = &sdk_dir {
      for relative in [
        "bundles/LynxResources.bundle/Contents/Resources/lynx_core.js",
        "LynxResources.bundle/Contents/Resources/lynx_core.js",
        "lynx_core.js",
      ] {
        let candidate = sdk_dir.join(relative);
        if candidate.is_file() {
          preload_js_paths.push(candidate);
          break;
        }
      }
    }
  }
  let lynx_group = if preload_js_paths.is_empty() {
    None
  } else {
    let mut group = LynxGroup::with_id(&env, "lynx-headless-example", "-1")?;
    let paths = preload_js_paths
      .iter()
      .map(|path| path.to_string_lossy().into_owned())
      .collect::<Vec<_>>();
    group.set_preload_js_paths(paths.iter().map(String::as_str))?;
    Some(group)
  };

  let mut builder = HeadlessView::builder(env.clone(), renderer)
    .viewport(DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_DPR)
    .resource_fetcher(DirectoryResourceFetcher::new(roots))?;
  if let Some(group) = lynx_group {
    builder = builder.lynx_group(group);
  }
  let lifecycle = LifecycleRecorder::default();
  let lifecycle_state = lifecycle.state();
  let mut view = builder.build()?;
  view.add_client(ViewClient::new(&env, lifecycle)?);
  view.enter_foreground();

  let bundle = fs::read(&options.bundle).map_err(|source| lynx::Error::Io {
    operation: "read bundle",
    path: options.bundle.clone(),
    source,
  })?;
  view.load_template_bundle_bytes_with_global_props(
    "assets://main.lynx.bundle",
    &bundle,
    Some(&options.initial_data_json),
    Some(&options.global_props_json),
  )?;
  view.enter_foreground();

  let deadline = Instant::now() + options.timeout;
  let mut renderer_tasks_run = 0usize;
  let mut global_tasks_run = 0usize;
  while Instant::now() < deadline {
    let mut ran_task = false;
    for task in renderer_tasks.drain_ready() {
      view.renderer().run_task(task);
      renderer_tasks_run += 1;
      ran_task = true;
    }
    for task in global_tasks.drain_ready() {
      run_global_ui_task(&env, task);
      global_tasks_run += 1;
      ran_task = true;
    }
    if frame_slot
      .lock()
      .expect("frame lock poisoned")
      .as_ref()
      .is_some_and(|frame| frame.visible_pixel_count() > 0)
    {
      break;
    }
    if !ran_task {
      let now = Instant::now();
      let next_deadline = renderer_tasks
        .next_deadline()
        .into_iter()
        .chain(global_tasks.next_deadline())
        .min();
      let sleep_for = next_deadline
        .and_then(|deadline| deadline.checked_duration_since(now))
        .unwrap_or_else(|| Duration::from_millis(16))
        .min(Duration::from_millis(16));
      wait_for_host_events(sleep_for);
    }
  }

  let frame = frame_slot
    .lock()
    .expect("frame lock poisoned")
    .take()
    .ok_or_else(|| {
      let lifecycle = lifecycle_state
        .lock()
        .expect("lifecycle lock poisoned")
        .summary();
      lynx::Error::Message(format!(
        "timed out waiting for software frame; renderer_tasks_run={renderer_tasks_run} global_tasks_run={global_tasks_run}; {lifecycle}"
      ))
    })?;
  if frame.visible_pixel_count() == 0 {
    return Err(lynx::Error::Message(
      "timed out waiting for non-empty software frame".into(),
    ));
  }
  write_png(&options.screenshot, frame.width, frame.height, &frame.rgba).map_err(|source| {
    lynx::Error::Io {
      operation: "write screenshot",
      path: options.screenshot.clone(),
      source,
    }
  })?;
  println!("wrote screenshot: {}", options.screenshot.display());
  Ok(())
}

fn parse_options() -> Options {
  let mut bundle = env::var_os("LYNX_E2E_BUNDLE").map(PathBuf::from);
  let mut screenshot = env::var_os("LYNX_E2E_SCREENSHOT")
    .map(PathBuf::from)
    .unwrap_or_else(|| env::temp_dir().join("lynx-headless-e2e.png"));
  let mut asset_roots = Vec::new();
  let mut preload_js_paths = env::var_os("LYNX_E2E_PRELOAD_JS")
    .map(PathBuf::from)
    .into_iter()
    .collect::<Vec<_>>();
  let mut timeout = Duration::from_secs(10);
  let mut native_ui_loop = false;
  let mut initial_data_json = "{}".to_string();
  let mut global_props_json = format!(
        "{{\"initialPage\":\"home\",\"platform\":\"{}\",\"screenWidth\":{},\"screenHeight\":{},\"theme\":\"light\",\"frontendTheme\":\"light\",\"preferredTheme\":\"light\",\"safeAreaTop\":0,\"safeAreaBottom\":0,\"safeAreaLeft\":0,\"safeAreaRight\":0}}",
        env::consts::OS, DEFAULT_WIDTH as u32, DEFAULT_HEIGHT as u32
    );

  let mut args = env::args().skip(1);
  while let Some(arg) = args.next() {
    match arg.as_str() {
      "--bundle" => bundle = args.next().map(PathBuf::from),
      "--screenshot" => {
        screenshot = args
          .next()
          .map(PathBuf::from)
          .unwrap_or_else(|| screenshot.clone())
      }
      "--asset-root" => {
        if let Some(root) = args.next() {
          asset_roots.push(PathBuf::from(root));
        }
      }
      "--preload-js" => {
        if let Some(path) = args.next() {
          preload_js_paths.push(PathBuf::from(path));
        }
      }
      "--timeout-ms" => {
        if let Some(value) = args.next().and_then(|value| value.parse::<u64>().ok()) {
          timeout = Duration::from_millis(value);
        }
      }
      "--initial-data-json" => {
        if let Some(value) = args.next() {
          initial_data_json = value;
        }
      }
      "--global-props-json" => {
        if let Some(value) = args.next() {
          global_props_json = value;
        }
      }
      "--native-ui-loop" => {
        native_ui_loop = true;
      }
      _ => {}
    }
  }

  let bundle = bundle.unwrap_or_else(|| {
    eprintln!("usage: lynx-headless-example --bundle path/to/main.lynx.bundle");
    std::process::exit(2);
  });
  Options {
    bundle,
    screenshot,
    asset_roots,
    preload_js_paths,
    timeout,
    initial_data_json,
    global_props_json,
    native_ui_loop,
  }
}

#[cfg(target_os = "macos")]
fn wait_for_host_events(duration: Duration) {
  use std::ffi::c_void;

  type CFRunLoopMode = *const c_void;

  #[link(name = "CoreFoundation", kind = "framework")]
  extern "C" {
    static kCFRunLoopDefaultMode: CFRunLoopMode;
    fn CFRunLoopRunInMode(
      mode: CFRunLoopMode,
      seconds: f64,
      return_after_source_handled: u8,
    ) -> i32;
  }

  unsafe {
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, duration.as_secs_f64(), 1);
  }
}

#[cfg(not(target_os = "macos"))]
fn wait_for_host_events(duration: Duration) {
  thread::sleep(duration);
}
