#[tokio::test(flavor = "current_thread")]
#[cfg_attr(
  not(target_os = "linux"),
  ignore = "the Linux runtime-backed test is the CI contract; run explicitly for local diagnostics"
)]
async fn renders_react_fixture_with_puppeteer_apis() {
  let report = lynx_headless_rust_test_runner::run_react_fixture()
    .await
    .expect("React fixture should render and respond to Puppeteer-style APIs");
  assert_eq!((report.width, report.height), (800, 600));
  assert!(report.visible_pixels >= 450_000);
  assert!(report.white_pixels >= 1_500);
  assert!(report.gradient_pixels >= 50_000);
  if cfg!(target_os = "linux") {
    assert!(report.logo_pixels >= 500);
    assert!(report.arrow_pixels >= 100);
  }
  assert!(report.screenshot_path.is_file());
}
