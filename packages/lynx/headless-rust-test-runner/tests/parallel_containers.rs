//! Runtime-backed proof that native Lynx has one process owner thread.
//!
//! This lives in its own test binary because the owner claim is permanent for
//! the process. The first thread keeps its container alive while a second
//! thread verifies that it is rejected before touching native state. A failed
//! `lynx_core.js` path check must not claim that owner first.

use std::path::PathBuf;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use lynx_headless_rust_test_runner::{ContainerOptions, Error, LynxContainer};

#[test]
fn a_second_os_thread_cannot_create_a_native_container() {
  let missing_core =
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures/lynx_core-that-does-not-exist.js");
  assert!(
    !missing_core.exists(),
    "the invalid core path must stay absent"
  );
  let (invalid_ready_sender, invalid_ready) = mpsc::sync_channel(0);
  let (invalid_release_sender, invalid_release) = mpsc::sync_channel(0);
  let invalid = thread::spawn(move || {
    match LynxContainer::new(ContainerOptions {
      lynx_core_path: Some(missing_core.clone()),
      ..ContainerOptions::default()
    }) {
      Err(Error::LynxCoreNotFound(path)) => assert_eq!(path, missing_core),
      Err(error) => panic!("unexpected invalid-core error: {error}"),
      Ok(container) => {
        drop(container);
        panic!("a nonexistent lynx_core.js path must be rejected");
      }
    }
    invalid_ready_sender
      .send(())
      .expect("report invalid core rejection");
    invalid_release
      .recv()
      .expect("hold the non-owner thread alive");
  });
  invalid_ready
    .recv()
    .expect("the invalid core path must be rejected before owner claim");

  let (ready_sender, ready) = mpsc::sync_channel(0);
  let (release_sender, release) = mpsc::sync_channel(0);
  let owner = thread::spawn(move || {
    let container = LynxContainer::new(ContainerOptions {
      timeout: Duration::from_secs(1),
      ..ContainerOptions::default()
    });
    let affinity_error = matches!(&container, Err(Error::ThreadAffinity { .. }));
    ready_sender
      .send((
        affinity_error,
        container.as_ref().err().map(ToString::to_string),
      ))
      .expect("report owner initialization");
    release.recv().expect("hold the owner thread");
    drop(container);
  });

  let (owner_affinity_error, owner_error) = ready.recv().expect("wait for the process owner");
  assert!(
    !owner_affinity_error,
    "an invalid lynx_core.js path must not claim the process owner"
  );
  let second = thread::spawn(|| match LynxContainer::new(ContainerOptions::default()) {
    Err(Error::ThreadAffinity { .. }) => true,
    Err(error) => panic!("unexpected second-owner error: {error}"),
    Ok(container) => {
      drop(container);
      false
    }
  });
  assert!(
    second.join().expect("the second thread should not panic"),
    "a second native owner must not be created"
  );

  release_sender.send(()).expect("release the owner thread");
  owner.join().expect("the owner thread should not panic");
  invalid_release_sender
    .send(())
    .expect("release the non-owner thread");
  invalid
    .join()
    .expect("the invalid-core thread should not panic");
  if let Some(error) = owner_error {
    eprintln!("owner runtime initialization was unavailable: {error}");
  }
}
