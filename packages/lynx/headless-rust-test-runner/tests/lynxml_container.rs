//! Runtime-backed coverage for the container/page contract.
//!
//! Native Lynx state is process-wide and bound to the thread that created it,
//! and `libtest` runs every `#[test]` on its own thread. This file therefore
//! keeps a single test: a second one would build views on a thread whose
//! engine hosts the first test already tore down.
//!
//! The LynxML source path and the per-view DevTools target are both optional
//! runtime APIs. The test reports a skip when the loaded runtime predates
//! them, so it stays green on the pinned CI runtime while still exercising the
//! real engine wherever those APIs exist.

use std::path::{Path, PathBuf};
use std::time::Duration;

use lynx_headless_rust_test_runner::{
  decode_screenshot, ContainerOptions, Error, GotoOptions, LynxContainer, ScreenshotOptions,
};

const WIDTH: usize = 400;
const HEIGHT: usize = 300;

fn fixture_url() -> String {
  let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/lynxml/counter.lynxml");
  format!("file://{}", fixture.display())
}

#[test]
fn a_container_drives_several_pages_with_per_view_devtools_sessions() {
  let container = match LynxContainer::new(ContainerOptions {
    width: WIDTH,
    height: HEIGHT,
    ..ContainerOptions::default()
  }) {
    Ok(container) => container,
    Err(error) => {
      eprintln!("skipping: no usable Lynx runtime is configured: {error}");
      return;
    }
  };

  let mut first = container.new_page().expect("create the first page");
  let mut second = container.new_page().expect("create the second page");
  if let Err(error) = first.goto(&fixture_url(), GotoOptions::default()) {
    eprintln!("skipping: the configured runtime cannot load LynxML: {error}");
    return;
  }
  second
    .goto(&fixture_url(), GotoOptions::default())
    .expect("the second page must load the same way");

  // Both pages render independently inside the one container.
  let screenshot_path = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("lynxml-container.bmp");
  for (index, page) in [&mut first, &mut second].into_iter().enumerate() {
    let screenshot = page
      .screenshot(ScreenshotOptions {
        path: (index == 0).then(|| screenshot_path.clone()),
        settle: Duration::from_millis(32),
      })
      .expect("capture a screenshot");
    let frame = decode_screenshot(&screenshot).expect("decode the BMP screenshot");
    assert_eq!((frame.width, frame.height), (WIDTH, HEIGHT));
    assert!(
      frame.rgba.chunks_exact(4).any(|pixel| pixel[3] != 0),
      "page {index} painted no visible pixels"
    );
  }
  assert_eq!(
    &std::fs::read(&screenshot_path).expect("read the written screenshot")[0..2],
    b"BM"
  );

  let content = match first.content() {
    Ok(content) => content,
    Err(Error::DevtoolTargetUnavailable) => {
      eprintln!("skipping DOM coverage: the runtime has no per-view DevTools target");
      return;
    }
    Err(error) => panic!("unexpected DOM error: {error}"),
  };
  assert!(content.contains("<view"), "unexpected DOM: {content}");

  let label = first
    .locator(".Counter")
    .expect("query the counter label")
    .expect("the counter label must exist");
  assert_eq!(
    label.get_attribute("text").expect("read the label text"),
    Some("idle".to_string())
  );
  assert!(label
    .computed_style_map()
    .expect("read computed styles")
    .contains_key("display"));

  let button = first
    .locator(".Increment")
    .expect("query the button")
    .expect("the button must exist");
  button.tap().expect("tap the button");

  let mut tapped = false;
  for _ in 0..40 {
    if first
      .locator(".Counter--tapped")
      .expect("query the tapped label")
      .is_some()
    {
      tapped = true;
      break;
    }
    first.wait_for_timeout(Duration::from_millis(50));
  }
  assert!(tapped, "the node-id tap must reach the fixture handler");

  // The second page keeps its own session, so it never saw the first tap.
  assert!(second
    .locator(".Counter--tapped")
    .expect("query the second page")
    .is_none());
}
