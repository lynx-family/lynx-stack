// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::io::Cursor;
use std::time::Duration;

use base64::prelude::{Engine, BASE64_STANDARD, BASE64_STANDARD_NO_PAD};
use image::imageops::{self, FilterType};
use image::{DynamicImage, GrayImage, ImageFormat, ImageReader, Limits, Rgba, RgbaImage};
use reqwest::header::{CONTENT_LENGTH, CONTENT_TYPE};
use thiserror::Error;

const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_IMAGE_DIMENSION: u32 = 8_192;
const MAX_IMAGE_PIXELS: u64 = 8 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS: u64 = 10_000;

const DEFAULT_DOWNSAMPLE_WIDTH: f64 = 256.0;
const MAX_DOWNSAMPLED_HEIGHT: u32 = 1_024;
const MAX_ALIGN_TARGET_WIDTH: f64 = 8_192.0;
const DEFAULT_MAX_DX: f64 = 0.0;
const DEFAULT_MAX_DY_RATIO: f64 = 0.18;
const DEFAULT_MIN_SCORE: f64 = 0.15;
const DEFAULT_TOP_SKIP_RATIO: f64 = 0.06;
const DEFAULT_WINDOW_HEIGHT_RATIO: f64 = 0.28;

const DEFAULT_BLOCK_SIZE: u32 = 32;
const DEFAULT_PIXEL_TOLERANCE: f64 = 0.1;
const DEFAULT_THRESHOLD: f64 = 0.1;

pub(crate) type VisualResult<T> = std::result::Result<T, VisualEvaluationError>;

#[derive(Debug, Clone)]
pub(crate) struct ReferenceImageComparison {
  pub alignment_score: Option<f64>,
  pub diff_image_base64: String,
  pub different_blocks: usize,
  pub similarity: f64,
  pub total_blocks: usize,
  pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Default)]
struct VisualEvaluationAlignOptions {
  pub downsample_width: Option<f64>,
  pub max_dx: Option<f64>,
  pub max_dy_ratio: Option<f64>,
  pub min_score: Option<f64>,
  pub target_width: Option<f64>,
  pub top_skip_ratio: Option<f64>,
  pub window_height_ratio: Option<f64>,
}

#[derive(Debug, Clone, Default)]
struct VisualEvaluationCompareOptions {
  pub block_size: Option<u32>,
  pub pixel_tolerance: Option<f64>,
  pub threshold: Option<f64>,
}

#[derive(Debug, Clone)]
struct AlignResult {
  score: f64,
}

#[derive(Debug, Clone)]
struct CompareResult {
  different_blocks: usize,
  similarity: f64,
  total_blocks: usize,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum VisualEvaluationErrorCode {
  ImageAlignmentError,
  ImageCompareError,
  ReferenceImageFetchFailed,
  ReferenceImageInvalid,
  VisualEvaluationError,
}

#[derive(Debug, Clone, Error)]
#[error("{message}")]
pub struct VisualEvaluationError {
  pub status: u16,
  pub code: VisualEvaluationErrorCode,
  pub message: String,
}

impl VisualEvaluationError {
  pub fn new(status: u16, code: VisualEvaluationErrorCode, message: impl Into<String>) -> Self {
    Self {
      status,
      code,
      message: message.into(),
    }
  }
}

#[derive(Debug, Clone, Copy)]
enum ImageKind {
  Reference,
}

#[derive(Debug)]
struct AlignImagesOutput {
  aligned_reference_png: Vec<u8>,
  aligned_rendered_png: Vec<u8>,
  result: Option<AlignResult>,
}

#[derive(Debug, Clone)]
struct ResizedImage {
  height: u32,
  pixels: RgbaImage,
  width: u32,
}

#[derive(Debug, Clone, Copy)]
struct CandidateScore {
  dx: i32,
  dy: i32,
  score: f64,
}

#[derive(Debug, Clone, Copy)]
struct OverlapCrop {
  height: u32,
  reference_x: u32,
  reference_y: u32,
  rendered_x: u32,
  rendered_y: u32,
  width: u32,
}

#[derive(Debug)]
struct CompareImagesOutput {
  diff_png: Vec<u8>,
  result: CompareResult,
}

#[derive(Debug, Clone)]
struct BlockStats {
  different_pixels: u32,
  pixels: u32,
}

pub(crate) async fn compare_reference_image(
  reference_image: &str,
  rendered_png: &[u8],
) -> VisualResult<ReferenceImageComparison> {
  let reference_png = load_reference_image(reference_image).await?;
  let rendered_png = rendered_png.to_vec();
  let (alignment, comparison) = tokio::task::spawn_blocking(move || {
    let alignment = align_images(&reference_png, &rendered_png, None)?;
    let comparison = compare_images(
      &alignment.aligned_reference_png,
      &alignment.aligned_rendered_png,
      None,
    )?;
    Ok::<_, VisualEvaluationError>((alignment, comparison))
  })
  .await
  .map_err(|error| {
    VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::VisualEvaluationError,
      format!("Visual comparison worker failed: {error}"),
    )
  })??;

  let mut warnings = Vec::new();
  let align_result = alignment.result;
  if align_result.is_none() {
    warnings.push("Image alignment confidence too low; compared original images.".to_string());
  }
  Ok(ReferenceImageComparison {
    alignment_score: align_result.map(|alignment| alignment.score),
    diff_image_base64: BASE64_STANDARD.encode(&comparison.diff_png),
    different_blocks: comparison.result.different_blocks,
    similarity: comparison.result.similarity,
    total_blocks: comparison.result.total_blocks,
    warnings,
  })
}

pub(crate) async fn load_reference_image(input: &str) -> VisualResult<Vec<u8>> {
  load_image(input, ImageKind::Reference).await
}

async fn load_image(input: &str, kind: ImageKind) -> VisualResult<Vec<u8>> {
  let buffer = if let Some(url) = parse_http_url(input) {
    fetch_http_image(url, kind).await?
  } else {
    decode_base64_image(input, kind)?
  };
  tokio::task::spawn_blocking(move || normalize_image_to_png(&buffer, kind))
    .await
    .map_err(|error| {
      VisualEvaluationError::new(
        500,
        VisualEvaluationErrorCode::VisualEvaluationError,
        format!("Image normalization worker failed: {error}"),
      )
    })?
}

fn parse_http_url(input: &str) -> Option<reqwest::Url> {
  let url = reqwest::Url::parse(input).ok()?;
  matches!(url.scheme(), "http" | "https").then_some(url)
}

async fn fetch_http_image(url: reqwest::Url, kind: ImageKind) -> VisualResult<Vec<u8>> {
  let client = reqwest::Client::builder()
    .redirect(reqwest::redirect::Policy::none())
    .timeout(Duration::from_millis(IMAGE_FETCH_TIMEOUT_MS))
    .build()
    .map_err(|error| fetch_error(kind, format!("Failed to create HTTP client: {error}")))?;
  let mut response = client
    .get(url)
    .send()
    .await
    .map_err(|error| fetch_error(kind, format!("Failed to fetch {}: {error}", kind.label())))?;
  let status = response.status();
  if !status.is_success() {
    return Err(fetch_error(
      kind,
      format!("Failed to fetch {}: {}", kind.label(), status.as_u16()),
    ));
  }

  if let Some(content_type) = response
    .headers()
    .get(CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
  {
    if !content_type.to_ascii_lowercase().starts_with("image/") {
      return Err(fetch_error(
        kind,
        format!(
          "{} response must be an image, got {content_type}.",
          capitalize(kind.label())
        ),
      ));
    }
  }

  if let Some(length) = response
    .headers()
    .get(CONTENT_LENGTH)
    .and_then(|value| value.to_str().ok())
    .and_then(|value| value.parse::<usize>().ok())
  {
    if length > MAX_IMAGE_BYTES {
      return Err(fetch_error(
        kind,
        format!("{} response is too large.", capitalize(kind.label())),
      ));
    }
  }

  let mut buffer = Vec::new();
  while let Some(chunk) = response
    .chunk()
    .await
    .map_err(|error| fetch_error(kind, format!("Failed to fetch {}: {error}", kind.label())))?
  {
    if buffer.len() + chunk.len() > MAX_IMAGE_BYTES {
      return Err(fetch_error(kind, "Image response is too large."));
    }
    buffer.extend_from_slice(&chunk);
  }
  Ok(buffer)
}

fn decode_base64_image(input: &str, kind: ImageKind) -> VisualResult<Vec<u8>> {
  let stripped = strip_data_url_prefix(input).replace(char::is_whitespace, "");
  let max_encoded_bytes = MAX_IMAGE_BYTES.div_ceil(3) * 4 + 4;
  if stripped.is_empty() || stripped.len() % 4 == 1 || stripped.len() > max_encoded_bytes {
    return Err(invalid_image(kind));
  }
  let buffer = BASE64_STANDARD
    .decode(stripped.as_bytes())
    .or_else(|_| BASE64_STANDARD_NO_PAD.decode(stripped.as_bytes()))
    .map_err(|_| invalid_image(kind))?;
  if buffer.is_empty() || buffer.len() > MAX_IMAGE_BYTES {
    return Err(invalid_image(kind));
  }
  Ok(buffer)
}

fn strip_data_url_prefix(input: &str) -> &str {
  input
    .find("base64,")
    .map(|index| &input[index + "base64,".len()..])
    .unwrap_or(input)
}

fn normalize_image_to_png(buffer: &[u8], kind: ImageKind) -> VisualResult<Vec<u8>> {
  if buffer.is_empty() {
    return Err(invalid_image(kind));
  }
  let image = decode_image_with_limits(buffer).map_err(|_| invalid_image(kind))?;
  encode_dynamic_png(&image).map_err(|_| invalid_image(kind))
}

fn decode_image_with_limits(buffer: &[u8]) -> Result<DynamicImage, String> {
  let dimensions_reader = ImageReader::new(Cursor::new(buffer))
    .with_guessed_format()
    .map_err(|error| error.to_string())?;
  let (width, height) = dimensions_reader
    .into_dimensions()
    .map_err(|error| error.to_string())?;
  let pixels = u64::from(width).saturating_mul(u64::from(height));
  if width == 0
    || height == 0
    || width > MAX_IMAGE_DIMENSION
    || height > MAX_IMAGE_DIMENSION
    || pixels > MAX_IMAGE_PIXELS
  {
    return Err(format!(
      "Image dimensions {width}x{height} exceed the supported limit."
    ));
  }

  let mut reader = ImageReader::new(Cursor::new(buffer))
    .with_guessed_format()
    .map_err(|error| error.to_string())?;
  let mut limits = Limits::default();
  limits.max_image_width = Some(MAX_IMAGE_DIMENSION);
  limits.max_image_height = Some(MAX_IMAGE_DIMENSION);
  limits.max_alloc = Some(MAX_DECODED_IMAGE_BYTES);
  reader.limits(limits);
  reader.decode().map_err(|error| error.to_string())
}

fn align_images(
  reference_png: &[u8],
  rendered_png: &[u8],
  options: Option<&VisualEvaluationAlignOptions>,
) -> VisualResult<AlignImagesOutput> {
  let reference = decode_image_with_limits(reference_png).map_err(|error| {
    image_operation_error(VisualEvaluationErrorCode::ImageAlignmentError, error)
  })?;
  let rendered = decode_image_with_limits(rendered_png).map_err(|error| {
    image_operation_error(VisualEvaluationErrorCode::ImageAlignmentError, error)
  })?;
  let reference_width = reference.width();
  let rendered_width = rendered.width();
  if reference_width == 0 || rendered_width == 0 {
    return Ok(AlignImagesOutput {
      aligned_reference_png: reference_png.to_vec(),
      aligned_rendered_png: rendered_png.to_vec(),
      result: None,
    });
  }

  let options = options.cloned().unwrap_or_default();
  let target_width = round_positive(
    options
      .target_width
      .unwrap_or_else(|| reference_width.min(rendered_width) as f64)
      .min(MAX_ALIGN_TARGET_WIDTH),
  );
  let requested_downsample_width = round_positive(
    options
      .downsample_width
      .unwrap_or(DEFAULT_DOWNSAMPLE_WIDTH)
      .min(target_width as f64),
  );
  let resized_reference = resize_to_width(&reference, target_width)?;
  let resized_rendered = resize_to_width(&rendered, target_width)?;
  let max_resized_height = resized_reference.height.max(resized_rendered.height);
  let height_limited_width = ((u64::from(target_width) * u64::from(MAX_DOWNSAMPLED_HEIGHT))
    / u64::from(max_resized_height.max(1)))
  .clamp(1, u64::from(target_width)) as u32;
  let downsample_width = requested_downsample_width.min(height_limited_width);
  let downsampled_reference = to_grayscale(&resized_reference.pixels, downsample_width);
  let downsampled_rendered = to_grayscale(&resized_rendered.pixels, downsample_width);
  let window_height = get_window_height(
    downsampled_reference.height(),
    options
      .window_height_ratio
      .unwrap_or(DEFAULT_WINDOW_HEIGHT_RATIO),
  );
  let window_y = select_high_variance_window(
    &downsampled_reference,
    options.top_skip_ratio.unwrap_or(DEFAULT_TOP_SKIP_RATIO),
    options
      .window_height_ratio
      .unwrap_or(DEFAULT_WINDOW_HEIGHT_RATIO),
  );
  let max_dx = ((options.max_dx.unwrap_or(DEFAULT_MAX_DX) * downsample_width as f64)
    / target_width as f64)
    .round()
    .max(0.0) as i32;
  let max_dy = (downsampled_reference.height() as f64
    * options.max_dy_ratio.unwrap_or(DEFAULT_MAX_DY_RATIO))
  .round()
  .max(0.0) as i32;
  let best_candidate = find_best_offset(
    &downsampled_reference,
    &downsampled_rendered,
    window_y,
    window_height,
    max_dx,
    max_dy,
  );
  if best_candidate
    .as_ref()
    .is_none_or(|candidate| candidate.score < options.min_score.unwrap_or(DEFAULT_MIN_SCORE))
  {
    return Ok(AlignImagesOutput {
      aligned_reference_png: reference_png.to_vec(),
      aligned_rendered_png: rendered_png.to_vec(),
      result: None,
    });
  }

  let best_candidate = best_candidate.expect("checked candidate existence");
  let target_scale = target_width as f64 / downsample_width as f64;
  let dx = (best_candidate.dx as f64 * target_scale).round() as i32;
  let dy = (best_candidate.dy as f64 * target_scale).round() as i32;
  let crop = get_overlap_crop(
    resized_reference.width,
    resized_reference.height,
    resized_rendered.width,
    resized_rendered.height,
    dx,
    dy,
  );
  if crop.width == 0 || crop.height == 0 {
    return Ok(AlignImagesOutput {
      aligned_reference_png: reference_png.to_vec(),
      aligned_rendered_png: rendered_png.to_vec(),
      result: None,
    });
  }

  let aligned_reference = crop_rgba(
    &resized_reference.pixels,
    crop.reference_x,
    crop.reference_y,
    crop.width,
    crop.height,
  );
  let aligned_rendered = crop_rgba(
    &resized_rendered.pixels,
    crop.rendered_x,
    crop.rendered_y,
    crop.width,
    crop.height,
  );

  Ok(AlignImagesOutput {
    aligned_reference_png: encode_rgba_png(&aligned_reference)?,
    aligned_rendered_png: encode_rgba_png(&aligned_rendered)?,
    result: Some(AlignResult {
      score: best_candidate.score,
    }),
  })
}

fn compare_images(
  reference_png: &[u8],
  rendered_png: &[u8],
  options: Option<&VisualEvaluationCompareOptions>,
) -> VisualResult<CompareImagesOutput> {
  let reference = decode_image_with_limits(reference_png)
    .map_err(|error| image_operation_error(VisualEvaluationErrorCode::ImageCompareError, error))?;
  let rendered = decode_image_with_limits(rendered_png)
    .map_err(|error| image_operation_error(VisualEvaluationErrorCode::ImageCompareError, error))?;
  let width = reference.width().min(rendered.width());
  let height = reference.height().min(rendered.height());
  if width == 0 || height == 0 {
    return Err(VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::ImageCompareError,
      "Comparison images must have positive dimensions.",
    ));
  }

  let options = options.cloned().unwrap_or_default();
  let block_size = options.block_size.unwrap_or(DEFAULT_BLOCK_SIZE).max(1);
  let threshold = options.threshold.unwrap_or(DEFAULT_THRESHOLD);
  let pixel_tolerance = options.pixel_tolerance.unwrap_or(DEFAULT_PIXEL_TOLERANCE);
  let pixel_tolerance_squared = pixel_tolerance * pixel_tolerance;
  let reference = resize_to_exact_rgba(&reference, width, height);
  let rendered = resize_to_exact_rgba(&rendered, width, height);
  let block_columns = width.div_ceil(block_size);
  let block_rows = height.div_ceil(block_size);
  let mut block_stats = vec![
    BlockStats {
      different_pixels: 0,
      pixels: 0,
    };
    (block_columns * block_rows) as usize
  ];
  let mut diff = RgbaImage::new(width, height);

  for y in 0..height {
    for x in 0..width {
      let reference_pixel = reference.get_pixel(x, y).0;
      let rendered_pixel = rendered.get_pixel(x, y).0;
      let distance_squared = normalized_rgba_distance_squared(&reference_pixel, &rendered_pixel);
      let block_index = ((y / block_size) * block_columns + (x / block_size)) as usize;
      let block = &mut block_stats[block_index];
      block.pixels += 1;
      if distance_squared > pixel_tolerance_squared {
        block.different_pixels += 1;
        diff.put_pixel(x, y, Rgba([255, 0, 0, 255]));
      } else {
        diff.put_pixel(x, y, Rgba(rendered_pixel));
      }
    }
  }

  let mut different_blocks = 0;
  for block_y in 0..block_rows {
    for block_x in 0..block_columns {
      let block = &block_stats[(block_y * block_columns + block_x) as usize];
      if block.pixels == 0 {
        continue;
      }
      let diff_ratio = block.different_pixels as f64 / block.pixels as f64;
      if diff_ratio > threshold {
        different_blocks += 1;
      }
    }
  }

  let total_blocks = (block_columns * block_rows) as usize;
  Ok(CompareImagesOutput {
    diff_png: encode_rgba_png(&diff)?,
    result: CompareResult {
      different_blocks,
      similarity: if total_blocks == 0 {
        1.0
      } else {
        (1.0 - different_blocks as f64 / total_blocks as f64).clamp(0.0, 1.0)
      },
      total_blocks,
    },
  })
}

fn resize_to_width(image: &DynamicImage, width: u32) -> VisualResult<ResizedImage> {
  if image.width() == 0 || image.height() == 0 {
    return Err(VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::ImageAlignmentError,
      "Alignment images must have positive dimensions.",
    ));
  }
  let height = ((image.height() as f64 * width as f64) / image.width() as f64)
    .round()
    .max(1.0) as u32;
  Ok(ResizedImage {
    height,
    pixels: resize_to_exact_rgba(image, width, height),
    width,
  })
}

fn resize_to_exact_rgba(image: &DynamicImage, width: u32, height: u32) -> RgbaImage {
  imageops::resize(&image.to_rgba8(), width, height, FilterType::Lanczos3)
}

fn to_grayscale(image: &RgbaImage, width: u32) -> GrayImage {
  let height = ((image.height() as f64 * width as f64) / image.width() as f64)
    .round()
    .max(1.0) as u32;
  let resized = imageops::resize(image, width, height, FilterType::Lanczos3);
  DynamicImage::ImageRgba8(resized).to_luma8()
}

fn select_high_variance_window(
  image: &GrayImage,
  top_skip_ratio: f64,
  window_height_ratio: f64,
) -> u32 {
  let window_height = get_window_height(image.height(), window_height_ratio);
  let min_y = (image.height() - window_height)
    .min((image.height() as f64 * top_skip_ratio).floor().max(0.0) as u32);
  let step = (window_height / 4).max(1);
  let mut best_variance = f64::NEG_INFINITY;
  let mut best_y = min_y;
  let max_y = image.height() - window_height;
  let mut y = min_y;
  while y <= max_y {
    let variance = window_variance(image, y, window_height);
    if variance > best_variance {
      best_variance = variance;
      best_y = y;
    }
    y = y.saturating_add(step);
    if step == 0 {
      break;
    }
  }
  best_y
}

fn get_window_height(height: u32, ratio: f64) -> u32 {
  ((height as f64 * ratio).round() as u32).clamp(1, height.max(1))
}

fn window_variance(image: &GrayImage, y: u32, window_height: u32) -> f64 {
  let mut sum = 0.0;
  let mut sum_squares = 0.0;
  let mut count = 0.0;
  for yy in y..(y + window_height) {
    for x in 0..image.width() {
      let value = gray_pixel(image, x, yy);
      sum += value;
      sum_squares += value * value;
      count += 1.0;
    }
  }
  if count == 0.0 {
    return 0.0;
  }
  let mean = sum / count;
  sum_squares / count - mean * mean
}

fn find_best_offset(
  reference: &GrayImage,
  rendered: &GrayImage,
  window_y: u32,
  window_height: u32,
  max_dx: i32,
  max_dy: i32,
) -> Option<CandidateScore> {
  let mut best = None;
  for dy in -max_dy..=max_dy {
    let rendered_y = window_y as i32 + dy;
    if rendered_y < 0 || rendered_y as u32 + window_height > rendered.height() {
      continue;
    }
    for dx in -max_dx..=max_dx {
      let score = normalized_cross_correlation(
        reference,
        rendered,
        window_y,
        rendered_y as u32,
        window_height,
        dx,
      );
      if best
        .as_ref()
        .is_none_or(|candidate: &CandidateScore| score > candidate.score)
      {
        best = Some(CandidateScore { dx, dy, score });
      }
    }
  }
  best
}

fn normalized_cross_correlation(
  reference: &GrayImage,
  rendered: &GrayImage,
  reference_y: u32,
  rendered_y: u32,
  window_height: u32,
  dx: i32,
) -> f64 {
  let reference_x = if dx < 0 { (-dx) as u32 } else { 0 };
  let rendered_x = if dx > 0 { dx as u32 } else { 0 };
  if reference_x >= reference.width() || rendered_x >= rendered.width() {
    return f64::NEG_INFINITY;
  }
  let width = (reference.width() - reference_x).min(rendered.width() - rendered_x);
  if width == 0 {
    return f64::NEG_INFINITY;
  }

  let mut reference_sum = 0.0;
  let mut rendered_sum = 0.0;
  let mut count = 0.0;
  for y in 0..window_height {
    for x in 0..width {
      reference_sum += gray_pixel(reference, reference_x + x, reference_y + y);
      rendered_sum += gray_pixel(rendered, rendered_x + x, rendered_y + y);
      count += 1.0;
    }
  }
  if count == 0.0 {
    return f64::NEG_INFINITY;
  }

  let reference_mean = reference_sum / count;
  let rendered_mean = rendered_sum / count;
  let mut covariance = 0.0;
  let mut reference_variance = 0.0;
  let mut rendered_variance = 0.0;
  for y in 0..window_height {
    for x in 0..width {
      let reference_delta =
        gray_pixel(reference, reference_x + x, reference_y + y) - reference_mean;
      let rendered_delta = gray_pixel(rendered, rendered_x + x, rendered_y + y) - rendered_mean;
      covariance += reference_delta * rendered_delta;
      reference_variance += reference_delta * reference_delta;
      rendered_variance += rendered_delta * rendered_delta;
    }
  }

  let denominator = (reference_variance * rendered_variance).sqrt();
  if denominator == 0.0 {
    0.0
  } else {
    covariance / denominator
  }
}

fn get_overlap_crop(
  reference_width: u32,
  reference_height: u32,
  rendered_width: u32,
  rendered_height: u32,
  dx: i32,
  dy: i32,
) -> OverlapCrop {
  let reference_x = if dx < 0 { (-dx) as u32 } else { 0 };
  let rendered_x = if dx > 0 { dx as u32 } else { 0 };
  let reference_y = if dy < 0 { (-dy) as u32 } else { 0 };
  let rendered_y = if dy > 0 { dy as u32 } else { 0 };
  let width = reference_width
    .saturating_sub(reference_x)
    .min(rendered_width.saturating_sub(rendered_x));
  let height = reference_height
    .saturating_sub(reference_y)
    .min(rendered_height.saturating_sub(rendered_y));
  OverlapCrop {
    height,
    reference_x,
    reference_y,
    rendered_x,
    rendered_y,
    width,
  }
}

fn crop_rgba(image: &RgbaImage, x: u32, y: u32, width: u32, height: u32) -> RgbaImage {
  imageops::crop_imm(image, x, y, width, height).to_image()
}

fn gray_pixel(image: &GrayImage, x: u32, y: u32) -> f64 {
  image.get_pixel(x, y).0[0] as f64
}

fn normalized_rgba_distance_squared(reference: &[u8; 4], rendered: &[u8; 4]) -> f64 {
  let mut sum_squares = 0.0;
  for channel in 0..4 {
    let delta = reference[channel] as f64 - rendered[channel] as f64;
    sum_squares += delta * delta;
  }
  sum_squares / (4.0 * 255.0 * 255.0)
}

fn round_positive(value: f64) -> u32 {
  value.round().max(1.0) as u32
}

fn encode_dynamic_png(image: &DynamicImage) -> image::ImageResult<Vec<u8>> {
  let mut buffer = Vec::new();
  image.write_to(&mut Cursor::new(&mut buffer), ImageFormat::Png)?;
  Ok(buffer)
}

fn encode_rgba_png(image: &RgbaImage) -> VisualResult<Vec<u8>> {
  encode_dynamic_png(&DynamicImage::ImageRgba8(image.clone())).map_err(|error| {
    VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::ImageCompareError,
      error.to_string(),
    )
  })
}

#[cfg(test)]
fn png_data_url(bytes: &[u8]) -> String {
  format!("data:image/png;base64,{}", BASE64_STANDARD.encode(bytes))
}

fn invalid_image(kind: ImageKind) -> VisualEvaluationError {
  VisualEvaluationError::new(400, kind.invalid_code(), kind.invalid_message())
}

fn fetch_error(kind: ImageKind, message: impl Into<String>) -> VisualEvaluationError {
  VisualEvaluationError::new(502, kind.fetch_failed_code(), message)
}

fn image_operation_error(
  code: VisualEvaluationErrorCode,
  error: impl std::fmt::Display,
) -> VisualEvaluationError {
  VisualEvaluationError::new(500, code, error.to_string())
}

fn capitalize(value: &str) -> String {
  let mut chars = value.chars();
  match chars.next() {
    Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
    None => String::new(),
  }
}

impl ImageKind {
  fn label(self) -> &'static str {
    match self {
      ImageKind::Reference => "reference image",
    }
  }

  fn invalid_code(self) -> VisualEvaluationErrorCode {
    match self {
      ImageKind::Reference => VisualEvaluationErrorCode::ReferenceImageInvalid,
    }
  }

  fn fetch_failed_code(self) -> VisualEvaluationErrorCode {
    match self {
      ImageKind::Reference => VisualEvaluationErrorCode::ReferenceImageFetchFailed,
    }
  }

  fn invalid_message(self) -> &'static str {
    match self {
      ImageKind::Reference => "Reference image is empty, malformed, or unreadable.",
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[tokio::test]
  async fn loads_plain_base64_and_data_url_as_png() {
    let png = sample_png(Rgba([255, 0, 0, 255]));
    for input in [
      png_data_url(&png),
      BASE64_STANDARD.encode(&png),
      BASE64_STANDARD_NO_PAD.encode(&png),
    ] {
      let loaded = load_image(&input, ImageKind::Reference)
        .await
        .expect("load image");
      assert!(loaded.starts_with(&[0x89, b'P', b'N', b'G']));
    }
  }

  #[tokio::test]
  async fn rejects_malformed_base64_image() {
    let error = load_image("not an image", ImageKind::Reference)
      .await
      .expect_err("invalid image must fail");
    assert_eq!(error.code, VisualEvaluationErrorCode::ReferenceImageInvalid);
  }

  #[test]
  fn rejects_images_beyond_the_decoded_dimension_limit() {
    let oversized = RgbaImage::from_pixel(MAX_IMAGE_DIMENSION + 1, 1, Rgba([255, 255, 255, 255]));
    let png = encode_rgba_png(&oversized).expect("encode oversized fixture");

    let error =
      normalize_image_to_png(&png, ImageKind::Reference).expect_err("oversized image must fail");
    assert_eq!(error.code, VisualEvaluationErrorCode::ReferenceImageInvalid);
  }

  #[test]
  fn compares_identical_images() {
    let png = sample_png(Rgba([20, 40, 60, 255]));
    let output = compare_images(&png, &png, None).expect("compare images");
    assert_eq!(output.result.different_blocks, 0);
    assert_eq!(output.result.similarity, 1.0);
  }

  #[test]
  fn aligns_a_shifted_non_periodic_image() {
    let reference = alignment_pattern();
    let rendered = shifted_image(&reference, 3, 5);
    let options = VisualEvaluationAlignOptions {
      downsample_width: Some(64.0),
      max_dx: Some(8.0),
      max_dy_ratio: Some(0.2),
      min_score: Some(0.5),
      target_width: Some(64.0),
      top_skip_ratio: Some(0.0),
      window_height_ratio: Some(0.25),
    };

    let output = align_images(
      &encode_rgba_png(&reference).expect("encode reference"),
      &encode_rgba_png(&rendered).expect("encode rendered"),
      Some(&options),
    )
    .expect("align images");
    assert!(output.result.expect("alignment result").score >= 0.5);

    let comparison = compare_images(
      &output.aligned_reference_png,
      &output.aligned_rendered_png,
      None,
    )
    .expect("compare aligned images");
    assert_eq!(comparison.result.similarity, 1.0);
  }

  #[test]
  fn falls_back_to_original_images_when_alignment_confidence_is_too_low() {
    let reference = encode_rgba_png(&patterned_image(32, 32)).expect("encode reference");
    let rendered = encode_rgba_png(&patterned_image(32, 32)).expect("encode rendered");
    let options = VisualEvaluationAlignOptions {
      min_score: Some(2.0),
      ..VisualEvaluationAlignOptions::default()
    };

    let output = align_images(&reference, &rendered, Some(&options)).expect("align images");
    assert!(output.result.is_none());
    assert_eq!(output.aligned_reference_png, reference);
    assert_eq!(output.aligned_rendered_png, rendered);
  }

  #[test]
  fn reports_changed_edge_block_and_diff_pixel() {
    let reference = RgbaImage::from_pixel(33, 33, Rgba([0, 0, 0, 255]));
    let mut rendered = reference.clone();
    rendered.put_pixel(32, 32, Rgba([255, 255, 255, 255]));
    let options = VisualEvaluationCompareOptions {
      block_size: Some(32),
      pixel_tolerance: Some(0.0),
      threshold: Some(0.0),
    };

    let output = compare_images(
      &encode_rgba_png(&reference).expect("encode reference"),
      &encode_rgba_png(&rendered).expect("encode rendered"),
      Some(&options),
    )
    .expect("compare images");
    assert_eq!(output.result.total_blocks, 4);
    assert_eq!(output.result.different_blocks, 1);
    assert_eq!(output.result.similarity, 0.75);
    let diff = image::load_from_memory(&output.diff_png)
      .expect("decode diff")
      .to_rgba8();
    assert_eq!(diff.get_pixel(32, 32), &Rgba([255, 0, 0, 255]));
  }

  #[test]
  fn compares_raw_rgba_channels_including_fully_transparent_pixels() {
    let reference = sample_png(Rgba([255, 0, 0, 0]));
    let rendered = sample_png(Rgba([0, 255, 255, 0]));
    let output = compare_images(&reference, &rendered, None).expect("compare images");
    assert_eq!(output.result.similarity, 0.0);
  }

  #[tokio::test]
  async fn compares_a_reference_image_without_model_evaluation() {
    let png = sample_png(Rgba([20, 40, 60, 255]));
    let result = compare_reference_image(&png_data_url(&png), &png)
      .await
      .expect("compare reference image");

    assert_eq!(result.similarity, 1.0);
    assert_eq!(result.different_blocks, 0);
    assert_eq!(result.total_blocks, 1);
    assert!(!result.diff_image_base64.is_empty());
  }

  fn sample_png(color: Rgba<u8>) -> Vec<u8> {
    let mut image = RgbaImage::new(8, 8);
    for y in 0..8 {
      for x in 0..8 {
        image.put_pixel(x, y, color);
      }
    }
    encode_rgba_png(&image).expect("encode png")
  }

  fn patterned_image(width: u32, height: u32) -> RgbaImage {
    let mut image = RgbaImage::new(width, height);
    for y in 0..height {
      for x in 0..width {
        let value = ((x * 37 + y * 71 + x * y * 13) % 251) as u8;
        image.put_pixel(
          x,
          y,
          Rgba([value, value.wrapping_mul(3), value.wrapping_add(97), 255]),
        );
      }
    }
    image
  }

  fn alignment_pattern() -> RgbaImage {
    let mut image = RgbaImage::from_pixel(64, 64, Rgba([32, 32, 32, 255]));
    for y in 4..32 {
      for x in 0..64 {
        let value = ((x * 37 + y * 71 + x * y * 13) % 251) as u8;
        image.put_pixel(
          x,
          y,
          Rgba([value, value.wrapping_mul(3), value.wrapping_add(97), 255]),
        );
      }
    }
    image
  }

  fn shifted_image(source: &RgbaImage, dx: u32, dy: u32) -> RgbaImage {
    let mut shifted = RgbaImage::from_pixel(source.width(), source.height(), Rgba([0, 0, 0, 255]));
    for y in 0..source.height().saturating_sub(dy) {
      for x in 0..source.width().saturating_sub(dx) {
        shifted.put_pixel(x + dx, y + dy, *source.get_pixel(x, y));
      }
    }
    shifted
  }
}
