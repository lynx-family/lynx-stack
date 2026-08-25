use std::path::PathBuf;
use std::time::{Duration, Instant};

use crate::bmp::{self, Bitmap};
use crate::{
  ContainerOptions, Error, GotoOptions, LynxContainer, LynxPage, Result, ScreenshotOptions,
};

const VIEWPORT_WIDTH: usize = 800;
const VIEWPORT_HEIGHT: usize = 600;
const FIXTURE_TIMEOUT: Duration = Duration::from_secs(30);

#[derive(Debug)]
pub struct RunReport {
  pub width: usize,
  pub height: usize,
  pub visible_pixels: usize,
  pub white_pixels: usize,
  pub gradient_pixels: usize,
  pub logo_pixels: usize,
  pub arrow_pixels: usize,
  pub screenshot_path: PathBuf,
}

pub fn run_react_fixture() -> Result<RunReport> {
  let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let repo_root = crate_dir.join("../../..");
  let bundle =
    repo_root.join("packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle");
  let screenshot_path = repo_root.join("target/headless-rust-test-runner/react-fixture.bmp");
  if !bundle.is_file() {
    return Err(Error::Protocol(format!(
      "React fixture is not built: {}",
      bundle.display()
    )));
  }

  let container = LynxContainer::new(ContainerOptions {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    ..ContainerOptions::default()
  })?;
  let mut page = container.new_page()?;
  page.goto(
    bundle
      .to_str()
      .ok_or_else(|| Error::Protocol("fixture path is not UTF-8".into()))?,
    GotoOptions::default(),
  )?;

  assert_fixture_dom(&mut page)?;
  let (screenshot, frame, stats) = wait_for_expected_screenshot(&mut page)?;
  if let Some(parent) = screenshot_path.parent() {
    std::fs::create_dir_all(parent)?;
  }
  std::fs::write(&screenshot_path, screenshot)?;
  assert_node_id_tap(&mut page)?;

  Ok(RunReport {
    width: frame.width,
    height: frame.height,
    visible_pixels: stats.visible_pixels,
    white_pixels: stats.white_pixels,
    gradient_pixels: stats.gradient_pixels,
    logo_pixels: stats.logo_pixels,
    arrow_pixels: stats.arrow_pixels,
    screenshot_path,
  })
}

fn assert_fixture_dom(page: &mut LynxPage) -> Result<()> {
  let content = page.content()?;
  if !content.contains("React") || !content.contains("have fun") {
    return Err(Error::Protocol(
      "React fixture rendered unexpected DOM content".into(),
    ));
  }

  let title = page
    .locator(".Title")?
    .ok_or_else(|| Error::Protocol("React fixture title is missing".into()))?;
  if title.get_attribute("class")?.as_deref() != Some("Title") {
    return Err(Error::Protocol(
      "React fixture title has an unexpected class".into(),
    ));
  }
  if title.get_attribute("text")?.as_deref() != Some("React") {
    return Err(Error::Protocol(
      "React fixture title has unexpected text".into(),
    ));
  }
  if !title.computed_style_map()?.contains_key("display") {
    return Err(Error::Protocol(
      "React fixture title is missing computed display style".into(),
    ));
  }
  Ok(())
}

fn assert_node_id_tap(page: &mut LynxPage) -> Result<()> {
  let logo = page
    .locator(".Logo")?
    .ok_or_else(|| Error::Protocol("React fixture logo is missing".into()))?;
  if page.locator(".Logo--lynx")?.is_none() {
    return Err(Error::Protocol(
      "React fixture did not render the initial Lynx logo".into(),
    ));
  }

  logo.tap()?;
  let deadline = Instant::now() + Duration::from_secs(5);
  while Instant::now() < deadline {
    if page.locator(".Logo--react")?.is_some() {
      return Ok(());
    }
    page.wait_for_timeout(Duration::from_millis(50));
  }
  Err(Error::Timeout(
    "waiting for React fixture state update after node-id tap".into(),
  ))
}

fn wait_for_expected_screenshot(page: &mut LynxPage) -> Result<(Vec<u8>, Bitmap, ScreenshotStats)> {
  let expectation = ScreenshotExpectation::react_fixture();
  let deadline = Instant::now() + FIXTURE_TIMEOUT;
  let mut latest_mismatch = None;
  while Instant::now() < deadline {
    let screenshot = page.screenshot(ScreenshotOptions {
      settle: Duration::from_millis(16),
      ..ScreenshotOptions::default()
    })?;
    let frame = bmp::decode(&screenshot)?;
    match expectation.assert_matches(&frame) {
      Ok(stats) => return Ok((screenshot, frame, stats)),
      Err(error) => latest_mismatch = Some(error),
    }
  }
  Err(Error::Timeout(format!(
    "waiting for the complete React fixture frame; last mismatch: {}",
    latest_mismatch.unwrap_or_else(|| "no frame captured".into())
  )))
}

struct ScreenshotExpectation {
  width: usize,
  height: usize,
  min_visible_pixels: usize,
  min_white_pixels: usize,
  min_gradient_pixels: usize,
  min_logo_pixels: usize,
  min_arrow_pixels: usize,
}

#[derive(Debug)]
struct ScreenshotStats {
  visible_pixels: usize,
  white_pixels: usize,
  gradient_pixels: usize,
  logo_pixels: usize,
  arrow_pixels: usize,
}

impl ScreenshotExpectation {
  fn react_fixture() -> Self {
    Self {
      width: VIEWPORT_WIDTH,
      height: VIEWPORT_HEIGHT,
      min_visible_pixels: 450_000,
      min_white_pixels: 1_500,
      min_gradient_pixels: 50_000,
      min_logo_pixels: if cfg!(target_os = "linux") { 500 } else { 0 },
      min_arrow_pixels: if cfg!(target_os = "linux") { 100 } else { 0 },
    }
  }

  fn assert_matches(&self, frame: &Bitmap) -> std::result::Result<ScreenshotStats, String> {
    if frame.width != self.width || frame.height != self.height {
      return Err(format!(
        "expected {}x{} React fixture frame, got {}x{}",
        self.width, self.height, frame.width, frame.height
      ));
    }
    let stats = screenshot_stats(frame);
    let checks = [
      ("visible", stats.visible_pixels, self.min_visible_pixels),
      ("white text", stats.white_pixels, self.min_white_pixels),
      ("gradient", stats.gradient_pixels, self.min_gradient_pixels),
      ("logo", stats.logo_pixels, self.min_logo_pixels),
      ("arrow", stats.arrow_pixels, self.min_arrow_pixels),
    ];
    if let Some((name, actual, expected)) = checks
      .into_iter()
      .find(|(_, actual, expected)| actual < expected)
    {
      return Err(format!(
        "React fixture frame has too few {name} pixels: expected at least {expected}, got {actual}; stats={stats:?}"
      ));
    }
    Ok(stats)
  }
}

fn screenshot_stats(frame: &Bitmap) -> ScreenshotStats {
  let mut stats = ScreenshotStats {
    visible_pixels: 0,
    white_pixels: 0,
    gradient_pixels: 0,
    logo_pixels: 0,
    arrow_pixels: 0,
  };
  for (index, pixel) in frame.rgba.chunks_exact(4).enumerate() {
    let [red, green, blue, alpha] = [pixel[0], pixel[1], pixel[2], pixel[3]];
    if alpha != 0 {
      stats.visible_pixels += 1;
      if red > 220 && green > 220 && blue > 220 {
        stats.white_pixels += 1;
      }
      if red > 45 && blue > 45 && green < 130 && red.max(blue) > green + 15 {
        stats.gradient_pixels += 1;
      }
    }

    let x = index % frame.width;
    let y = index / frame.width;
    if (330..470).contains(&x)
      && (95..235).contains(&y)
      && alpha > 0
      && is_saturated_image_pixel(red, green, blue)
    {
      stats.logo_pixels += 1;
    }
    if (370..430).contains(&x)
      && (385..445).contains(&y)
      && alpha > 0
      && is_saturated_image_pixel(red, green, blue)
    {
      stats.arrow_pixels += 1;
    }
  }
  stats
}

fn is_saturated_image_pixel(red: u8, green: u8, blue: u8) -> bool {
  let max_channel = red.max(green).max(blue);
  let min_channel = red.min(green).min(blue);
  max_channel > 80 && max_channel.saturating_sub(min_channel) > 50
}
