use lynx::{
  run_global_ui_task, sys, Env, HeadlessView, SoftwareFrame, SoftwareRenderer, Task,
  WindowlessHost, WindowlessRenderer,
};
#[cfg(not(target_os = "macos"))]
use lynx::{set_global_ui_task_runner, GlobalUiTaskRunner};
use std::collections::HashMap;
#[cfg(target_os = "macos")]
use std::ffi::c_void;
use std::ffi::{c_char, CStr};
use std::fs::{self, File};
use std::io::{BufWriter, Error as IoError, ErrorKind};
use std::path::{Path, PathBuf};
use std::ptr;
use std::sync::{Arc, Mutex};
#[cfg(not(target_os = "macos"))]
use std::thread;
#[cfg(not(target_os = "macos"))]
use std::thread::ThreadId;
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
mod macos_headless_display;

const VIEWPORT_WIDTH: usize = 800;
const VIEWPORT_HEIGHT: usize = 600;
const DEVICE_PIXEL_RATIO: f32 = 1.0;
const FIXTURE_TIMEOUT: Duration = Duration::from_secs(30);

pub struct RunReport {
  pub width: usize,
  pub height: usize,
  pub visible_pixels: usize,
  pub white_pixels: usize,
  pub gradient_pixels: usize,
  pub logo_pixels: usize,
  pub arrow_pixels: usize,
  pub screenshot_path: PathBuf,
}

pub fn run_react_fixture() -> Result<RunReport, Box<dyn std::error::Error>> {
  install_headless_display_link_if_needed();
  let fixture = ReactFixture::new();
  install_lynx_core_resource(&fixture)?;
  let env = Env::load()?;
  set_icu_data_path_if_available(&env)?;

  let renderer_tasks = SharedTasks::new();
  let global_tasks = SharedTasks::new();
  install_global_ui_task_runner_if_needed(&env, global_tasks.clone())?;

  let frame_slot = Arc::new(Mutex::new(None));
  let renderer = create_renderer(&env, frame_slot.clone(), renderer_tasks.clone())?;

  let view = HeadlessView::builder(env.clone(), renderer)
    .viewport(
      VIEWPORT_WIDTH as f32,
      VIEWPORT_HEIGHT as f32,
      DEVICE_PIXEL_RATIO,
    )
    .build()?;
  let lifecycle_client = LifecycleClient::new(&env)?;
  let _lifecycle_registration = lifecycle_client.register(&view);

  view.enter_foreground();
  let bundle = fs::read(&fixture.bundle_path)?;
  view.load_template_bytes_with_global_props(
    "assets://main.lynx.bundle",
    &bundle,
    Some("{}"),
    Some(&default_global_props_json()),
  )?;
  view.enter_foreground();

  let expectation = ScreenshotExpectation::react_fixture();
  let frame = wait_for_frame(
    &env,
    &view,
    &renderer_tasks,
    &global_tasks,
    &lifecycle_client,
    &expectation,
    &frame_slot,
    FIXTURE_TIMEOUT,
  )?;
  let screenshot_path = default_screenshot_path();
  write_png(&screenshot_path, &frame)?;
  let stats = expectation.assert_matches(&frame).map_err(|error| {
    let stats = screenshot_stats(&frame);
    format!(
      "{error}; {}; stats={stats:?}; screenshot={}; lifecycle={:?}",
      missing_image_hint(&stats),
      screenshot_path.display(),
      lifecycle_client.snapshot()
    )
  })?;

  Ok(RunReport {
    width: frame.width,
    height: frame.height,
    visible_pixels: stats.visible_pixels,
    white_pixels: stats.white_pixels,
    gradient_pixels: stats.gradient_pixels,
    logo_pixels: stats.logo_pixels,
    arrow_pixels: stats.arrow_pixels,
    screenshot_path,
  })
}

#[cfg(target_os = "macos")]
fn install_headless_display_link_if_needed() {
  macos_headless_display::install_if_needed();
}

#[cfg(not(target_os = "macos"))]
fn install_headless_display_link_if_needed() {}

fn create_renderer(
  env: &Env,
  frame_slot: Arc<Mutex<Option<CapturedFrame>>>,
  renderer_tasks: SharedTasks,
) -> Result<WindowlessRenderer, Box<dyn std::error::Error>> {
  Ok(WindowlessRenderer::software(
    env,
    FrameSink { latest: frame_slot },
    QueueingHost {
      tasks: renderer_tasks,
    },
  )?)
}

#[cfg(target_os = "macos")]
fn install_global_ui_task_runner_if_needed(
  _env: &Env,
  _global_tasks: SharedTasks,
) -> Result<(), Box<dyn std::error::Error>> {
  Ok(())
}

#[cfg(not(target_os = "macos"))]
fn install_global_ui_task_runner_if_needed(
  env: &Env,
  global_tasks: SharedTasks,
) -> Result<(), Box<dyn std::error::Error>> {
  let global_runner_set = set_global_ui_task_runner(
    env,
    QueueingGlobalRunner {
      tasks: global_tasks,
      thread_id: thread::current().id(),
    },
  )?;
  if !global_runner_set {
    return Err("failed to register Lynx global UI task runner".into());
  }
  Ok(())
}

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

  #[cfg(not(target_os = "macos"))]
  fn push_ready(&self, task: Task) {
    self.push(task, Duration::ZERO);
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

  fn len(&self) -> usize {
    self.queue.lock().expect("task queue lock poisoned").len()
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

#[cfg(not(target_os = "macos"))]
struct QueueingGlobalRunner {
  tasks: SharedTasks,
  thread_id: ThreadId,
}

#[cfg(not(target_os = "macos"))]
impl GlobalUiTaskRunner for QueueingGlobalRunner {
  fn runs_on_current_thread(&mut self) -> bool {
    thread::current().id() == self.thread_id
  }

  fn post_task(&mut self, task: Task, _target_time_nanos: u64) {
    self.tasks.push_ready(task);
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

struct LifecycleClient {
  sys: Arc<sys::LoadedLibrary>,
  raw: *mut sys::lynx_view_client_t,
}

struct LifecycleRegistration<'a> {
  view: &'a HeadlessView,
  client: *mut sys::lynx_view_client_t,
}

#[derive(Clone, Debug, Default)]
struct LifecycleSnapshot {
  page_starts: usize,
  load_successes: usize,
  first_screens: usize,
  page_updates: usize,
  data_updates: usize,
  runtime_ready: usize,
  frame_timings: usize,
  errors: Vec<String>,
}

#[derive(Default)]
struct LifecycleState {
  snapshot: LifecycleSnapshot,
}

impl LifecycleClient {
  fn new(env: &Env) -> Result<Self, Box<dyn std::error::Error>> {
    let sys = env.sys().clone();
    let raw = unsafe { (sys.lynx_view_client_create)(ptr::null_mut()) };
    if raw.is_null() {
      return Err("failed to create Lynx view client".into());
    }

    let state = Arc::new(Mutex::new(LifecycleState::default()));
    lifecycle_states()
      .lock()
      .expect("lifecycle state map lock poisoned")
      .insert(raw as usize, state);

    unsafe {
      (sys.lynx_view_client_bind_on_page_start)(raw, Some(on_page_start));
      (sys.lynx_view_client_bind_on_load_success)(raw, Some(on_load_success));
      (sys.lynx_view_client_bind_on_first_screen)(raw, Some(on_first_screen));
      (sys.lynx_view_client_bind_on_page_updated)(raw, Some(on_page_updated));
      (sys.lynx_view_client_bind_on_data_updated)(raw, Some(on_data_updated));
      (sys.lynx_view_client_bind_on_runtime_ready)(raw, Some(on_runtime_ready));
      (sys.lynx_view_client_bind_on_received_error)(raw, Some(on_received_error));
      (sys.lynx_view_client_bind_on_frame_timing)(raw, Some(on_frame_timing));
    }

    Ok(Self { sys, raw })
  }

  fn register<'a>(&self, view: &'a HeadlessView) -> LifecycleRegistration<'a> {
    unsafe {
      view.add_client_raw(self.raw);
    }
    LifecycleRegistration {
      view,
      client: self.raw,
    }
  }

  fn snapshot(&self) -> LifecycleSnapshot {
    lifecycle_state(self.raw)
      .map(|state| {
        state
          .lock()
          .expect("lifecycle state lock poisoned")
          .snapshot
          .clone()
      })
      .unwrap_or_default()
  }
}

impl Drop for LifecycleRegistration<'_> {
  fn drop(&mut self) {
    unsafe {
      self.view.remove_client_raw(self.client);
    }
  }
}

impl Drop for LifecycleClient {
  fn drop(&mut self) {
    if !self.raw.is_null() {
      lifecycle_states()
        .lock()
        .expect("lifecycle state map lock poisoned")
        .remove(&(self.raw as usize));
      unsafe {
        (self.sys.lynx_view_client_release)(self.raw);
      }
      self.raw = ptr::null_mut();
    }
  }
}

fn lifecycle_states() -> &'static Mutex<HashMap<usize, Arc<Mutex<LifecycleState>>>> {
  static STATES: std::sync::OnceLock<Mutex<HashMap<usize, Arc<Mutex<LifecycleState>>>>> =
    std::sync::OnceLock::new();
  STATES.get_or_init(|| Mutex::new(HashMap::new()))
}

fn lifecycle_state(client: *mut sys::lynx_view_client_t) -> Option<Arc<Mutex<LifecycleState>>> {
  lifecycle_states()
    .lock()
    .expect("lifecycle state map lock poisoned")
    .get(&(client as usize))
    .cloned()
}

fn update_lifecycle(
  client: *mut sys::lynx_view_client_t,
  update: impl FnOnce(&mut LifecycleSnapshot),
) {
  let Some(state) = lifecycle_state(client) else {
    return;
  };
  let mut state = state.lock().expect("lifecycle state lock poisoned");
  update(&mut state.snapshot);
}

unsafe extern "C" fn on_page_start(client: *mut sys::lynx_view_client_t, _url: *const c_char) {
  update_lifecycle(client, |snapshot| snapshot.page_starts += 1);
}

unsafe extern "C" fn on_load_success(client: *mut sys::lynx_view_client_t) {
  update_lifecycle(client, |snapshot| snapshot.load_successes += 1);
}

unsafe extern "C" fn on_first_screen(client: *mut sys::lynx_view_client_t) {
  update_lifecycle(client, |snapshot| snapshot.first_screens += 1);
}

unsafe extern "C" fn on_page_updated(client: *mut sys::lynx_view_client_t) {
  update_lifecycle(client, |snapshot| snapshot.page_updates += 1);
}

unsafe extern "C" fn on_data_updated(client: *mut sys::lynx_view_client_t) {
  update_lifecycle(client, |snapshot| snapshot.data_updates += 1);
}

unsafe extern "C" fn on_runtime_ready(client: *mut sys::lynx_view_client_t) {
  update_lifecycle(client, |snapshot| snapshot.runtime_ready += 1);
}

unsafe extern "C" fn on_received_error(
  client: *mut sys::lynx_view_client_t,
  error_code: i32,
  message: *const c_char,
) {
  let message = unsafe { c_char_to_string(message) };
  update_lifecycle(client, |snapshot| {
    snapshot.errors.push(format!("{error_code}: {message}"));
  });
}

unsafe extern "C" fn on_frame_timing(
  client: *mut sys::lynx_view_client_t,
  _frame_start_time_in_ns: i64,
  _frame_finish_time_in_ns: i64,
) {
  update_lifecycle(client, |snapshot| snapshot.frame_timings += 1);
}

unsafe fn c_char_to_string(value: *const c_char) -> String {
  if value.is_null() {
    String::new()
  } else {
    unsafe { CStr::from_ptr(value) }
      .to_string_lossy()
      .into_owned()
  }
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
    *self.latest.lock().expect("frame lock poisoned") = Some(CapturedFrame {
      width,
      height,
      rgba: bytes.to_vec(),
    });
    true
  }
}

struct ScreenshotExpectation {
  width: usize,
  height: usize,
  min_visible_pixels: usize,
  min_white_pixels: usize,
  min_gradient_pixels: usize,
  min_logo_pixels: usize,
  min_arrow_pixels: usize,
}

#[derive(Debug)]
struct ScreenshotStats {
  visible_pixels: usize,
  white_pixels: usize,
  gradient_pixels: usize,
  logo_pixels: usize,
  arrow_pixels: usize,
}

impl ScreenshotExpectation {
  fn react_fixture() -> Self {
    // Derived from packages/genui/ui-judge/tests/fixtures/react/src/App.{jsx,css}.
    Self {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      min_visible_pixels: 450_000,
      min_white_pixels: 1_500,
      min_gradient_pixels: 50_000,
      min_logo_pixels: 500,
      min_arrow_pixels: 100,
    }
  }

  fn assert_matches(
    &self,
    frame: &CapturedFrame,
  ) -> Result<ScreenshotStats, Box<dyn std::error::Error>> {
    if frame.width != self.width || frame.height != self.height {
      return Err(
        format!(
          "expected {}x{} React fixture frame, got {}x{}",
          self.width, self.height, frame.width, frame.height
        )
        .into(),
      );
    }

    let stats = screenshot_stats(frame);
    if stats.visible_pixels < self.min_visible_pixels {
      return Err(
        format!(
          "React fixture frame has too few visible pixels: expected at least {}, got {}",
          self.min_visible_pixels, stats.visible_pixels
        )
        .into(),
      );
    }
    if stats.white_pixels < self.min_white_pixels {
      return Err(format!(
        "React fixture frame is missing expected white title/text pixels: expected at least {}, got {}",
        self.min_white_pixels, stats.white_pixels
      )
      .into());
    }
    if stats.gradient_pixels < self.min_gradient_pixels {
      return Err(format!(
        "React fixture frame is missing expected purple/magenta radial-gradient pixels: expected at least {}, got {}",
        self.min_gradient_pixels, stats.gradient_pixels
      )
      .into());
    }
    if stats.logo_pixels < self.min_logo_pixels {
      return Err(
        format!(
          "React fixture frame is missing expected logo image pixels: expected at least {}, got {}",
          self.min_logo_pixels, stats.logo_pixels
        )
        .into(),
      );
    }
    if stats.arrow_pixels < self.min_arrow_pixels {
      return Err(
        format!(
        "React fixture frame is missing expected colored arrow image pixels: expected at least {}, got {}",
        self.min_arrow_pixels, stats.arrow_pixels
      )
        .into(),
      );
    }
    Ok(stats)
  }
}

fn screenshot_stats(frame: &CapturedFrame) -> ScreenshotStats {
  let mut visible_pixels = 0;
  let mut white_pixels = 0;
  let mut gradient_pixels = 0;
  let mut logo_pixels = 0;
  let mut arrow_pixels = 0;
  for (index, pixel) in frame.rgba.chunks_exact(4).enumerate() {
    let [red, green, blue, alpha] = [pixel[0], pixel[1], pixel[2], pixel[3]];
    if alpha != 0 {
      visible_pixels += 1;
      if red > 220 && green > 220 && blue > 220 {
        white_pixels += 1;
      }
      if red > 45 && blue > 45 && green < 130 && red.max(blue) > green + 15 {
        gradient_pixels += 1;
      }
    }

    let x = index % frame.width;
    let y = index / frame.width;
    if (330..470).contains(&x)
      && (95..235).contains(&y)
      && alpha > 0
      && is_saturated_image_pixel(red, green, blue)
    {
      logo_pixels += 1;
    }
    if (370..430).contains(&x)
      && (385..445).contains(&y)
      && alpha > 0
      && is_saturated_image_pixel(red, green, blue)
    {
      arrow_pixels += 1;
    }
  }
  ScreenshotStats {
    visible_pixels,
    white_pixels,
    gradient_pixels,
    logo_pixels,
    arrow_pixels,
  }
}

fn is_saturated_image_pixel(red: u8, green: u8, blue: u8) -> bool {
  let max_channel = red.max(green).max(blue);
  let min_channel = red.min(green).min(blue);
  max_channel > 80 && max_channel.saturating_sub(min_channel) > 50
}

fn missing_image_hint(stats: &ScreenshotStats) -> &'static str {
  if stats.gradient_pixels > 0
    && stats.white_pixels > 0
    && (stats.logo_pixels == 0 || stats.arrow_pixels == 0)
  {
    "background/text rendered but inline image pixels are absent; verify the native headless runtime disables the image texture backend for kRendererTypeSoftware"
  } else {
    "rendered frame did not match expected fixture signals"
  }
}

fn wait_for_frame(
  env: &Env,
  view: &HeadlessView,
  renderer_tasks: &SharedTasks,
  global_tasks: &SharedTasks,
  lifecycle_client: &LifecycleClient,
  expectation: &ScreenshotExpectation,
  frame_slot: &Arc<Mutex<Option<CapturedFrame>>>,
  timeout: Duration,
) -> Result<CapturedFrame, Box<dyn std::error::Error>> {
  let deadline = Instant::now() + timeout;
  let mut renderer_tasks_run = 0usize;
  let mut global_tasks_run = 0usize;
  let mut requested_initial_frame = false;
  let mut latest_frame = None;
  let mut latest_mismatch = None;
  while Instant::now() < deadline {
    let mut ran_task = false;
    if !requested_initial_frame {
      view.set_frame(0.0, 0.0, VIEWPORT_WIDTH as f32, VIEWPORT_HEIGHT as f32);
      requested_initial_frame = true;
    }
    for task in renderer_tasks.drain_ready() {
      view.renderer().run_task(task);
      renderer_tasks_run += 1;
      ran_task = true;
    }
    for task in global_tasks.drain_ready() {
      run_global_ui_task(env, task);
      global_tasks_run += 1;
      ran_task = true;
    }
    if let Some(frame) = frame_slot.lock().expect("frame lock poisoned").take() {
      if frame.visible_pixel_count() > 0 {
        match expectation.assert_matches(&frame) {
          Ok(_) => return Ok(frame),
          Err(mismatch) => {
            latest_mismatch = Some(mismatch);
            latest_frame = Some(frame);
          }
        }
      }
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
      pump_platform_events(sleep_for);
    }
  }

  if let Some(frame) = latest_frame {
    return Ok(frame);
  }

  let lifecycle = lifecycle_client.snapshot();
  let now = Instant::now();
  let renderer_pending = renderer_tasks.len();
  let global_pending = global_tasks.len();
  let renderer_next_ms = renderer_tasks
    .next_deadline()
    .and_then(|deadline| deadline.checked_duration_since(now))
    .map(|duration| duration.as_millis());
  let global_next_ms = global_tasks
    .next_deadline()
    .and_then(|deadline| deadline.checked_duration_since(now))
    .map(|duration| duration.as_millis());
  Err(
    format!(
      "timed out waiting for rendered frame; renderer_tasks_run={renderer_tasks_run} global_tasks_run={global_tasks_run} renderer_pending={renderer_pending} renderer_next_ms={renderer_next_ms:?} global_pending={global_pending} global_next_ms={global_next_ms:?} lifecycle={lifecycle:?} latest_mismatch={latest_mismatch:?}"
    )
    .into(),
  )
}

#[cfg(target_os = "macos")]
fn pump_platform_events(duration: Duration) {
  unsafe {
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, duration.as_secs_f64(), true);
  }
}

#[cfg(not(target_os = "macos"))]
fn pump_platform_events(duration: Duration) {
  thread::sleep(duration);
}

#[cfg(target_os = "macos")]
type CFStringRef = *const c_void;

#[cfg(target_os = "macos")]
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
  static kCFRunLoopDefaultMode: CFStringRef;
  fn CFRunLoopRunInMode(mode: CFStringRef, seconds: f64, return_after_source_handled: bool) -> i32;
}

struct ReactFixture {
  bundle_path: PathBuf,
  lynx_core_path: PathBuf,
}

impl ReactFixture {
  fn new() -> Self {
    let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let repo_root = crate_dir.join("../../..");
    let dist_dir = repo_root.join("packages/genui/ui-judge/tests/fixtures/react/.generated");
    Self {
      bundle_path: dist_dir.join("main.lynx.bundle"),
      lynx_core_path: crate_dir.join("fixtures/react/lynx_core.js"),
    }
  }
}

fn default_global_props_json() -> String {
  serde_json::json!({
    "initialPage": "home",
    "platform": std::env::consts::OS,
    "screenWidth": VIEWPORT_WIDTH,
    "screenHeight": VIEWPORT_HEIGHT,
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

fn set_icu_data_path_if_available(env: &Env) -> Result<(), Box<dyn std::error::Error>> {
  let Some(sdk_dir) = std::env::var_os("LYNX_SDK_DIR") else {
    return Ok(());
  };
  let icu_path = PathBuf::from(sdk_dir).join("data/icudtl.dat");
  if icu_path.is_file() {
    env.set_icu_data_path(
      icu_path
        .to_str()
        .ok_or("ICU data path is not valid UTF-8")?,
    )?;
  }
  Ok(())
}

fn install_lynx_core_resource(fixture: &ReactFixture) -> Result<(), Box<dyn std::error::Error>> {
  let exe_path = std::env::current_exe()?;
  let exe_dir = exe_path
    .parent()
    .ok_or("current executable path has no parent")?;
  if cfg!(target_os = "macos") {
    copy_lynx_core_to(
      &fixture.lynx_core_path,
      &exe_dir.join("LynxResources.bundle"),
    )?;
  } else {
    fs::copy(&fixture.lynx_core_path, exe_dir.join("lynx_core.js"))?;
  }
  Ok(())
}

fn copy_lynx_core_to(source: &Path, bundle_dir: &Path) -> Result<(), Box<dyn std::error::Error>> {
  fs::create_dir_all(bundle_dir)?;
  fs::copy(source, bundle_dir.join("lynx_core.js"))?;
  Ok(())
}

fn default_screenshot_path() -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("../../../target/headless-rust-test-runner/react-fixture.png")
}

fn write_png(path: &Path, frame: &CapturedFrame) -> Result<(), Box<dyn std::error::Error>> {
  if let Some(parent) = path.parent() {
    fs::create_dir_all(parent)?;
  }
  let expected_len = frame
    .width
    .checked_mul(frame.height)
    .and_then(|pixels| pixels.checked_mul(4))
    .ok_or_else(|| IoError::new(ErrorKind::InvalidInput, "frame is too large"))?;
  if frame.rgba.len() < expected_len {
    return Err(IoError::new(ErrorKind::InvalidInput, "frame is smaller than expected").into());
  }

  let file = File::create(path)?;
  let writer = BufWriter::new(file);
  let mut encoder = png::Encoder::new(writer, frame.width as u32, frame.height as u32);
  encoder.set_color(png::ColorType::Rgba);
  encoder.set_depth(png::BitDepth::Eight);
  let mut png_writer = encoder.write_header()?;
  png_writer.write_image_data(&frame.rgba[..expected_len])?;
  Ok(())
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn default_global_props_match_fixture_viewport() {
    let props = default_global_props_json();
    assert!(props.contains("\"screenWidth\":800"));
    assert!(props.contains("\"screenHeight\":600"));
    assert!(props.contains("\"theme\":\"light\""));
  }
}
