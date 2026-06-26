use lynx::{
  run_global_ui_task, set_global_ui_task_runner, Env, FetchResponse, GlobalUiTaskRunner,
  HeadlessView, ResourceFetcher, ResourceRequest, SoftwareFrame, SoftwareRenderer, Task,
  WindowlessHost, WindowlessRenderer,
};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
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
  timeout: Duration,
  initial_data_json: String,
  global_props_json: String,
}

fn main() -> lynx::Result<()> {
  let options = parse_options();
  let env = Env::load()?;
  if let Ok(sdk_dir) = env::var("LYNX_SDK_DIR") {
    for relative in ["data/icudtl.dat", "icudtl.dat"] {
      let icu_path = Path::new(&sdk_dir).join(relative);
      if icu_path.is_file() {
        env.set_icu_data_path(icu_path.to_string_lossy().as_ref())?;
        break;
      }
    }
  }
  println!("Lynx SDK version: {}", env.sdk_version());

  let renderer_tasks = SharedTasks::new();
  let global_tasks = SharedTasks::new();
  let global_runner_set = set_global_ui_task_runner(
    &env,
    QueueingGlobalRunner {
      tasks: global_tasks.clone(),
      thread_id: thread::current().id(),
    },
  )?;
  println!("global UI task runner set: {global_runner_set}");

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
  let view = HeadlessView::builder(env.clone(), renderer)
    .viewport(DEFAULT_WIDTH, DEFAULT_HEIGHT, DEFAULT_DPR)
    .resource_fetcher(DirectoryResourceFetcher::new(roots))?
    .build()?;
  view.enter_foreground();

  let bundle = fs::read(&options.bundle).map_err(|source| lynx::Error::Io {
    operation: "read bundle",
    path: options.bundle.clone(),
    source,
  })?;
  view.load_template_bytes_with_global_props(
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
      thread::sleep(sleep_for);
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

fn parse_options() -> Options {
  let mut bundle = env::var_os("LYNX_E2E_BUNDLE").map(PathBuf::from);
  let mut screenshot = env::var_os("LYNX_E2E_SCREENSHOT")
    .map(PathBuf::from)
    .unwrap_or_else(|| env::temp_dir().join("lynx-headless-e2e.png"));
  let mut asset_roots = Vec::new();
  let mut timeout = Duration::from_secs(10);
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
    timeout,
    initial_data_json,
    global_props_json,
  }
}

fn write_png(path: &Path, width: usize, height: usize, rgba: &[u8]) -> std::io::Result<()> {
  let expected = width
    .checked_mul(height)
    .and_then(|pixels| pixels.checked_mul(4))
    .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "image too large"))?;
  if rgba.len() < expected {
    return Err(std::io::Error::new(
      std::io::ErrorKind::InvalidInput,
      "frame is smaller than expected",
    ));
  }

  let mut scanlines = Vec::with_capacity(height * (width * 4 + 1));
  for row in 0..height {
    scanlines.push(0);
    let start = row * width * 4;
    scanlines.extend_from_slice(&rgba[start..start + width * 4]);
  }

  let mut png = Vec::new();
  png.extend_from_slice(b"\x89PNG\r\n\x1a\n");

  let mut ihdr = Vec::with_capacity(13);
  ihdr.extend_from_slice(&(width as u32).to_be_bytes());
  ihdr.extend_from_slice(&(height as u32).to_be_bytes());
  ihdr.extend_from_slice(&[8, 6, 0, 0, 0]);
  write_chunk(&mut png, b"IHDR", &ihdr);
  write_chunk(&mut png, b"IDAT", &zlib_store(&scanlines));
  write_chunk(&mut png, b"IEND", &[]);

  fs::write(path, png)
}

fn zlib_store(data: &[u8]) -> Vec<u8> {
  let mut out = Vec::with_capacity(data.len() + data.len() / 65535 * 5 + 6);
  out.extend_from_slice(&[0x78, 0x01]);
  let mut remaining = data;
  while !remaining.is_empty() {
    let chunk_len = remaining.len().min(65_535);
    let final_block = chunk_len == remaining.len();
    out.push(if final_block { 1 } else { 0 });
    out.extend_from_slice(&(chunk_len as u16).to_le_bytes());
    out.extend_from_slice((!(chunk_len as u16)).to_le_bytes().as_slice());
    out.extend_from_slice(&remaining[..chunk_len]);
    remaining = &remaining[chunk_len..];
  }
  if data.is_empty() {
    out.extend_from_slice(&[1, 0, 0, 0xff, 0xff]);
  }
  out.extend_from_slice(&adler32(data).to_be_bytes());
  out
}

fn write_chunk(png: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
  png.extend_from_slice(&(data.len() as u32).to_be_bytes());
  png.extend_from_slice(kind);
  png.extend_from_slice(data);
  let mut crc_data = Vec::with_capacity(kind.len() + data.len());
  crc_data.extend_from_slice(kind);
  crc_data.extend_from_slice(data);
  png.extend_from_slice(&crc32(&crc_data).to_be_bytes());
}

fn adler32(data: &[u8]) -> u32 {
  const MOD: u32 = 65_521;
  let mut a = 1u32;
  let mut b = 0u32;
  for byte in data {
    a = (a + u32::from(*byte)) % MOD;
    b = (b + a) % MOD;
  }
  (b << 16) | a
}

fn crc32(data: &[u8]) -> u32 {
  let mut crc = 0xffff_ffffu32;
  for byte in data {
    crc ^= u32::from(*byte);
    for _ in 0..8 {
      let mask = 0u32.wrapping_sub(crc & 1);
      crc = (crc >> 1) ^ (0xedb8_8320 & mask);
    }
  }
  !crc
}
