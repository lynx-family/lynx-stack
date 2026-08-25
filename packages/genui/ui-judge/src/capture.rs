// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

//! The bounded pool of threads that own the native Lynx containers.
//!
//! `LynxContainer` and its pages are blocking and bound to their creating
//! thread, so throughput comes from running several worker threads, each with
//! its own container, instead of interleaving futures over a single native
//! owner. Callers hand a job to the bounded queue and await one reply.

use std::io;
use std::panic::{catch_unwind, resume_unwind, AssertUnwindSafe};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{self, Receiver, SyncSender, TrySendError};
use std::sync::{Arc, Mutex, OnceLock};
use std::thread::{self, JoinHandle};

use lynx_headless_rust_test_runner::{ContainerOptions, LynxContainer};
use thiserror::Error;
use tokio::sync::oneshot;

use crate::headless::{capture_with_container, CapturedPage, PageLoadOptions};
use crate::model::ModelClient;
use crate::{JudgePageRequest, UiJudgeResult};

/// Native captures that may run at the same time. Each one owns a thread and a
/// Lynx container for the lifetime of the pool.
pub(crate) const CAPTURE_WORKERS: usize = 4;
/// Jobs that may wait for a free worker before callers are told to retry.
pub(crate) const MAX_QUEUED_CAPTURES: usize = 8;

#[derive(Debug, Error)]
pub enum CaptureError {
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
pub struct WorkerPanicked;

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

/// A fixed set of container-owning worker threads behind a bounded queue.
pub(crate) struct CaptureWorkers {
  failure_receiver: Mutex<Option<oneshot::Receiver<()>>>,
  healthy: Arc<AtomicBool>,
  // Held so the queue stays connected while jobs wait, independently of how
  // many workers are alive. Dropping the sender is what ends `shutdown`.
  _jobs: Arc<Mutex<Receiver<CaptureJob>>>,
  sender: Mutex<Option<SyncSender<CaptureJob>>>,
  workers: Mutex<Vec<JoinHandle<()>>>,
}

impl CaptureWorkers {
  pub(crate) fn new(worker_count: usize) -> io::Result<Self> {
    Self::with_worker_main(worker_count, run_capture_worker)
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
    let (failure_sender, failure_receiver) = oneshot::channel();
    let failure_sender = Arc::new(Mutex::new(Some(failure_sender)));
    let healthy = Arc::new(AtomicBool::new(true));

    let mut workers = Vec::with_capacity(worker_count);
    for index in 0..worker_count {
      let receiver = Arc::clone(&receiver);
      let worker_main = worker_main.clone();
      let worker_healthy = Arc::clone(&healthy);
      let failure_sender = Arc::clone(&failure_sender);
      workers.push(
        thread::Builder::new()
          .name(format!("ui-judge-headless-{index}"))
          .spawn(move || {
            let result = catch_unwind(AssertUnwindSafe(|| worker_main(receiver)));
            if let Err(payload) = result {
              // One dead container leaves the process without a reliable
              // native owner, so readiness fails and the server drains.
              worker_healthy.store(false, Ordering::Release);
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
      _jobs: receiver,
      sender: Mutex::new(Some(sender)),
      workers: Mutex::new(workers),
    })
  }

  pub(crate) fn take_failure_receiver(&self) -> oneshot::Receiver<()> {
    self
      .failure_receiver
      .lock()
      .unwrap_or_else(|poisoned| poisoned.into_inner())
      .take()
      .expect("headless worker failure receiver can only be taken once")
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

impl Drop for CaptureWorkers {
  fn drop(&mut self) {
    let _ = self.shutdown();
  }
}

/// The process-wide pool used by [`crate::judge_page`] and by the server.
pub(crate) fn shared_workers() -> Result<&'static CaptureWorkers, String> {
  static WORKERS: OnceLock<Result<CaptureWorkers, String>> = OnceLock::new();
  WORKERS
    .get_or_init(|| {
      CaptureWorkers::new(CAPTURE_WORKERS)
        .map_err(|error| format!("failed to start the UI Judge headless workers: {error}"))
    })
    .as_ref()
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
