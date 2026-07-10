use std::path::PathBuf;
use std::time::Duration;

use kitten_lynx_rust::{ConnectOptions, GotoOptions, Lynx, ScreenshotOptions};

#[tokio::test(flavor = "current_thread")]
#[cfg_attr(
  target_os = "macos",
  ignore = "the Linux runtime-backed test is the CI contract; run explicitly for macOS diagnostics"
)]
async fn drives_the_react_fixture_with_kitten_lynx_apis() {
  let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let repo_root = crate_dir.join("../../..");
  let bundle =
    repo_root.join("packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle");
  let lynx_core =
    repo_root.join("packages/lynx/headless-rust-test-runner/fixtures/react/lynx_core.js");
  assert!(bundle.is_file(), "build the React fixture before this test");

  let lynx = Lynx::connect(ConnectOptions {
    lynx_core_path: Some(lynx_core),
    ..ConnectOptions::default()
  })
  .await
  .expect("headless Lynx should connect");
  let mut page = lynx.new_page().expect("page should be created");
  page
    .goto(
      bundle.to_str().expect("fixture path is UTF-8"),
      GotoOptions::default(),
    )
    .await
    .expect("fixture should load");

  let content = page.content().await.expect("DOM should serialize");
  assert!(content.contains("React"));
  assert!(content.contains("have fun"));

  let title = page
    .locator(".Title")
    .await
    .expect("locator should succeed")
    .expect("title should exist");
  assert_eq!(
    title
      .get_attribute("class")
      .await
      .expect("class should read"),
    Some("Title".into())
  );
  assert!(title
    .computed_style_map()
    .await
    .expect("computed style should read")
    .contains_key("display"));

  let screenshot = page
    .screenshot(ScreenshotOptions::default())
    .await
    .expect("screenshot should encode");
  assert!(screenshot.starts_with(b"\x89PNG\r\n\x1a\n"));

  let logo = page
    .locator(".Logo")
    .await
    .expect("logo locator should succeed")
    .expect("logo should exist");
  logo.tap().await.expect("logo should tap");
  page.wait_for_timeout(Duration::from_secs(2)).await;
  assert!(page
    .locator(".Logo--react")
    .await
    .expect("updated logo query should succeed")
    .is_some());
  lynx.close();
}
