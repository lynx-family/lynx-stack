// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

//! The bounded queue for the thread that owns native Lynx capture.
//!
//! `LynxContainer` and its pages are blocking and bound to their creating
//! thread. The process therefore keeps one dedicated owner thread and moves
//! concurrency to request handling and post-capture scoring. Callers hand a job
//! to the bounded queue and await one reply.

use std::io;
use std::panic::{catch_unwind, resume_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex, OnceLock, TryLockError};
use std::thread::{self, JoinHandle};

use lynx_headless_rust_test_runner::{ContainerOptions, LynxContainer};
use thiserror::Error;
use tokio::sync::oneshot;

use crate::headless::{capture_with_container, CapturedPage, PageLoadOptions};
use crate::model::ModelClient;
use crate::{JudgePageRequest, UiJudgeResult};

/// Native Lynx currently permits one process-wide owner thread.
const NATIVE_CAPTURE_WORKERS: usize = 1;
/// Jobs that may wait for a free worker before callers are told to retry.
const MAX_QUEUED_CAPTURES: usize = 8;

#[derive(Debug, Error)]
pub(crate) enum CaptureError {
  #[error("The UI Judge capture queue is full; retry the request later.")]
  QueueFull,
  #[error("The UI Judge headless worker is unavailable.")]
  Unavailable,
  #[error("The UI Judge headless worker is shutting down.")]
  ShuttingDown,
  #[error("The UI Judge headless worker stopped before returning a result.")]
  Stopped,
}

#[derive(Debug, Error)]
#[error("UI Judge headless worker panicked")]
pub(crate) struct WorkerPanicked;

pub(crate) struct CaptureJob {
  pub(crate) client: Option<ModelClient>,
  pub(crate) load_options: PageLoadOptions,
  pub(crate) request: JudgePageRequest,
  pub(crate) response: oneshot::Sender<CaptureResponse>,
}

pub(crate) struct CaptureResponse {
  pub(crate) capture: Result<CapturedPage, UiJudgeResult>,
  pub(crate) client: Option<ModelClient>,
  pub(crate) request: JudgePageRequest,
}

/// Container-owning worker threads behind a bounded queue.
///
/// Production always creates exactly one native worker. Tests may inject mock
/// workers through `with_worker_main` without touching native Lynx.
pub(crate) struct CaptureWorkers {
  failure_receiver: Mutex<Option<oneshot::Receiver<()>>>,
  healthy: Arc<AtomicBool>,
  // Retained so a fatal worker failure can drop every queued response before
  // the server waits for in-flight handlers during graceful shutdown.
  jobs: Arc<Mutex<Receiver<CaptureJob>>>,
  sender: Arc<Mutex<Option<SyncSender<CaptureJob>>>>,
  workers: Mutex<Vec<JoinHandle<()>>>,
}

impl CaptureWorkers {
  fn new() -> io::Result<Self> {
    Self::with_worker_main(NATIVE_CAPTURE_WORKERS, run_capture_worker)
  }

  /// Starts `worker_count` threads running `worker_main`.
  ///
  /// Tests substitute a deterministic `worker_main` so the HTTP layer can be
  /// exercised without a native runtime.
  pub(crate) fn with_worker_main<F>(worker_count: usize, worker_main: F) -> io::Result<Self>
  where
    F: Fn(Arc<Mutex<Receiver<CaptureJob>>>) + Clone + Send + 'static,
  {
    let (sender, receiver) = mpsc::sync_channel(MAX_QUEUED_CAPTURES);
    let receiver = Arc::new(Mutex::new(receiver));
    let sender = Arc::new(Mutex::new(Some(sender)));
    let (failure_sender, failure_receiver) = oneshot::channel();
    let failure_sender = Arc::new(Mutex::new(Some(failure_sender)));
    let healthy = Arc::new(AtomicBool::new(true));

    let mut workers = Vec::with_capacity(worker_count);
    for index in 0..worker_count {
      let receiver = Arc::clone(&receiver);
      let worker_main = worker_main.clone();
      let worker_healthy = Arc::clone(&healthy);
      let failure_sender = Arc::clone(&failure_sender);
      let worker_sender = Arc::clone(&sender);
      workers.push(
        thread::Builder::new()
          .name(format!("ui-judge-headless-{index}"))
          .spawn(move || {
            let result = catch_unwind(AssertUnwindSafe(|| worker_main(Arc::clone(&receiver))));
            if let Err(payload) = result {
              // One dead container leaves the process without a reliable
              // native owner. Stop admission and release every queued waiter
              // before asking the HTTP server to drain.
              worker_healthy.store(false, Ordering::Release);
              close_and_discard_queue(&worker_sender, &receiver);
              if let Some(sender) = failure_sender
                .lock()
                .unwrap_or_else(|poisoned| poisoned.into_inner())
                .take()
              {
                let _ = sender.send(());
              }
              resume_unwind(payload);
            }
          })?,
      );
    }

    Ok(Self {
      failure_receiver: Mutex::new(Some(failure_receiver)),
      healthy,
      jobs: receiver,
      sender,
      workers: Mutex::new(workers),
    })
  }

  pub(crate) fn take_failure_receiver(&self) -> Result<oneshot::Receiver<()>, CaptureError> {
    if !self.is_healthy() {
      return Err(CaptureError::Unavailable);
    }
    self
      .failure_receiver
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take()
      .ok_or(CaptureError::Unavailable)
  }

  pub(crate) fn is_healthy(&self) -> bool {
    self.healthy.load(Ordering::Acquire)
  }

  /// Enqueues a capture and returns the channel its worker will reply on.
  ///
  /// Enqueueing is synchronous on purpose: backpressure is reported the moment
  /// a caller asks, not whenever a future first happens to be polled.
  pub(crate) fn submit(
    &self,
    request: JudgePageRequest,
    client: Option<ModelClient>,
    load_options: PageLoadOptions,
  ) -> Result<oneshot::Receiver<CaptureResponse>, CaptureError> {
    let (response, response_receiver) = oneshot::channel();
    let job = CaptureJob {
      client,
      load_options,
      request,
      response,
    };
    let sender = self
      .sender
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner());
    let Some(sender) = sender.as_ref() else {
      return Err(CaptureError::ShuttingDown);
    };
    match sender.try_send(job) {
      Ok(()) => Ok(response_receiver),
      Err(TrySendError::Full(job)) => {
        self.retry_after_dropping_cancelled(sender, job)?;
        Ok(response_receiver)
      }
      Err(TrySendError::Disconnected(_)) => Err(CaptureError::Unavailable),
    }
  }

  /// Reclaims queue slots whose async receivers were already dropped.
  ///
  /// The capture worker releases this mutex while it renders, which lets a
  /// concurrent submit purge cancelled jobs without waiting for that native
  /// operation to finish. Live jobs are put back in FIFO order before the new
  /// job is retried.
  fn retry_after_dropping_cancelled(
    &self,
    sender: &SyncSender<CaptureJob>,
    job: CaptureJob,
  ) -> Result<(), CaptureError> {
    let jobs = match self.jobs.try_lock() {
      Ok(jobs) => jobs,
      Err(TryLockError::Poisoned(poisoned)) => poisoned.into_inner(),
      Err(TryLockError::WouldBlock) => return Err(CaptureError::QueueFull),
    };
    let mut live_jobs = Vec::new();
    while let Ok(queued) = jobs.try_recv() {
      if !queued.response.is_closed() {
        live_jobs.push(queued);
      }
    }
    for queued in live_jobs {
      let requeued = sender.try_send(queued);
      assert!(
        requeued.is_ok(),
        "requeueing a drained live capture cannot exceed capacity"
      );
    }
    match sender.try_send(job) {
      Ok(()) => Ok(()),
      Err(TrySendError::Full(_)) => Err(CaptureError::QueueFull),
      Err(TrySendError::Disconnected(_)) => Err(CaptureError::Unavailable),
    }
  }

  pub(crate) async fn capture(
    &self,
    request: JudgePageRequest,
    client: Option<ModelClient>,
    load_options: PageLoadOptions,
  ) -> Result<CaptureResponse, CaptureError> {
    self
      .submit(request, client, load_options)?
      .await
      .map_err(|_| CaptureError::Stopped)
  }

  pub(crate) fn shutdown(&self) -> Result<(), WorkerPanicked> {
    // Closing the only sender lets every worker drain and exit.
    self.healthy.store(false, Ordering::Release);
    let sender = self
      .sender
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take();
    drop(sender);
    let workers = std::mem::take(
      &mut *self
        .workers
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner()),
    );
    let mut panicked = false;
    for worker in workers {
      panicked |= worker.join().is_err();
    }
    if panicked {
      Err(WorkerPanicked)
    } else {
      Ok(())
    }
  }
}

fn close_and_discard_queue(
  sender: &Mutex<Option<SyncSender<CaptureJob>>>,
  jobs: &Mutex<Receiver<CaptureJob>>,
) {
  let sender = sender
    .lock()
    .unwrap_or_else(|poisoned| poisoned.into_inner())
    .take();
  drop(sender);
  let jobs = jobs.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
  while jobs.try_recv().is_ok() {}
}

impl Drop for CaptureWorkers {
  fn drop(&mut self) {
    let _ = self.shutdown();
  }
}

/// The process-wide capture worker used by the library and HTTP server.
pub(crate) fn shared_workers() -> Result<Arc<CaptureWorkers>, String> {
  static WORKERS: OnceLock<Result<Arc<CaptureWorkers>, String>> = OnceLock::new();
  WORKERS
    .get_or_init(|| {
      CaptureWorkers::new()
        .map(Arc::new)
        .map_err(|error| format!("failed to start the UI Judge headless worker: {error}"))
    })
    .as_ref()
    .map(Arc::clone)
    .map_err(Clone::clone)
}

fn run_capture_worker(jobs: Arc<Mutex<Receiver<CaptureJob>>>) {
  // The container is created on the first real job so an idle worker never
  // loads the native runtime, and it is reused for every later job.
  let mut container: Option<LynxContainer> = None;
  loop {
    let job = {
      let jobs = jobs.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
      jobs.recv()
    };
    let Ok(job) = job else { return };
    if job.response.is_closed() {
      continue;
    }
    let capture = match container_for(&mut container, &job) {
      Ok(container) => capture_with_container(
        container,
        job.client.as_ref(),
        &job.request,
        &job.load_options,
      ),
      Err(result) => Err(result),
    };
    let _ = job.response.send(CaptureResponse {
      capture,
      client: job.client,
      request: job.request,
    });
  }
}

// `UiJudgeResult` is the crate's public failure shape; boxing it here would only
// move the allocation without changing what callers must handle.
#[allow(clippy::result_large_err)]
fn container_for<'a>(
  container: &'a mut Option<LynxContainer>,
  job: &CaptureJob,
) -> Result<&'a LynxContainer, UiJudgeResult> {
  if container.is_none() {
    let created = LynxContainer::new(ContainerOptions {
      timeout: job.request.timeout,
      ..ContainerOptions::default()
    })
    .map_err(|error| crate::headless::page_request_error(&job.request, error.to_string()))?;
    *container = Some(created);
  }
  Ok(container.as_ref().expect("the container was just created"))
}

#[cfg(test)]
mod tests {
  use super::*;

  fn assert_send_sync<T: Send + Sync>() {}

  #[test]
  fn the_pool_handle_can_be_shared_across_request_tasks() {
    assert_send_sync::<CaptureWorkers>();
  }

  #[test]
  fn a_full_queue_is_reported_instead_of_blocking_the_caller() {
    // A pool with no workers never dequeues, so the queue reaches exactly its
    // bound and the next submission has nowhere to go.
    let workers = CaptureWorkers::with_worker_main(0, |_jobs| unreachable!())
      .expect("start a pool with no workers");

    let accepted = (0..MAX_QUEUED_CAPTURES)
      .map(|_| {
        workers
          .submit(
            request("file:///tmp/queued.lynx.bundle"),
            None,
            PageLoadOptions::default(),
          )
          .expect("the queue must accept this job")
      })
      .collect::<Vec<_>>();
    let overflow = workers.submit(
      request("file:///tmp/overflow.lynx.bundle"),
      None,
      PageLoadOptions::default(),
    );

    assert_eq!(accepted.len(), MAX_QUEUED_CAPTURES);
    assert!(matches!(overflow, Err(CaptureError::QueueFull)));
    workers.shutdown().expect("stop the idle pool");
  }

  #[test]
  fn cancelled_jobs_release_queue_capacity_before_the_owner_dequeues_them() {
    let workers = CaptureWorkers::with_worker_main(0, |_jobs| unreachable!())
      .expect("start a pool with no workers");
    let cancelled = (0..MAX_QUEUED_CAPTURES)
      .map(|_| {
        workers
          .submit(
            request("file:///tmp/cancelled.lynx.bundle"),
            None,
            PageLoadOptions::default(),
          )
          .expect("fill the capture queue")
      })
      .collect::<Vec<_>>();
    drop(cancelled);

    let replacement = workers
      .submit(
        request("file:///tmp/replacement.lynx.bundle"),
        None,
        PageLoadOptions::default(),
      )
      .expect("cancelled jobs must release their queue slots");
    drop(replacement);
    workers.shutdown().expect("stop the idle pool");
  }

  #[tokio::test]
  async fn a_shut_down_pool_reports_that_it_is_no_longer_accepting_work() {
    let workers =
      CaptureWorkers::with_worker_main(0, |_jobs| unreachable!()).expect("start an idle pool");
    workers.shutdown().expect("stop the idle pool");

    let error = match workers
      .capture(
        request("file:///tmp/late.lynx.bundle"),
        None,
        PageLoadOptions::default(),
      )
      .await
    {
      Err(error) => error,
      Ok(_) => panic!("a shut down pool must reject new work"),
    };
    assert!(matches!(error, CaptureError::ShuttingDown), "got {error:?}");
  }

  fn request(url: &str) -> JudgePageRequest {
    JudgePageRequest {
      include_geqi: false,
      reference: None,
      reference_image: None,
      screenshot_settle: std::time::Duration::ZERO,
      steps: vec![],
      task: "Render the page".to_string(),
      timeout: std::time::Duration::from_secs(1),
      url: url.to_string(),
    }
  }
}
