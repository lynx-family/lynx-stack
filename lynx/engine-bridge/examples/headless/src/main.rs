use lynx::{
  run_global_ui_task, set_global_ui_task_runner, Env, FetchResponse, GlobalUiTaskRunner,
  HeadlessView, LynxGroup, ResourceFetcher, ResourceRequest, SoftwareFrame, SoftwareRenderer, Task,
  WindowlessHost, WindowlessRenderer,
};
use lynx_headless_example::write_png;
use std::env;
use std::ffi::OsString;
use std::fs;
use std::io::ErrorKind;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::thread;
use std::thread::ThreadId;
use std::time::{Duration, Instant};

const DEFAULT_WIDTH: f32 = 800.0;
const DEFAULT_HEIGHT: f32 = 600.0;
const DEFAULT_DPR: f32 = 1.0;
const USAGE: &str = concat!(
  "usage: lynx-headless-example --bundle path/to/main.lynx.bundle [options]\n\n",
  "options:\n",
  "  --screenshot path/to/output.png\n",
  "  --asset-root path/to/assets\n",
  "  --preload-js path/to/lynx_core.js\n",
  "  --timeout-ms milliseconds\n",
  "  --initial-data-json json\n",
  "  --global-props-json json\n",
  "  --native-ui-loop"
);

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

struct DirectoryResourceFetcher {
  roots: Vec<PathBuf>,
}

impl DirectoryResourceFetcher {
  fn new(roots: Vec<PathBuf>) -> Self {
    Self { roots }
  }

  fn read(&self, url: &str) -> std::result::Result<Vec<u8>, String> {
    let path = resource_path_from_url(url)
      .ok_or_else(|| format!("resource URL is not a relative file path: {url}"))?;
    for root in &self.roots {
      let candidate = root.join(&path);
      match fs::read(&candidate) {
        Ok(data) => return Ok(data),
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => {
          return Err(format!(
            "failed to read resource {} for URL {url}: {error}",
            candidate.display()
          ));
        }
      }
    }
    Err(format!("resource not found: {url}"))
  }
}

impl ResourceFetcher for DirectoryResourceFetcher {
  fn fetch(&mut self, request: ResourceRequest) -> FetchResponse {
    match self.read(&request.url) {
      Ok(data) => FetchResponse::ok(data),
      Err(message) => FetchResponse::error(-1, message),
    }
  }
}

fn resource_path_from_url(url: &str) -> Option<PathBuf> {
  let path = if let Some(path) = url.strip_prefix("file://lynx?") {
    path
  } else if let Some(path) = url.strip_prefix("local://") {
    path
  } else if let Some(path) = url.strip_prefix("assets://") {
    path
  } else if let Some(path) = url.strip_prefix("file://") {
    path
  } else {
    url
  }
  .trim_start_matches('/');
  if path.is_empty() {
    return None;
  }

  let mut relative_path = PathBuf::new();
  for component in Path::new(path).components() {
    match component {
      Component::Normal(part) => relative_path.push(part),
      Component::CurDir | Component::RootDir => {}
      Component::ParentDir | Component::Prefix(_) => return None,
    }
  }

  (!relative_path.as_os_str().is_empty()).then_some(relative_path)
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

fn configured_sdk_dir() -> Option<PathBuf> {
  env::var_os("LYNX_SDK_DIR")
    .or_else(|| option_env!("LYNX_SDK_DIR").map(OsString::from))
    .map(PathBuf::from)
}

fn main() {
  if let Err(error) = run() {
    eprintln!("{error}");
    std::process::exit(1);
  }
}

fn run() -> lynx::Result<()> {
  let Some(options) = parse_options()? else {
    println!("{USAGE}");
    return Ok(());
  };
  let env = Env::load()?;
  let sdk_dir = configured_sdk_dir();
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
  let view = builder.build()?;
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
      lynx::Error::Message(format!(
        "timed out waiting for software frame; renderer_tasks_run={renderer_tasks_run} global_tasks_run={global_tasks_run}"
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

fn parse_options() -> lynx::Result<Option<Options>> {
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
  let mut global_props_json = default_global_props_json();

  let mut args = env::args().skip(1);
  while let Some(arg) = args.next() {
    match arg.as_str() {
      "--bundle" => bundle = Some(PathBuf::from(next_arg(&mut args, "--bundle")?)),
      "--screenshot" => {
        screenshot = PathBuf::from(next_arg(&mut args, "--screenshot")?);
      }
      "--asset-root" => {
        asset_roots.push(PathBuf::from(next_arg(&mut args, "--asset-root")?));
      }
      "--preload-js" => {
        preload_js_paths.push(PathBuf::from(next_arg(&mut args, "--preload-js")?));
      }
      "--timeout-ms" => {
        let value = next_arg(&mut args, "--timeout-ms")?;
        let milliseconds = value.parse::<u64>().map_err(|error| {
          usage_error(format!("--timeout-ms expects an integer value: {error}"))
        })?;
        timeout = Duration::from_millis(milliseconds);
      }
      "--initial-data-json" => {
        initial_data_json = next_arg(&mut args, "--initial-data-json")?;
      }
      "--global-props-json" => {
        global_props_json = next_arg(&mut args, "--global-props-json")?;
      }
      "--native-ui-loop" => {
        native_ui_loop = true;
      }
      "--help" | "-h" => return Ok(None),
      _ => return Err(usage_error(format!("unknown argument: {arg}"))),
    }
  }

  let bundle = bundle.ok_or_else(|| usage_error("missing required --bundle"))?;
  Ok(Some(Options {
    bundle,
    screenshot,
    asset_roots,
    preload_js_paths,
    timeout,
    initial_data_json,
    global_props_json,
    native_ui_loop,
  }))
}

fn next_arg(args: &mut impl Iterator<Item = String>, flag: &'static str) -> lynx::Result<String> {
  args
    .next()
    .ok_or_else(|| usage_error(format!("{flag} requires a value")))
}

fn usage_error(message: impl AsRef<str>) -> lynx::Error {
  lynx::Error::Message(format!("{}\n\n{USAGE}", message.as_ref()))
}

fn default_global_props_json() -> String {
  format!(
    concat!(
      r#"{{"initialPage":"home","platform":"{}","#,
      r#""screenWidth":{},"screenHeight":{},"theme":"light","#,
      r#""frontendTheme":"light","preferredTheme":"light","#,
      r#""safeAreaTop":0,"safeAreaBottom":0,"safeAreaLeft":0,"safeAreaRight":0}}"#
    ),
    env::consts::OS,
    DEFAULT_WIDTH as u32,
    DEFAULT_HEIGHT as u32
  )
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn resource_path_from_url_accepts_supported_schemes() {
    assert_eq!(
      resource_path_from_url("assets://images/icon.png"),
      Some(PathBuf::from("images/icon.png"))
    );
    assert_eq!(
      resource_path_from_url("local://fonts/app.ttf"),
      Some(PathBuf::from("fonts/app.ttf"))
    );
    assert_eq!(
      resource_path_from_url("file://lynx?lynx_core.js"),
      Some(PathBuf::from("lynx_core.js"))
    );
  }

  #[test]
  fn resource_path_from_url_rejects_paths_outside_roots() {
    assert_eq!(resource_path_from_url("assets://../secret.txt"), None);
    assert_eq!(resource_path_from_url(""), None);
  }

  #[test]
  fn directory_resource_fetcher_reports_specific_errors() {
    let root = env::temp_dir().join(format!("lynx-headless-fetcher-test-{}", std::process::id()));
    let _ = fs::remove_dir_all(&root);
    fs::create_dir_all(&root).expect("create resource test root");
    fs::write(root.join("asset.txt"), b"ok").expect("write resource fixture");

    let mut fetcher = DirectoryResourceFetcher::new(vec![root.clone()]);
    assert_eq!(
      fetcher.fetch(ResourceRequest {
        id: 1,
        url: "assets://asset.txt".into(),
        resource_type: lynx::ResourceType::Assets,
      }),
      FetchResponse::ok(b"ok".to_vec())
    );
    assert_eq!(
      fetcher
        .fetch(ResourceRequest {
          id: 2,
          url: "assets://missing.txt".into(),
          resource_type: lynx::ResourceType::Assets,
        })
        .error_message
        .as_deref(),
      Some("resource not found: assets://missing.txt")
    );
    assert_eq!(
      fetcher
        .fetch(ResourceRequest {
          id: 3,
          url: "assets://../secret.txt".into(),
          resource_type: lynx::ResourceType::Assets,
        })
        .error_message
        .as_deref(),
      Some("resource URL is not a relative file path: assets://../secret.txt")
    );

    let _ = fs::remove_dir_all(root);
  }
}
