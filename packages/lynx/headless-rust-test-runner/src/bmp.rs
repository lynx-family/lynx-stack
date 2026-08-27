//! Windows BMP encoding for presented software frames.
//!
//! The software renderer already hands us straight RGBA bytes, so a BMP is a
//! header plus a channel swap. Writing it inline on the calling thread keeps
//! screenshots free of the worker pool, permit accounting, and async plumbing
//! that a compressing encoder needed.

use crate::{Error, Result};

const FILE_HEADER_LEN: usize = 14;
const INFO_HEADER_LEN: usize = 108;
const PIXEL_OFFSET: usize = FILE_HEADER_LEN + INFO_HEADER_LEN;
const BI_BITFIELDS: u32 = 3;
const LCS_S_RGB: u32 = 0x7352_4742;
const PIXELS_PER_METER: i32 = 2835;

/// Encodes RGBA pixels as a top-down 32-bit BMP with an explicit alpha mask.
///
/// A `BITMAPV4HEADER` with `BI_BITFIELDS` is the only widely decodable BMP
/// variant that preserves alpha: readers drop the fourth channel of a plain
/// `BI_RGB` 32-bit bitmap.
pub(crate) fn encode(width: usize, height: usize, rgba: &[u8]) -> Result<Vec<u8>> {
  let pixels = width
    .checked_mul(height)
    .ok_or_else(|| Error::Protocol("frame is too large".into()))?;
  let expected = pixels
    .checked_mul(4)
    .ok_or_else(|| Error::Protocol("frame is too large".into()))?;
  if rgba.len() < expected {
    return Err(Error::Protocol("frame buffer is too small".into()));
  }
  let file_len = PIXEL_OFFSET
    .checked_add(expected)
    .ok_or_else(|| Error::Protocol("frame is too large".into()))?;
  let width = i32::try_from(width)
    .map_err(|_| Error::Protocol(format!("frame width {width} exceeds the BMP limit")))?;
  let height = i32::try_from(height)
    .map_err(|_| Error::Protocol(format!("frame height {height} exceeds the BMP limit")))?;
  let file_len_field = u32::try_from(file_len)
    .map_err(|_| Error::Protocol(format!("frame of {file_len} bytes exceeds the BMP limit")))?;

  let mut output = Vec::with_capacity(file_len);
  output.extend_from_slice(b"BM");
  output.extend_from_slice(&file_len_field.to_le_bytes());
  output.extend_from_slice(&0_u32.to_le_bytes());
  output.extend_from_slice(&(PIXEL_OFFSET as u32).to_le_bytes());

  output.extend_from_slice(&(INFO_HEADER_LEN as u32).to_le_bytes());
  output.extend_from_slice(&width.to_le_bytes());
  // A negative height marks the rows as top-down, matching the presented frame.
  output.extend_from_slice(&(-height).to_le_bytes());
  output.extend_from_slice(&1_u16.to_le_bytes());
  output.extend_from_slice(&32_u16.to_le_bytes());
  output.extend_from_slice(&BI_BITFIELDS.to_le_bytes());
  output.extend_from_slice(&(expected as u32).to_le_bytes());
  output.extend_from_slice(&PIXELS_PER_METER.to_le_bytes());
  output.extend_from_slice(&PIXELS_PER_METER.to_le_bytes());
  output.extend_from_slice(&0_u32.to_le_bytes());
  output.extend_from_slice(&0_u32.to_le_bytes());
  output.extend_from_slice(&0x00FF_0000_u32.to_le_bytes());
  output.extend_from_slice(&0x0000_FF00_u32.to_le_bytes());
  output.extend_from_slice(&0x0000_00FF_u32.to_le_bytes());
  output.extend_from_slice(&0xFF00_0000_u32.to_le_bytes());
  output.extend_from_slice(&LCS_S_RGB.to_le_bytes());
  output.extend_from_slice(&[0_u8; 36]);
  output.extend_from_slice(&0_u32.to_le_bytes());
  output.extend_from_slice(&0_u32.to_le_bytes());
  output.extend_from_slice(&0_u32.to_le_bytes());

  for pixel in rgba[..expected].chunks_exact(4) {
    output.extend_from_slice(&[pixel[2], pixel[1], pixel[0], pixel[3]]);
  }
  Ok(output)
}

/// A decoded top-down 32-bit BMP.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Bitmap {
  pub width: usize,
  pub height: usize,
  pub rgba: Vec<u8>,
}

/// Decodes the BMP variant produced by [`encode`].
///
/// This is deliberately narrow: it reads back screenshots this crate wrote
/// instead of accepting arbitrary BMP files.
pub fn decode(bytes: &[u8]) -> Result<Bitmap> {
  if bytes.len() < PIXEL_OFFSET || &bytes[0..2] != b"BM" {
    return Err(Error::Protocol("screenshot is not a BMP file".into()));
  }
  let pixel_offset = read_u32(bytes, 10)? as usize;
  let info_header_len = read_u32(bytes, 14)?;
  let width = read_i32(bytes, 18)?;
  let raw_height = read_i32(bytes, 22)?;
  let bit_count = u16::from_le_bytes([bytes[28], bytes[29]]);
  let compression = read_u32(bytes, 30)?;
  if info_header_len < INFO_HEADER_LEN as u32
    || bit_count != 32
    || compression != BI_BITFIELDS
    || raw_height >= 0
  {
    return Err(Error::Protocol(format!(
      "unsupported BMP layout: header={info_header_len} bits={bit_count} compression={compression} height={raw_height}"
    )));
  }
  let width =
    usize::try_from(width).map_err(|_| Error::Protocol("BMP width is negative".into()))?;
  let height = usize::try_from(-(raw_height as i64))
    .map_err(|_| Error::Protocol("BMP height is out of range".into()))?;
  let expected = width
    .checked_mul(height)
    .and_then(|pixels| pixels.checked_mul(4))
    .ok_or_else(|| Error::Protocol("BMP dimensions are too large".into()))?;
  let pixels = bytes
    .get(pixel_offset..pixel_offset + expected)
    .ok_or_else(|| Error::Protocol("BMP pixel data is truncated".into()))?;
  let mut rgba = Vec::with_capacity(expected);
  for pixel in pixels.chunks_exact(4) {
    rgba.extend_from_slice(&[pixel[2], pixel[1], pixel[0], pixel[3]]);
  }
  Ok(Bitmap {
    width,
    height,
    rgba,
  })
}

fn read_u32(bytes: &[u8], offset: usize) -> Result<u32> {
  bytes
    .get(offset..offset + 4)
    .and_then(|slice| slice.try_into().ok())
    .map(u32::from_le_bytes)
    .ok_or_else(|| Error::Protocol("BMP header is truncated".into()))
}

fn read_i32(bytes: &[u8], offset: usize) -> Result<i32> {
  read_u32(bytes, offset).map(|value| value as i32)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn round_trips_rgba_pixels_through_the_bmp_layout() {
    let rgba = vec![
      255, 0, 0, 255, // red
      0, 255, 0, 128, // half-transparent green
      0, 0, 255, 255, // blue
      1, 2, 3, 0, // fully transparent
    ];
    let encoded = encode(2, 2, &rgba).expect("encode BMP");

    assert_eq!(&encoded[0..2], b"BM");
    assert_eq!(encoded.len(), PIXEL_OFFSET + rgba.len());
    // The blue channel is written first, and alpha survives the round trip.
    assert_eq!(&encoded[PIXEL_OFFSET..PIXEL_OFFSET + 4], &[0, 0, 255, 255]);

    let decoded = decode(&encoded).expect("decode BMP");
    assert_eq!(decoded.width, 2);
    assert_eq!(decoded.height, 2);
    assert_eq!(decoded.rgba, rgba);
  }

  #[test]
  fn rejects_a_frame_buffer_shorter_than_its_dimensions() {
    let error = encode(4, 4, &[0; 16]).expect_err("short buffer must fail");
    assert!(error.to_string().contains("frame buffer is too small"));
  }

  #[test]
  fn rejects_input_that_this_crate_did_not_write() {
    assert!(decode(b"not a bitmap").is_err());
    let mut encoded = encode(1, 1, &[0, 0, 0, 255]).expect("encode BMP");
    encoded[28] = 24;
    assert!(decode(&encoded).is_err());
  }
}
