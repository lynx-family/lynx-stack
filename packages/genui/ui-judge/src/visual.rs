// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

use std::io::Cursor;
use std::sync::{Arc, OnceLock};

use base64::prelude::{Engine, BASE64_STANDARD};
use image::codecs::{bmp::BmpDecoder, png::PngEncoder};
use image::imageops::{self, FilterType};
use image::{
  DynamicImage, ExtendedColorType, GrayImage, ImageDecoder, ImageEncoder, Limits, Rgba, RgbaImage,
};
use rayon::{ThreadPool, ThreadPoolBuilder};
use thiserror::Error;

pub(crate) const MAX_IMAGE_BYTES: usize = 10 * 1024 * 1024;
const MAX_DECODED_IMAGE_BYTES: u64 = 64 * 1024 * 1024;
const MAX_IMAGE_DIMENSION: u32 = 8_192;
const MAX_IMAGE_PIXELS: u64 = 8 * 1024 * 1024;

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
const MAX_VISUAL_WORKERS: usize = 4;

pub(crate) type VisualResult<T> = std::result::Result<T, VisualEvaluationError>;

#[derive(Debug, Clone)]
pub struct ReferenceImageComparison {
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
  ReferenceImageInvalid,
  RenderedImageInvalid,
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
  Rendered,
}

#[derive(Debug)]
struct AlignImagesOutput {
  aligned_reference: RgbaImage,
  aligned_rendered: RgbaImage,
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
  diff: RgbaImage,
  result: CompareResult,
}

#[derive(Debug, Clone)]
struct BlockStats {
  different_pixels: u32,
  pixels: u32,
}

fn visual_worker_count() -> usize {
  std::thread::available_parallelism()
    .map(usize::from)
    .unwrap_or(1)
    .min(MAX_VISUAL_WORKERS)
}

fn visual_worker_slots() -> Arc<tokio::sync::Semaphore> {
  static SLOTS: OnceLock<Arc<tokio::sync::Semaphore>> = OnceLock::new();
  Arc::clone(SLOTS.get_or_init(|| Arc::new(tokio::sync::Semaphore::new(visual_worker_count()))))
}

fn visual_worker_pool() -> VisualResult<&'static ThreadPool> {
  static POOL: OnceLock<std::result::Result<ThreadPool, String>> = OnceLock::new();
  match POOL.get_or_init(|| {
    ThreadPoolBuilder::new()
      .num_threads(visual_worker_count())
      .thread_name(|index| format!("ui-judge-visual-{index}"))
      .build()
      .map_err(|error| error.to_string())
  }) {
    Ok(pool) => Ok(pool),
    Err(error) => Err(VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::VisualEvaluationError,
      format!("Visual worker pool is unavailable: {error}"),
    )),
  }
}

/// Runs CPU-heavy post-capture image work on a bounded Rayon pool.
async fn run_visual_worker<T, F>(operation: &'static str, work: F) -> VisualResult<T>
where
  T: Send + 'static,
  F: FnOnce() -> VisualResult<T> + Send + 'static,
{
  run_visual_worker_with_slots(visual_worker_slots(), operation, work).await
}

async fn run_visual_worker_with_slots<T, F>(
  slots: Arc<tokio::sync::Semaphore>,
  operation: &'static str,
  work: F,
) -> VisualResult<T>
where
  T: Send + 'static,
  F: FnOnce() -> VisualResult<T> + Send + 'static,
{
  let permit = slots.acquire_owned().await.map_err(|error| {
    VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::VisualEvaluationError,
      format!("Visual {operation} worker pool is unavailable: {error}"),
    )
  })?;
  let pool = visual_worker_pool()?;
  let (result_sender, result_receiver) = tokio::sync::oneshot::channel();
  pool.spawn(move || {
    // The permit stays with the CPU work even if its async waiter is dropped.
    let result =
      std::panic::catch_unwind(std::panic::AssertUnwindSafe(work)).unwrap_or_else(|_| {
        Err(VisualEvaluationError::new(
          500,
          VisualEvaluationErrorCode::VisualEvaluationError,
          format!("Visual {operation} worker panicked."),
        ))
      });
    drop(permit);
    let _ = result_sender.send(result);
  });
  result_receiver.await.map_err(|_| {
    VisualEvaluationError::new(
      500,
      VisualEvaluationErrorCode::VisualEvaluationError,
      format!("Visual {operation} worker stopped before returning a result."),
    )
  })?
}

/// Compares two BMP uploads, returning similarity metrics and a base64 PNG diff.
pub async fn compare_uploaded_images(
  reference_image: &[u8],
  rendered_image: &[u8],
) -> VisualResult<ReferenceImageComparison> {
  if reference_image.len() > MAX_IMAGE_BYTES {
    return Err(invalid_image(ImageKind::Reference));
  }
  if rendered_image.len() > MAX_IMAGE_BYTES {
    return Err(invalid_image(ImageKind::Rendered));
  }
  let reference_image = reference_image.to_vec();
  let rendered_image = rendered_image.to_vec();
  run_visual_worker("comparison", move || {
    let reference = decode_bmp_with_limits(&reference_image, ImageKind::Reference)?;
    let rendered = decode_bmp_with_limits(&rendered_image, ImageKind::Rendered)?;
    let alignment = align_images(&reference, &rendered, None)?;
    let comparison = compare_images(
      &alignment.aligned_reference,
      &alignment.aligned_rendered,
      None,
    )?;

    let mut warnings = Vec::new();
    let align_result = alignment.result;
    if align_result.is_none() {
      warnings.push("Image alignment confidence too low; compared original images.".to_string());
    }
    let diff_image_base64 = BASE64_STANDARD.encode(encode_rgba_png(&comparison.diff)?);
    Ok(ReferenceImageComparison {
      alignment_score: align_result.map(|alignment| alignment.score),
      diff_image_base64,
      different_blocks: comparison.result.different_blocks,
      similarity: comparison.result.similarity,
      total_blocks: comparison.result.total_blocks,
      warnings,
    })
  })
  .await
}

fn decode_bmp_with_limits(buffer: &[u8], kind: ImageKind) -> VisualResult<RgbaImage> {
  // Select the BMP decoder directly: never infer a codec from upload metadata.
  let mut decoder = BmpDecoder::new(Cursor::new(buffer)).map_err(|_| invalid_image(kind))?;
  let (width, height) = decoder.dimensions();
  let pixels = u64::from(width).saturating_mul(u64::from(height));
  if width == 0
    || height == 0
    || width > MAX_IMAGE_DIMENSION
    || height > MAX_IMAGE_DIMENSION
    || pixels > MAX_IMAGE_PIXELS
  {
    return Err(invalid_image(kind));
  }

  let mut limits = Limits::default();
  limits.max_image_width = Some(MAX_IMAGE_DIMENSION);
  limits.max_image_height = Some(MAX_IMAGE_DIMENSION);
  limits.max_alloc = Some(MAX_DECODED_IMAGE_BYTES);
  // BmpDecoder's default limits only check dimensions. Reserve both the decoded
  // buffer and RGBA conversion before allocating either of them.
  limits
    .reserve(decoder.total_bytes() + pixels * 4)
    .map_err(|_| invalid_image(kind))?;
  decoder
    .set_limits(limits)
    .map_err(|_| invalid_image(kind))?;
  DynamicImage::from_decoder(decoder)
    .map(DynamicImage::into_rgba8)
    .map_err(|_| invalid_image(kind))
}

fn align_images(
  reference: &RgbaImage,
  rendered: &RgbaImage,
  options: Option<&VisualEvaluationAlignOptions>,
) -> VisualResult<AlignImagesOutput> {
  let reference_width = reference.width();
  let rendered_width = rendered.width();
  if reference_width == 0 || rendered_width == 0 {
    return Ok(AlignImagesOutput {
      aligned_reference: reference.clone(),
      aligned_rendered: rendered.clone(),
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
  let resized_reference = resize_to_width(reference, target_width)?;
  let resized_rendered = resize_to_width(rendered, target_width)?;
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
  )?;
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
  )?;
  if best_candidate
    .as_ref()
    .is_none_or(|candidate| candidate.score < options.min_score.unwrap_or(DEFAULT_MIN_SCORE))
  {
    return Ok(AlignImagesOutput {
      aligned_reference: reference.clone(),
      aligned_rendered: rendered.clone(),
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
      aligned_reference: reference.clone(),
      aligned_rendered: rendered.clone(),
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
    aligned_reference,
    aligned_rendered,
    result: Some(AlignResult {
      score: best_candidate.score,
    }),
  })
}

fn compare_images(
  reference: &RgbaImage,
  rendered: &RgbaImage,
  options: Option<&VisualEvaluationCompareOptions>,
) -> VisualResult<CompareImagesOutput> {
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
  let reference = resize_to_exact_rgba(reference, width, height);
  let rendered = resize_to_exact_rgba(rendered, width, height);
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
    diff,
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

fn resize_to_width(image: &RgbaImage, width: u32) -> VisualResult<ResizedImage> {
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

fn resize_to_exact_rgba(image: &RgbaImage, width: u32, height: u32) -> RgbaImage {
  imageops::resize(image, width, height, FilterType::Lanczos3)
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
) -> VisualResult<u32> {
  let window_height = get_window_height(image.height(), window_height_ratio);
  let min_y = (image.height() - window_height)
    .min((image.height() as f64 * top_skip_ratio).floor().max(0.0) as u32);
  let step = (window_height / 4).max(1);
  let mut best_variance = f64::NEG_INFINITY;
  let mut best_y = min_y;
  let max_y = image.height() - window_height;
  let mut y = min_y;
  while y <= max_y {
    let variance = window_variance(image, y, window_height)?;
    if variance > best_variance {
      best_variance = variance;
      best_y = y;
    }
    y = y.saturating_add(step);
    if step == 0 {
      break;
    }
  }
  Ok(best_y)
}

fn get_window_height(height: u32, ratio: f64) -> u32 {
  ((height as f64 * ratio).round() as u32).clamp(1, height.max(1))
}

fn window_variance(image: &GrayImage, y: u32, window_height: u32) -> VisualResult<f64> {
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
    return Ok(0.0);
  }
  let mean = sum / count;
  Ok(sum_squares / count - mean * mean)
}

fn find_best_offset(
  reference: &GrayImage,
  rendered: &GrayImage,
  window_y: u32,
  window_height: u32,
  max_dx: i32,
  max_dy: i32,
) -> VisualResult<Option<CandidateScore>> {
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
      )?;
      if best
        .as_ref()
        .is_none_or(|candidate: &CandidateScore| score > candidate.score)
      {
        best = Some(CandidateScore { dx, dy, score });
      }
    }
  }
  Ok(best)
}

fn normalized_cross_correlation(
  reference: &GrayImage,
  rendered: &GrayImage,
  reference_y: u32,
  rendered_y: u32,
  window_height: u32,
  dx: i32,
) -> VisualResult<f64> {
  let reference_x = if dx < 0 { (-dx) as u32 } else { 0 };
  let rendered_x = if dx > 0 { dx as u32 } else { 0 };
  if reference_x >= reference.width() || rendered_x >= rendered.width() {
    return Ok(f64::NEG_INFINITY);
  }
  let width = (reference.width() - reference_x).min(rendered.width() - rendered_x);
  if width == 0 {
    return Ok(f64::NEG_INFINITY);
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
    return Ok(f64::NEG_INFINITY);
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
    Ok(0.0)
  } else {
    Ok(covariance / denominator)
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

fn encode_rgba_png(image: &RgbaImage) -> VisualResult<Vec<u8>> {
  let mut buffer = Vec::new();
  PngEncoder::new(&mut buffer)
    .write_image(
      image.as_raw(),
      image.width(),
      image.height(),
      ExtendedColorType::Rgba8,
    )
    .map_err(|error| image_operation_error(VisualEvaluationErrorCode::ImageCompareError, error))?;
  Ok(buffer)
}

fn invalid_image(kind: ImageKind) -> VisualEvaluationError {
  VisualEvaluationError::new(400, kind.invalid_code(), kind.invalid_message())
}

fn image_operation_error(
  code: VisualEvaluationErrorCode,
  error: impl std::fmt::Display,
) -> VisualEvaluationError {
  VisualEvaluationError::new(500, code, error.to_string())
}

impl ImageKind {
  fn invalid_code(self) -> VisualEvaluationErrorCode {
    match self {
      ImageKind::Reference => VisualEvaluationErrorCode::ReferenceImageInvalid,
      ImageKind::Rendered => VisualEvaluationErrorCode::RenderedImageInvalid,
    }
  }

  fn invalid_message(self) -> &'static str {
    match self {
      ImageKind::Reference => "Reference image must be a valid BMP within the image limits.",
      ImageKind::Rendered => "Rendered image must be a valid BMP within the image limits.",
    }
  }
}

#[cfg(test)]
mod tests {
  use std::time::Duration;

  use image::codecs::bmp::BmpEncoder;

  use super::*;

  #[test]
  fn rejects_images_beyond_the_decoded_dimension_limit() {
    let oversized = RgbaImage::from_pixel(MAX_IMAGE_DIMENSION + 1, 1, Rgba([255, 255, 255, 255]));
    let bmp = encode_bmp(&oversized);

    let error =
      decode_bmp_with_limits(&bmp, ImageKind::Reference).expect_err("oversized image must fail");
    assert_eq!(error.code, VisualEvaluationErrorCode::ReferenceImageInvalid);
  }

  #[test]
  fn rejects_bmp_headers_beyond_the_decoded_pixel_limit_before_reading_pixels() {
    let mut bmp = encode_bmp(&sample_image(Rgba([20, 40, 60, 255])));
    bmp[18..22].copy_from_slice(&4096_i32.to_le_bytes());
    bmp[22..26].copy_from_slice(&4096_i32.to_le_bytes());

    let error = decode_bmp_with_limits(&bmp, ImageKind::Rendered)
      .expect_err("oversized pixel buffer must fail");
    assert_eq!(error.code, VisualEvaluationErrorCode::RenderedImageInvalid);
  }

  #[test]
  fn compares_identical_images() {
    let pixels = sample_image(Rgba([20, 40, 60, 255]));
    let output = compare_images(&pixels, &pixels, None).expect("compare images");
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

    let output = align_images(&reference, &rendered, Some(&options)).expect("align images");
    assert!(output.result.expect("alignment result").score >= 0.5);

    let comparison = compare_images(&output.aligned_reference, &output.aligned_rendered, None)
      .expect("compare aligned images");
    assert_eq!(comparison.result.similarity, 1.0);
  }

  #[test]
  fn falls_back_to_original_images_when_alignment_confidence_is_too_low() {
    let reference = patterned_image(32, 32);
    let rendered = patterned_image(32, 32);
    let options = VisualEvaluationAlignOptions {
      min_score: Some(2.0),
      ..VisualEvaluationAlignOptions::default()
    };

    let output = align_images(&reference, &rendered, Some(&options)).expect("align images");
    assert!(output.result.is_none());
    assert_eq!(output.aligned_reference, reference);
    assert_eq!(output.aligned_rendered, rendered);
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

    let output = compare_images(&reference, &rendered, Some(&options)).expect("compare images");
    assert_eq!(output.result.total_blocks, 4);
    assert_eq!(output.result.different_blocks, 1);
    assert_eq!(output.result.similarity, 0.75);
    assert_eq!(output.diff.get_pixel(32, 32), &Rgba([255, 0, 0, 255]));
  }

  #[tokio::test]
  async fn compares_raw_bmp_rgba_channels_including_fully_transparent_pixels() {
    let reference = encode_bmp(&sample_image(Rgba([255, 0, 0, 0])));
    let rendered = encode_bmp(&sample_image(Rgba([0, 255, 255, 0])));
    let output = compare_uploaded_images(&reference, &rendered)
      .await
      .expect("compare BMP images");
    assert_eq!(output.similarity, 0.0);
  }

  #[tokio::test]
  async fn compares_two_uploaded_images_without_model_evaluation() {
    let bmp = encode_bmp(&sample_image(Rgba([20, 40, 60, 255])));
    let result = compare_uploaded_images(&bmp, &bmp)
      .await
      .expect("compare uploaded images");

    assert_eq!(result.similarity, 1.0);
    assert_eq!(result.different_blocks, 0);
    assert_eq!(result.total_blocks, 1);
    assert!(BASE64_STANDARD
      .decode(result.diff_image_base64)
      .expect("base64 diff")
      .starts_with(b"\x89PNG\r\n\x1a\n"));
  }

  #[tokio::test]
  async fn rejects_png_in_either_upload() {
    let pixels = sample_image(Rgba([20, 40, 60, 255]));
    let bmp = encode_bmp(&pixels);
    let png = encode_rgba_png(&pixels).expect("encode non-BMP fixture");
    for (reference, rendered, code) in [
      (&png, &bmp, VisualEvaluationErrorCode::ReferenceImageInvalid),
      (&bmp, &png, VisualEvaluationErrorCode::RenderedImageInvalid),
    ] {
      let error = compare_uploaded_images(reference, rendered)
        .await
        .expect_err("PNG uploads must fail");
      assert_eq!(error.status, 400);
      assert_eq!(error.code, code);
      assert!(error.message.contains("BMP"));
    }
  }

  #[tokio::test]
  async fn identifies_an_invalid_rendered_upload() {
    let bmp = encode_bmp(&sample_image(Rgba([20, 40, 60, 255])));
    let error = compare_uploaded_images(&bmp, b"not an image")
      .await
      .expect_err("invalid rendered image must fail");

    assert_eq!(error.code, VisualEvaluationErrorCode::RenderedImageInvalid);
  }

  #[tokio::test]
  async fn a_panicking_worker_becomes_an_error_and_releases_capacity() {
    let slots = Arc::new(tokio::sync::Semaphore::new(1));
    let error = run_visual_worker_with_slots(Arc::clone(&slots), "test", || -> VisualResult<()> {
      panic!("worker failure")
    })
    .await
    .expect_err("worker panic must become an error");

    assert_eq!(error.code, VisualEvaluationErrorCode::VisualEvaluationError);
    assert!(error.message.contains("panicked"));
    assert_eq!(slots.available_permits(), 1);
  }

  #[tokio::test(flavor = "current_thread")]
  async fn dropping_a_waiter_does_not_overbook_the_worker_pool() {
    let slots = Arc::new(tokio::sync::Semaphore::new(1));
    let (started_sender, started_receiver) = tokio::sync::oneshot::channel();
    let (release_sender, release_receiver) = std::sync::mpsc::channel();
    let first = tokio::spawn(run_visual_worker_with_slots(
      Arc::clone(&slots),
      "test",
      move || {
        let _ = started_sender.send(());
        release_receiver.recv().expect("release the Rayon worker");
        Ok(())
      },
    ));
    started_receiver.await.expect("start the Rayon worker");

    first.abort();
    let _ = first.await;
    assert!(
      Arc::clone(&slots).try_acquire_owned().is_err(),
      "the abandoned CPU job must retain its permit"
    );

    release_sender.send(()).expect("finish the Rayon worker");
    let permit = tokio::time::timeout(Duration::from_secs(1), slots.acquire_owned())
      .await
      .expect("the worker must eventually release capacity")
      .expect("the semaphore must stay open");
    drop(permit);
  }

  fn sample_image(color: Rgba<u8>) -> RgbaImage {
    RgbaImage::from_pixel(8, 8, color)
  }

  fn encode_bmp(image: &RgbaImage) -> Vec<u8> {
    let mut buffer = Vec::new();
    BmpEncoder::new(&mut buffer)
      .encode(
        image.as_raw(),
        image.width(),
        image.height(),
        ExtendedColorType::Rgba8,
      )
      .expect("encode BMP fixture");
    buffer
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
