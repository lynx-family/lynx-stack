//! Native task and frame plumbing shared by every [`crate::LynxContainer`].
//!
//! All containers in the process stay on one owner thread. Renderer tasks are
//! per page, while the runtime's process-wide UI task runner feeds one shared
//! queue that only that owner drains.

use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, ThreadId};
use std::time::{Duration, Instant};

#[cfg(not(target_os = "macos"))]
use lynx::{run_global_ui_task, set_global_ui_task_runner, GlobalUiTaskRunner};
use lynx::{LynxEnv, SoftwareFrame, SoftwareRenderer, Task, WindowlessHost};

use crate::{Error, Result};

#[cfg(target_os = "macos")]
#[path = "macos_headless_display.rs"]
mod macos_headless_display;

/// A queue of native tasks waiting for their owner thread.
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

  pub(crate) fn drain_ready(&self) -> Vec<Task> {
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

/// The windowless host that parks a page's renderer tasks until its container
/// pumps them.
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

static PROCESS_OWNER_THREAD: OnceLock<ThreadId> = OnceLock::new();

/// Threads exposed to native Lynx as UI owners.
///
/// The process-owner guard only permits one entry. This stays separate from
/// that guard so native runner registration keeps main's proven ordering and
/// callback behavior.
#[cfg(not(target_os = "macos"))]
static CONTAINER_THREADS: Mutex<Vec<ThreadId>> = Mutex::new(Vec::new());

/// Permanently binds native Lynx state to the first container thread.
///
/// The runtime has process-global state whose teardown can outlive a view, so
/// dropping the last container does not make it safe to transfer ownership.
pub(crate) fn claim_process_owner_thread() -> Result<()> {
  claim_owner_thread(&PROCESS_OWNER_THREAD)
}

fn claim_owner_thread(owner: &OnceLock<ThreadId>) -> Result<()> {
  let current = thread::current().id();
  let owner = owner.get_or_init(|| current);
  if *owner == current {
    Ok(())
  } else {
    Err(Error::ThreadAffinity {
      owner: format!("{owner:?}"),
      current: format!("{current:?}"),
    })
  }
}

#[cfg(not(target_os = "macos"))]
struct SharedGlobalRunner {
  tasks: SharedTasks,
}

#[cfg(not(target_os = "macos"))]
impl GlobalUiTaskRunner for SharedGlobalRunner {
  fn runs_on_current_thread(&mut self) -> bool {
    let current = thread::current().id();
    CONTAINER_THREADS
      .lock()
      .expect("container thread registry poisoned")
      .contains(&current)
  }

  fn post_task(&mut self, task: Task, _target_time_nanos: u64) {
    self.tasks.push(task, Duration::ZERO);
  }
}

/// Prepares the process for containers running on the owner thread.
///
/// Returns the queue of process-wide UI tasks the caller must drain. The
/// registration itself happens once; every later container reuses it on the
/// same owner thread.
#[cfg(not(target_os = "macos"))]
pub(crate) fn register_container_thread(env: &'static LynxEnv) -> Result<SharedTasks> {
  static PLATFORM: OnceLock<std::result::Result<SharedTasks, String>> = OnceLock::new();
  match PLATFORM.get_or_init(|| {
    let tasks = SharedTasks::new();
    let installed = set_global_ui_task_runner(
      env,
      SharedGlobalRunner {
        tasks: tasks.clone(),
      },
    )
    .map_err(|error| error.to_string())?;
    if !installed {
      return Err("failed to register Lynx global UI task runner".into());
    }
    Ok(tasks)
  }) {
    Ok(tasks) => {
      let current = thread::current().id();
      let mut threads = CONTAINER_THREADS
        .lock()
        .expect("container thread registry poisoned");
      if !threads.contains(&current) {
        threads.push(current);
      }
      Ok(tasks.clone())
    }
    Err(message) => Err(Error::Protocol(message.clone())),
  }
}

/// Prepares the process for a container running on the calling thread.
///
/// macOS drives windowless frames through the Rust-only fake display link, so
/// there is no global UI task queue to drain.
#[cfg(target_os = "macos")]
pub(crate) fn register_container_thread(_env: &'static LynxEnv) -> Result<SharedTasks> {
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

/// Runs the process-wide UI tasks that are ready on the owner thread.
#[cfg(not(target_os = "macos"))]
pub(crate) fn run_ready_global_tasks(env: &'static LynxEnv, tasks: &SharedTasks) -> bool {
  static RUNNING: Mutex<()> = Mutex::new(());
  let Ok(_guard) = RUNNING.try_lock() else {
    return false;
  };
  let mut ran_task = false;
  for task in tasks.drain_ready() {
    run_global_ui_task(env, task);
    ran_task = true;
  }
  ran_task
}

#[cfg(target_os = "macos")]
pub(crate) fn run_ready_global_tasks(_env: &'static LynxEnv, _tasks: &SharedTasks) -> bool {
  false
}

/// A presented software frame copied into owned storage once.
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

/// The presented-frame slot for one page.
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
    // Clay's software surface uses a build-specific native N32 layout. The
    // pinned Linux runtime exposes BGRA, while the pinned macOS runtime already
    // exposes RGBA. Keep the runner's public screenshot contract canonical.
    #[cfg(target_os = "linux")]
    let rgba = {
      let mut rgba = bytes.to_vec();
      for pixel in rgba.chunks_exact_mut(4) {
        pixel.swap(0, 2);
      }
      rgba
    };
    #[cfg(not(target_os = "linux"))]
    let rgba = bytes.to_vec();
    let mut state = self.state.lock().expect("frame store lock poisoned");
    state.sequence += 1;
    state.latest = Some(CapturedFrame {
      width: frame.row_bytes / 4,
      height: frame.height,
      rgba: Arc::from(rgba),
      sequence: state.sequence,
    });
    true
  }
}

/// Gives the platform run loop a chance to deliver native events.
#[cfg(target_os = "macos")]
pub(crate) fn pump_platform_events(max_wait: Duration) -> bool {
  const RUN_HANDLED_SOURCE: i32 = 4;
  unsafe {
    CFRunLoopRunInMode(kCFRunLoopDefaultMode, max_wait.as_secs_f64(), true) == RUN_HANDLED_SOURCE
  }
}

#[cfg(not(target_os = "macos"))]
pub(crate) fn pump_platform_events(max_wait: Duration) -> bool {
  if !max_wait.is_zero() {
    std::thread::sleep(max_wait);
  }
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
  fn captured_state_can_cross_post_capture_threads() {
    assert_send_sync::<CapturedFrame>();
    assert_send_sync::<FrameStore>();
    assert_send_sync::<SharedTasks>();
  }

  #[test]
  fn software_frames_are_normalized_to_rgba() {
    #[cfg(target_os = "linux")]
    let native_pixels: [u8; 8] = [
      0, 0, 255, 255, // red
      255, 0, 0, 255, // blue
    ];
    #[cfg(not(target_os = "linux"))]
    let native_pixels: [u8; 8] = [
      255, 0, 0, 255, // red
      0, 0, 255, 255, // blue
    ];
    let mut frames = FrameStore::default();
    assert!(frames.present(SoftwareFrame {
      allocation: native_pixels.as_ptr().cast(),
      row_bytes: native_pixels.len(),
      height: 1,
    }));

    let frame = frames.latest().expect("capture normalized frame");
    assert_eq!(frame.width, 2);
    assert_eq!(frame.height, 1);
    assert_eq!(frame.rgba.as_ref(), [255, 0, 0, 255, 0, 0, 255, 255]);
  }

  #[test]
  fn a_second_os_thread_cannot_claim_the_process_owner() {
    let owner = Arc::new(OnceLock::new());
    claim_owner_thread(&owner).expect("claim the first owner");
    claim_owner_thread(&owner).expect("reuse the owner on the same thread");
    let other_thread = std::thread::spawn({
      let owner = Arc::clone(&owner);
      move || claim_owner_thread(&owner)
    });

    let error = other_thread
      .join()
      .expect("the second thread should not panic")
      .expect_err("the second thread must be rejected");
    assert!(matches!(error, Error::ThreadAffinity { .. }));
  }

  #[test]
  fn only_tasks_past_their_deadline_are_drained() {
    let mut queue = Vec::new();
    let now = Instant::now();
    assert!(drain_ready_at(&mut queue, now).is_empty());
    queue.push(ScheduledTask {
      task: Task::from_raw(lynx::sys::lynx_task_t::default()),
      deadline: now + Duration::from_secs(60),
    });
    assert!(drain_ready_at(&mut queue, now).is_empty());
    assert_eq!(queue.len(), 1);
    assert_eq!(
      drain_ready_at(&mut queue, now + Duration::from_secs(61)).len(),
      1
    );
    assert!(queue.is_empty());
  }
}
