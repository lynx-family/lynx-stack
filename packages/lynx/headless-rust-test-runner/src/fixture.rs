use std::io::Cursor;
use std::path::PathBuf;
use std::time::{Duration, Instant};

use crate::{ConnectOptions, Error, GotoOptions, Lynx, Page, Result, ScreenshotOptions};

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

pub async fn run_react_fixture() -> Result<RunReport> {
  let crate_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
  let repo_root = crate_dir.join("../../..");
  let bundle =
    repo_root.join("packages/genui/ui-judge/tests/fixtures/react/.generated/main.lynx.bundle");
  let lynx_core = crate_dir.join("fixtures/react/lynx_core.js");
  let screenshot_path = repo_root.join("target/headless-rust-test-runner/react-fixture.png");
  if !bundle.is_file() {
    return Err(Error::Protocol(format!(
      "React fixture is not built: {}",
      bundle.display()
    )));
  }

  let lynx = Lynx::connect(ConnectOptions {
    width: VIEWPORT_WIDTH,
    height: VIEWPORT_HEIGHT,
    lynx_core_path: Some(lynx_core),
    ..ConnectOptions::default()
  })
  .await?;
  let mut page = lynx.new_page()?;
  page
    .goto(
      bundle
        .to_str()
        .ok_or_else(|| Error::Protocol("fixture path is not UTF-8".into()))?,
      GotoOptions::default(),
    )
    .await?;

  assert_fixture_dom(&mut page).await?;
  let (png, frame, stats) = wait_for_expected_screenshot(&page).await?;
  if let Some(parent) = screenshot_path.parent() {
    tokio::fs::create_dir_all(parent).await?;
  }
  tokio::fs::write(&screenshot_path, png).await?;
  assert_node_id_tap(&mut page).await?;
  lynx.close();

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

async fn assert_fixture_dom(page: &mut Page) -> Result<()> {
  let content = page.content().await?;
  if !content.contains("React") || !content.contains("have fun") {
    return Err(Error::Protocol(
      "React fixture rendered unexpected DOM content".into(),
    ));
  }

  let title = page
    .locator(".Title")
    .await?
    .ok_or_else(|| Error::Protocol("React fixture title is missing".into()))?;
  if title.get_attribute("class").await?.as_deref() != Some("Title") {
    return Err(Error::Protocol(
      "React fixture title has an unexpected class".into(),
    ));
  }
  if title.get_attribute("text").await?.as_deref() != Some("React") {
    return Err(Error::Protocol(
      "React fixture title has unexpected text".into(),
    ));
  }
  if !title.computed_style_map().await?.contains_key("display") {
    return Err(Error::Protocol(
      "React fixture title is missing computed display style".into(),
    ));
  }
  Ok(())
}

async fn assert_node_id_tap(page: &mut Page) -> Result<()> {
  let logo = page
    .locator(".Logo")
    .await?
    .ok_or_else(|| Error::Protocol("React fixture logo is missing".into()))?;
  if page.locator(".Logo--lynx").await?.is_none() {
    return Err(Error::Protocol(
      "React fixture did not render the initial Lynx logo".into(),
    ));
  }

  logo.tap().await?;
  let deadline = Instant::now() + Duration::from_secs(5);
  while Instant::now() < deadline {
    if page.locator(".Logo--react").await?.is_some() {
      return Ok(());
    }
    page.wait_for_timeout(Duration::from_millis(50)).await;
  }
  Err(Error::Timeout(
    "waiting for React fixture state update after node-id tap".into(),
  ))
}

async fn wait_for_expected_screenshot(
  page: &Page,
) -> Result<(Vec<u8>, CapturedFrame, ScreenshotStats)> {
  let expectation = ScreenshotExpectation::react_fixture();
  let deadline = Instant::now() + FIXTURE_TIMEOUT;
  let mut latest_mismatch = None;
  while Instant::now() < deadline {
    let png = page
      .screenshot(ScreenshotOptions {
        settle: Duration::from_millis(16),
        ..ScreenshotOptions::default()
      })
      .await?;
    let frame = decode_png(&png)?;
    match expectation.assert_matches(&frame) {
      Ok(stats) => return Ok((png, frame, stats)),
      Err(error) => latest_mismatch = Some(error),
    }
  }
  Err(Error::Timeout(format!(
    "waiting for the complete React fixture frame; last mismatch: {}",
    latest_mismatch.unwrap_or_else(|| "no frame captured".into())
  )))
}

struct CapturedFrame {
  width: usize,
  height: usize,
  rgba: Vec<u8>,
}

fn decode_png(bytes: &[u8]) -> Result<CapturedFrame> {
  let decoder = png::Decoder::new(Cursor::new(bytes));
  let mut reader = decoder
    .read_info()
    .map_err(|error| Error::Protocol(format!("failed to decode screenshot: {error}")))?;
  let buffer_size = reader
    .output_buffer_size()
    .ok_or_else(|| Error::Protocol("decoded screenshot is too large".into()))?;
  let mut buffer = vec![0; buffer_size];
  let info = reader
    .next_frame(&mut buffer)
    .map_err(|error| Error::Protocol(format!("failed to decode screenshot: {error}")))?;
  if info.color_type != png::ColorType::Rgba || info.bit_depth != png::BitDepth::Eight {
    return Err(Error::Protocol(format!(
      "expected an 8-bit RGBA screenshot, got {:?} {:?}",
      info.color_type, info.bit_depth
    )));
  }
  buffer.truncate(info.buffer_size());
  Ok(CapturedFrame {
    width: info.width as usize,
    height: info.height as usize,
    rgba: buffer,
  })
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

  fn assert_matches(&self, frame: &CapturedFrame) -> std::result::Result<ScreenshotStats, String> {
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

fn screenshot_stats(frame: &CapturedFrame) -> ScreenshotStats {
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
