// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::path::Path;
use std::time::Duration;
use ui_judge::{capture_page, compare_images, CapturePageRequest};

#[tokio::test(flavor = "current_thread")]
async fn captures_and_compares_the_headless_runner_page_without_a_model() {
  let bundle =
    Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures/react/.generated/main.lynx.bundle");
  assert!(
    bundle.is_file(),
    "build the fixture before the test: {}",
    bundle.display()
  );
  let bmp = capture_page(CapturePageRequest {
    url: format!("file://{}", bundle.display()),
    screenshot_settle: Duration::from_millis(1000),
    timeout: Duration::from_secs(120),
    ..Default::default()
  })
  .await
  .expect("capture the fixture without model credentials");
  assert!(bmp.starts_with(b"BM"));
  let image = image::load_from_memory(&bmp).expect("decode BMP");
  assert!(image.width() > 0 && image.height() > 0);
  let comparison = compare_images(&bmp, &bmp)
    .await
    .expect("compare captured pixels");
  assert_eq!(comparison.similarity, 1.0);
  assert_eq!(comparison.different_blocks, 0);
}
