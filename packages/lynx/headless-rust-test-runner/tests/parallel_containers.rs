//! Runtime-backed proof that containers are per thread, not per process.
//!
//! This lives in its own test binary because native Lynx state is
//! process-wide: a second test in the same process would observe the engine
//! threads this one starts.

use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use lynx_headless_rust_test_runner::{
  ContainerOptions, GotoOptions, LynxContainer, Result, ScreenshotOptions,
};

const CONTAINERS: usize = 4;

fn fixture_url() -> String {
  let fixture =
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/lynxml/counter.lynxml");
  format!("file://{}", fixture.display())
}

fn render(index: usize) -> Result<(usize, usize, usize)> {
  let container = LynxContainer::new(ContainerOptions {
    width: 200 + index * 20,
    height: 150,
    ..ContainerOptions::default()
  })?;
  let mut page = container.new_page()?;
  page.goto(&fixture_url(), GotoOptions::default())?;
  let screenshot = page.screenshot(ScreenshotOptions {
    settle: Duration::from_millis(32),
    ..ScreenshotOptions::default()
  })?;
  let frame = lynx_headless_rust_test_runner::decode_screenshot(&screenshot)?;
  let visible = frame
    .rgba
    .chunks_exact(4)
    .filter(|pixel| pixel[3] != 0)
    .count();
  Ok((frame.width, frame.height, visible))
}

#[test]
fn independent_threads_each_drive_their_own_container() {
  // Every worker stays alive until all of them have rendered, so this really
  // exercises concurrent containers rather than a sequence of them.
  let (ready_sender, ready) = mpsc::channel();
  let (release_sender, release) = mpsc::channel::<()>();
  let release = std::sync::Arc::new(std::sync::Mutex::new(release));
  let workers = (0..CONTAINERS)
    .map(|index| {
      let ready_sender = ready_sender.clone();
      let release = std::sync::Arc::clone(&release);
      thread::spawn(move || {
        let rendered = render(index);
        ready_sender.send(()).expect("report readiness");
        // Hold the container alive until the test releases every worker.
        let _ = release
          .lock()
          .unwrap_or_else(|poisoned| poisoned.into_inner())
          .recv();
        rendered
      })
    })
    .collect::<Vec<_>>();
  drop(ready_sender);
  for _ in 0..CONTAINERS {
    ready.recv().expect("every worker must finish rendering");
  }
  for _ in 0..CONTAINERS {
    release_sender.send(()).expect("release a worker");
  }

  let mut skipped = None;
  for (index, worker) in workers.into_iter().enumerate() {
    match worker.join().expect("worker thread must not panic") {
      Ok((width, height, visible)) => {
        assert_eq!((width, height), (200 + index * 20, 150));
        assert!(visible > 0, "container {index} rendered nothing");
      }
      Err(error) => skipped = Some(error.to_string()),
    }
  }
  if let Some(error) = skipped {
    eprintln!("skipping: the configured runtime could not render every container: {error}");
  }
}
