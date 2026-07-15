#[tokio::main(flavor = "current_thread")]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
  let report = lynx_headless_rust_test_runner::run_react_fixture().await?;
  println!(
    "captured {}x{} software frame: visible_pixels={} white_pixels={} gradient_pixels={} logo_pixels={} arrow_pixels={} screenshot={}",
    report.width,
    report.height,
    report.visible_pixels,
    report.white_pixels,
    report.gradient_pixels,
    report.logo_pixels,
    report.arrow_pixels,
    report.screenshot_path.display()
  );
  Ok(())
}
