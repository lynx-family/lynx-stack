#[cfg(target_os = "linux")]
#[test]
fn renders_react_fixture_with_expected_screenshot_shape() {
  // CI exercises the fully headless Linux software path. macOS uses the same
  // Rust software renderer locally, but is not part of this CI contract yet.
  let report =
    lynx_headless_rust_test_runner::run_react_fixture().expect("React fixture should render");
  assert_eq!((report.width, report.height), (800, 600));
  assert!(report.screenshot_path.is_file());
}
