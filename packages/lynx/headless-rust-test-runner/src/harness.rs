use std::sync::{Arc, Mutex, OnceLock};
#[cfg(not(target_os = "macos"))]
use std::thread::{self, ThreadId};
use std::time::{Duration, Instant};

use lynx::{
  run_global_ui_task, Env, HeadlessView, SoftwareFrame, SoftwareRenderer, Task, WindowlessHost,
};
#[cfg(not(target_os = "macos"))]
use lynx::{set_global_ui_task_runner, GlobalUiTaskRunner};

use crate::{Error, Result};

#[cfg(target_os = "macos")]
#[path = "macos_headless_display.rs"]
mod macos_headless_display;

#[derive(Clone)]
pub(crate) struct SharedTasks {
  queue: Arc<Mutex<Vec<ScheduledTask>>>,
}

struct ScheduledTask {
  task: Task,
  deadline: Instant,
}

impl SharedTasks {
  pub(crate) fn new() -> Self {
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
}

pub(crate) struct QueueingHost {
  tasks: SharedTasks,
}

impl QueueingHost {
  pub(crate) fn new(tasks: SharedTasks) -> Self {
    Self { tasks }
  }
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

pub(crate) fn initialize_platform(env: &Env) -> Result<SharedTasks> {
  install_headless_display_link_if_needed();
  static GLOBAL_TASKS: OnceLock<SharedTasks> = OnceLock::new();
  if let Some(tasks) = GLOBAL_TASKS.get() {
    return Ok(tasks.clone());
  }

  let tasks = SharedTasks::new();
  install_global_ui_task_runner_if_needed(env, tasks.clone())?;
  let _ = GLOBAL_TASKS.set(tasks.clone());
  Ok(GLOBAL_TASKS.get().cloned().unwrap_or(tasks))
}

#[cfg(target_os = "macos")]
fn install_headless_display_link_if_needed() {
  macos_headless_display::install_if_needed();
}

#[cfg(not(target_os = "macos"))]
fn install_headless_display_link_if_needed() {}

#[cfg(target_os = "macos")]
fn install_global_ui_task_runner_if_needed(_env: &Env, _tasks: SharedTasks) -> Result<()> {
  Ok(())
}

#[cfg(not(target_os = "macos"))]
fn install_global_ui_task_runner_if_needed(env: &Env, tasks: SharedTasks) -> Result<()> {
  let installed = set_global_ui_task_runner(
    env,
    QueueingGlobalRunner {
      tasks,
      thread_id: thread::current().id(),
    },
  )?;
  if !installed {
    return Err(Error::Protocol(
      "failed to register Lynx global UI task runner".into(),
    ));
  }
  Ok(())
}

#[derive(Clone, Debug)]
pub(crate) struct CapturedFrame {
  pub width: usize,
  pub height: usize,
  pub rgba: Vec<u8>,
  pub sequence: u64,
}

#[derive(Default)]
struct FrameState {
  sequence: u64,
  latest: Option<CapturedFrame>,
}

#[derive(Clone, Default)]
pub(crate) struct FrameStore {
  state: Arc<Mutex<FrameState>>,
}

impl FrameStore {
  pub(crate) fn latest(&self) -> Option<CapturedFrame> {
    self
      .state
      .lock()
      .expect("frame store lock poisoned")
      .latest
      .clone()
  }

  pub(crate) fn sequence(&self) -> u64 {
    self
      .state
      .lock()
      .expect("frame store lock poisoned")
      .sequence
  }
}

impl SoftwareRenderer for FrameStore {
  fn present(&mut self, frame: SoftwareFrame) -> bool {
    let Some(bytes) = (unsafe { frame.bytes() }) else {
      return false;
    };
    if !frame.row_bytes.is_multiple_of(4) {
      return false;
    }
    let mut state = self.state.lock().expect("frame store lock poisoned");
    state.sequence += 1;
    state.latest = Some(CapturedFrame {
      width: frame.row_bytes / 4,
      height: frame.height,
      rgba: bytes.to_vec(),
      sequence: state.sequence,
    });
    true
  }
}

pub(crate) struct TaskPump {
  env: Env,
  renderer_tasks: SharedTasks,
  global_tasks: SharedTasks,
}

impl TaskPump {
  pub(crate) fn new(env: Env, renderer_tasks: SharedTasks, global_tasks: SharedTasks) -> Self {
    Self {
      env,
      renderer_tasks,
      global_tasks,
    }
  }

  pub(crate) async fn wait_for_frame(
    &self,
    view: &HeadlessView,
    frames: &FrameStore,
    after_sequence: u64,
    timeout: Duration,
  ) -> Result<CapturedFrame> {
    let deadline = Instant::now() + timeout;
    while Instant::now() < deadline {
      self.pump_once(view);
      if let Some(frame) = frames.latest() {
        if frame.sequence > after_sequence {
          return Ok(frame);
        }
      }
      tokio::time::sleep(Duration::from_millis(1)).await;
    }
    Err(Error::Timeout("waiting for a rendered frame".into()))
  }

  pub(crate) async fn pump_for(&self, view: &HeadlessView, duration: Duration) {
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline {
      self.pump_once(view);
      tokio::time::sleep(Duration::from_millis(1)).await;
    }
  }

  pub(crate) fn pump_once(&self, view: &HeadlessView) {
    let mut ran_task = false;
    for task in self.renderer_tasks.drain_ready() {
      view.renderer().run_task(task);
      ran_task = true;
    }
    for task in self.global_tasks.drain_ready() {
      run_global_ui_task(&self.env, task);
      ran_task = true;
    }
    if !ran_task {
      pump_platform_events();
    }
  }
}

#[cfg(target_os = "macos")]
fn pump_platform_events() {
  unsafe {
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, 0.001, true);
  }
}

#[cfg(not(target_os = "macos"))]
fn pump_platform_events() {}

#[cfg(target_os = "macos")]
type CFStringRef = *const std::ffi::c_void;

#[cfg(target_os = "macos")]
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
  static kCFRunLoopDefaultMode: CFStringRef;
  fn CFRunLoopRunInMode(mode: CFStringRef, seconds: f64, return_after_source_handled: bool) -> i32;
}
