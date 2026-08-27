// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

//! Conversion between the runner's BMP frames and the JPEG that leaves the
//! crate.
//!
//! The headless runner emits an uncompressed BMP because encoding one costs a
//! header write. Everything inside UI Judge keeps that lossless copy — the
//! deterministic reference comparison depends on exact pixels — while every
//! byte that leaves the process is JPEG, because vision models and the HTTP
//! screenshot route both need a format they can actually read.

use std::io::Cursor;

use base64::prelude::{Engine, BASE64_STANDARD};
use image::codecs::jpeg::JpegEncoder;
use image::{ImageFormat, RgbImage, RgbaImage};

const JPEG_QUALITY: u8 = 90;

/// Transcodes a captured BMP frame to JPEG.
///
/// JPEG has no alpha channel, so transparent pixels are composited over white:
/// that is how a screenshot of a partly transparent page is normally viewed,
/// and it keeps a light UI from arriving at the model as a black rectangle.
pub(crate) fn bmp_to_jpeg(bmp: &[u8]) -> Result<Vec<u8>, String> {
  let decoded = image::load_from_memory_with_format(bmp, ImageFormat::Bmp)
    .map_err(|error| format!("failed to decode the captured screenshot: {error}"))?;
  encode_jpeg(&flatten_onto_white(decoded.to_rgba8()))
}

fn flatten_onto_white(rgba: RgbaImage) -> RgbImage {
  let (width, height) = rgba.dimensions();
  let mut flattened = RgbImage::new(width, height);
  for (source, target) in rgba.pixels().zip(flattened.pixels_mut()) {
    let alpha = f32::from(source[3]) / 255.0;
    for channel in 0..3 {
      let value = f32::from(source[channel]) * alpha + 255.0 * (1.0 - alpha);
      target[channel] = value.round().clamp(0.0, 255.0) as u8;
    }
  }
  flattened
}

fn encode_jpeg(image: &RgbImage) -> Result<Vec<u8>, String> {
  let mut output = Cursor::new(Vec::new());
  JpegEncoder::new_with_quality(&mut output, JPEG_QUALITY)
    .encode_image(image)
    .map_err(|error| format!("failed to encode the screenshot as JPEG: {error}"))?;
  Ok(output.into_inner())
}

pub(crate) fn jpeg_data_url(jpeg: &[u8]) -> String {
  format!("data:image/jpeg;base64,{}", BASE64_STANDARD.encode(jpeg))
}

#[cfg(test)]
mod tests {
  use super::*;
  use image::{DynamicImage, Rgba};

  fn sample_bmp(color: Rgba<u8>) -> Vec<u8> {
    let image = DynamicImage::ImageRgba8(RgbaImage::from_pixel(8, 8, color));
    let mut bmp = Vec::new();
    image
      .write_to(&mut Cursor::new(&mut bmp), ImageFormat::Bmp)
      .expect("encode sample BMP");
    bmp
  }

  #[test]
  fn transcodes_an_opaque_frame_and_keeps_its_color() {
    let jpeg = bmp_to_jpeg(&sample_bmp(Rgba([20, 40, 60, 255]))).expect("transcode BMP");
    assert_eq!(&jpeg[0..2], &[0xFF, 0xD8], "JPEG start-of-image marker");

    let decoded = image::load_from_memory(&jpeg)
      .expect("decode the JPEG")
      .to_rgb8();
    assert_eq!(decoded.dimensions(), (8, 8));
    let pixel = decoded.get_pixel(4, 4);
    assert!(
      pixel[0].abs_diff(20) < 8 && pixel[1].abs_diff(40) < 8 && pixel[2].abs_diff(60) < 8,
      "unexpected color after transcoding: {pixel:?}"
    );
  }

  #[test]
  fn composites_transparent_pixels_over_white() {
    let jpeg = bmp_to_jpeg(&sample_bmp(Rgba([0, 0, 0, 0]))).expect("transcode BMP");
    let decoded = image::load_from_memory(&jpeg)
      .expect("decode the JPEG")
      .to_rgb8();
    let pixel = decoded.get_pixel(4, 4);
    assert!(
      pixel.0.iter().all(|channel| *channel > 245),
      "a fully transparent frame must not become black: {pixel:?}"
    );
  }

  #[test]
  fn rejects_bytes_that_are_not_a_captured_frame() {
    let error = bmp_to_jpeg(b"not a bitmap").expect_err("invalid input must fail");
    assert!(error.contains("failed to decode the captured screenshot"));
  }

  #[test]
  fn data_urls_declare_the_jpeg_media_type() {
    assert!(jpeg_data_url(&[0xFF, 0xD8]).starts_with("data:image/jpeg;base64,"));
  }
}
