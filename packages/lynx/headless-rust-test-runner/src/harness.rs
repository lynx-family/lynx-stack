use std::sync::{Arc, Mutex, OnceLock};
#[cfg(not(target_os = "macos"))]
use std::thread::{self, ThreadId};
use std::time::{Duration, Instant};

#[cfg(not(target_os = "macos"))]
use lynx::{run_global_ui_task, set_global_ui_task_runner, GlobalUiTaskRunner};
use lynx::{
  LynxEnv, LynxView, SoftwareFrame, SoftwareRenderer, Task, WindowlessHost, WindowlessRenderer,
};

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
    drain_ready_at(&mut queue, now)
  }
}

fn drain_ready_at(queue: &mut Vec<ScheduledTask>, now: Instant) -> Vec<Task> {
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

#[cfg(target_os = "macos")]
pub(crate) fn initialize_platform(_env: &LynxEnv) -> Result<SharedTasks> {
  static PLATFORM: OnceLock<SharedTasks> = OnceLock::new();
  Ok(
    PLATFORM
      .get_or_init(|| {
        macos_headless_display::install_if_needed();
        SharedTasks::new()
      })
      .clone(),
  )
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn initialize_platform(env: &LynxEnv) -> Result<SharedTasks> {
  static PLATFORM: OnceLock<std::result::Result<SharedTasks, String>> = OnceLock::new();
  match PLATFORM.get_or_init(|| {
    let tasks = SharedTasks::new();
    let installed = set_global_ui_task_runner(
      env,
      QueueingGlobalRunner {
        tasks: tasks.clone(),
        thread_id: thread::current().id(),
      },
    )
    .map_err(|error| error.to_string())?;
    if !installed {
      return Err("failed to register Lynx global UI task runner".into());
    }
    Ok(tasks)
  }) {
    Ok(tasks) => Ok(tasks.clone()),
    Err(message) => Err(Error::Protocol(message.clone())),
  }
}

#[derive(Clone, Debug)]
pub(crate) struct CapturedFrame {
  pub width: usize,
  pub height: usize,
  pub rgba: Arc<[u8]>,
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
      rgba: Arc::from(bytes),
      sequence: state.sequence,
    });
    true
  }
}

pub(crate) struct TaskPump {
  renderer_tasks: SharedTasks,
  #[cfg(not(target_os = "macos"))]
  global_tasks: SharedTasks,
  #[cfg(not(target_os = "macos"))]
  env: &'static LynxEnv,
}

impl TaskPump {
  pub(crate) fn new(
    env: &'static LynxEnv,
    renderer_tasks: SharedTasks,
    global_tasks: SharedTasks,
  ) -> Self {
    #[cfg(target_os = "macos")]
    {
      let _ = (env, global_tasks);
      Self { renderer_tasks }
    }
    #[cfg(not(target_os = "macos"))]
    {
      Self {
        renderer_tasks,
        global_tasks,
        env,
      }
    }
  }

  pub(crate) async fn wait_for_frame(
    &self,
    view: &LynxView,
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

  pub(crate) async fn pump_for(&self, view: &LynxView, duration: Duration) {
    let deadline = Instant::now() + duration;
    while Instant::now() < deadline {
      self.pump_once(view);
      tokio::time::sleep(Duration::from_millis(1)).await;
    }
  }

  pub(crate) fn pump_once(&self, view: &LynxView) {
    let ran_renderer_task = self.run_renderer_tasks(view.renderer());
    #[cfg(target_os = "macos")]
    let ran_task = ran_renderer_task;
    #[cfg(not(target_os = "macos"))]
    let ran_task = {
      let mut ran_task = ran_renderer_task;
      for task in self.global_tasks.drain_ready() {
        run_global_ui_task(&self.env, task);
        ran_task = true;
      }
      ran_task
    };
    let max_wait = if ran_task {
      Duration::ZERO
    } else {
      Duration::from_millis(1)
    };
    let _ = pump_platform_events(max_wait);
  }

  fn run_renderer_tasks(&self, renderer: &WindowlessRenderer) -> bool {
    let mut ran_task = false;
    for task in self.renderer_tasks.drain_ready() {
      renderer.run_task(task);
      ran_task = true;
    }
    ran_task
  }
}

#[cfg(target_os = "macos")]
fn pump_platform_events(max_wait: Duration) -> bool {
  const RUN_HANDLED_SOURCE: i32 = 4;
  unsafe {
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, max_wait.as_secs_f64(), true) == RUN_HANDLED_SOURCE
  }
}

#[cfg(not(target_os = "macos"))]
fn pump_platform_events(_max_wait: Duration) -> bool {
  false
}

#[cfg(target_os = "macos")]
type CFStringRef = *const std::ffi::c_void;

#[cfg(target_os = "macos")]
#[link(name = "CoreFoundation", kind = "framework")]
unsafe extern "C" {
  static kCFRunLoopDefaultMode: CFStringRef;
  fn CFRunLoopRunInMode(mode: CFStringRef, seconds: f64, return_after_source_handled: bool) -> i32;
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_send_sync<T: Send + Sync>() {}

  #[test]
  fn captured_frames_can_cross_encoder_threads() {
    assert_send_sync::<CapturedFrame>();
    assert_send_sync::<FrameStore>();
  }
}
