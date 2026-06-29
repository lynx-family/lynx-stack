use std::fs;
use std::path::Path;

pub fn write_png(path: &Path, width: usize, height: usize, rgba: &[u8]) -> std::io::Result<()> {
  let expected = width
    .checked_mul(height)
    .and_then(|pixels| pixels.checked_mul(4))
    .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidInput, "image too large"))?;
  if rgba.len() < expected {
    return Err(std::io::Error::new(
      std::io::ErrorKind::InvalidInput,
      "frame is smaller than expected",
    ));
  }

  let mut scanlines = Vec::with_capacity(height * (width * 4 + 1));
  for row in 0..height {
    scanlines.push(0);
    let start = row * width * 4;
    scanlines.extend_from_slice(&rgba[start..start + width * 4]);
  }

  let mut png = Vec::new();
  png.extend_from_slice(b"\x89PNG\r\n\x1a\n");

  let mut ihdr = Vec::with_capacity(13);
  ihdr.extend_from_slice(&(width as u32).to_be_bytes());
  ihdr.extend_from_slice(&(height as u32).to_be_bytes());
  ihdr.extend_from_slice(&[8, 6, 0, 0, 0]);
  write_chunk(&mut png, b"IHDR", &ihdr);
  write_chunk(&mut png, b"IDAT", &zlib_store(&scanlines));
  write_chunk(&mut png, b"IEND", &[]);

  fs::write(path, png)
}

fn zlib_store(data: &[u8]) -> Vec<u8> {
  let mut out = Vec::with_capacity(data.len() + data.len() / 65535 * 5 + 6);
  out.extend_from_slice(&[0x78, 0x01]);
  let mut remaining = data;
  while !remaining.is_empty() {
    let chunk_len = remaining.len().min(65_535);
    let final_block = chunk_len == remaining.len();
    out.push(if final_block { 1 } else { 0 });
    out.extend_from_slice(&(chunk_len as u16).to_le_bytes());
    out.extend_from_slice((!(chunk_len as u16)).to_le_bytes().as_slice());
    out.extend_from_slice(&remaining[..chunk_len]);
    remaining = &remaining[chunk_len..];
  }
  if data.is_empty() {
    out.extend_from_slice(&[1, 0, 0, 0xff, 0xff]);
  }
  out.extend_from_slice(&adler32(data).to_be_bytes());
  out
}

fn write_chunk(png: &mut Vec<u8>, kind: &[u8; 4], data: &[u8]) {
  png.extend_from_slice(&(data.len() as u32).to_be_bytes());
  png.extend_from_slice(kind);
  png.extend_from_slice(data);
  let mut crc_data = Vec::with_capacity(kind.len() + data.len());
  crc_data.extend_from_slice(kind);
  crc_data.extend_from_slice(data);
  png.extend_from_slice(&crc32(&crc_data).to_be_bytes());
}

fn adler32(data: &[u8]) -> u32 {
  const MOD: u32 = 65_521;
  let mut a = 1u32;
  let mut b = 0u32;
  for byte in data {
    a = (a + u32::from(*byte)) % MOD;
    b = (b + a) % MOD;
  }
  (b << 16) | a
}

fn crc32(data: &[u8]) -> u32 {
  let mut crc = 0xffff_ffffu32;
  for byte in data {
    crc ^= u32::from(*byte);
    for _ in 0..8 {
      let mask = 0u32.wrapping_sub(crc & 1);
      crc = (crc >> 1) ^ (0xedb8_8320 & mask);
    }
  }
  !crc
}
