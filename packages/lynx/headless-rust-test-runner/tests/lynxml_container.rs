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
  decode_screenshot, ContainerOptions, Error, GotoOptions, LynxContainer, LynxPage,
  ScreenshotOptions,
};

const WIDTH: usize = 400;
const HEIGHT: usize = 300;

fn fixture_url() -> String {
  let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("fixtures/lynxml/counter.lynxml");
  format!("file://{}", fixture.display())
}

fn assert_bmp_screenshot(page: &mut LynxPage, path: Option<PathBuf>, label: &str) {
  let screenshot = page
    .screenshot(ScreenshotOptions {
      path,
      settle: Duration::from_millis(32),
    })
    .expect("capture a screenshot");
  let frame = decode_screenshot(&screenshot).expect("decode the BMP screenshot");
  assert_eq!((frame.width, frame.height), (WIDTH, HEIGHT));
  assert!(
    frame.rgba.chunks_exact(4).any(|pixel| pixel[3] != 0),
    "{label} page painted no visible pixels"
  );
}

#[test]
fn a_process_reuses_one_native_page_slot_across_lifetimes() {
  let options = || ContainerOptions {
    width: WIDTH,
    height: HEIGHT,
    ..ContainerOptions::default()
  };
  let container = match LynxContainer::new(options()) {
    Ok(container) => container,
    Err(error) => {
      eprintln!("skipping: no usable Lynx runtime is configured: {error}");
      return;
    }
  };
  let other_container =
    LynxContainer::new(options()).expect("create another owner-thread container");

  let screenshot_path = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("lynxml-container.bmp");
  let (first_loaded, retained_node) = {
    let mut first = container.new_page().expect("create the first page");
    assert!(
      matches!(container.new_page(), Err(Error::PageAlreadyOpen)),
      "the same container must reject an overlapping native page"
    );
    assert!(
      matches!(other_container.new_page(), Err(Error::PageAlreadyOpen)),
      "another container must share the process-wide native page slot"
    );

    if let Err(error) = first.goto(&fixture_url(), GotoOptions::default()) {
      eprintln!("skipping: the configured runtime cannot load LynxML: {error}");
      (false, None)
    } else {
      assert_bmp_screenshot(&mut first, Some(screenshot_path.clone()), "first");

      let retained_node = match first.content() {
        Ok(content) => {
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
          Some(label)
        }
        Err(Error::DevtoolTargetUnavailable) => {
          eprintln!("skipping DOM coverage: the runtime has no per-view DevTools target");
          None
        }
        Err(error) => panic!("unexpected DOM error: {error}"),
      };
      (true, retained_node)
    }
  };

  if !first_loaded {
    let _second = container
      .new_page()
      .expect("the native page slot must reopen after a skipped first page");
    return;
  }

  let dom_available = retained_node.is_some();
  if dom_available {
    assert!(
      matches!(other_container.new_page(), Err(Error::PageAlreadyOpen)),
      "an ElementNode must keep its native page slot alive"
    );
  }
  drop(retained_node);

  let mut second = container
    .new_page()
    .expect("reuse the native page slot after dropping every first-page handle");
  second
    .goto(&fixture_url(), GotoOptions::default())
    .expect("the second page must load the same way");
  assert_bmp_screenshot(&mut second, None, "second");
  assert_eq!(
    &std::fs::read(&screenshot_path).expect("read the written screenshot")[0..2],
    b"BM"
  );

  if dom_available {
    assert!(second
      .locator(".Counter--tapped")
      .expect("query the second page")
      .is_none());
  }
}
