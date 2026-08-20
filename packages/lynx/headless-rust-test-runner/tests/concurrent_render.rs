use std::io::Cursor;
use std::path::PathBuf;
use std::sync::{Arc, Barrier};
use std::time::Duration;

use lynx_headless_rust_test_runner::{ConnectOptions, GotoOptions, Lynx, ScreenshotOptions};

const CALLER_COUNT: usize = 4;
const WAVE_COUNT: usize = 2;

#[test]
#[cfg_attr(
  not(target_os = "linux"),
  ignore = "the Linux runtime-backed test is the CI contract; run explicitly for local diagnostics"
)]
fn shared_handle_dispatches_concurrent_visits_from_os_threads() {
  let package_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let lynx_core_path = package_dir.join("fixtures/react/lynx_core.js");
  let bundle =
    package_dir.join("../../genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle");
  assert!(
    bundle.is_file(),
    "build the React fixture before running this test"
  );
  let bundle = bundle
    .to_str()
    .expect("bundle path must be UTF-8")
    .to_string();

  let runtime = tokio::runtime::Builder::new_current_thread()
    .enable_all()
    .build()
    .expect("connect runtime should build");
  let lynx = runtime
    .block_on(Lynx::connect(ConnectOptions {
      lynx_core_path: Some(lynx_core_path),
      timeout: Duration::from_secs(5),
      ..ConnectOptions::default()
    }))
    .expect("headless Lynx should connect");
  drop(runtime);

  for _ in 0..WAVE_COUNT {
    run_concurrent_wave(&lynx, &bundle);
  }
}

fn run_concurrent_wave(lynx: &Lynx, bundle: &str) {
  let barrier = Arc::new(Barrier::new(CALLER_COUNT + 1));
  let callers = (0..CALLER_COUNT)
    .map(|_| {
      let lynx = lynx.clone();
      let barrier = Arc::clone(&barrier);
      let bundle = bundle.to_string();
      std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
          .enable_all()
          .build()
          .expect("caller runtime should build");
        barrier.wait();
        runtime.block_on(lynx.visit_screenshot(
          bundle,
          GotoOptions::default(),
          ScreenshotOptions {
            settle: Duration::from_millis(16),
            ..ScreenshotOptions::default()
          },
        ))
      })
    })
    .collect::<Vec<_>>();

  barrier.wait();
  for caller in callers {
    let png = caller
      .join()
      .expect("concurrent caller should not panic")
      .expect("concurrent screenshot visit should succeed");
    assert_fixture_screenshot(&png);
  }
}

fn assert_fixture_screenshot(bytes: &[u8]) {
  assert!(
    bytes.starts_with(b"\x89PNG\r\n\x1a\n"),
    "screenshot should have a PNG signature"
  );

  let decoder = png::Decoder::new(Cursor::new(bytes));
  let mut reader = decoder
    .read_info()
    .expect("concurrent screenshot should decode");
  let mut rgba = vec![
    0;
    reader
      .output_buffer_size()
      .expect("decoded screenshot should fit in memory")
  ];
  let info = reader
    .next_frame(&mut rgba)
    .expect("concurrent screenshot should contain one frame");
  assert_eq!((info.width, info.height), (800, 600));
  assert_eq!(info.color_type, png::ColorType::Rgba);
  assert_eq!(info.bit_depth, png::BitDepth::Eight);
  rgba.truncate(info.buffer_size());

  let mut visible_pixels = 0;
  let mut gradient_pixels = 0;
  for pixel in rgba.chunks_exact(4) {
    let [red, green, blue, alpha] = [pixel[0], pixel[1], pixel[2], pixel[3]];
    if alpha != 0 {
      visible_pixels += 1;
      if red > 45 && blue > 45 && green < 130 && red.max(blue) > green + 15 {
        gradient_pixels += 1;
      }
    }
  }

  assert!(
    visible_pixels >= 450_000,
    "concurrent screenshot should contain the rendered fixture"
  );
  assert!(
    gradient_pixels >= 50_000,
    "concurrent screenshot should contain the fixture gradient"
  );
}
