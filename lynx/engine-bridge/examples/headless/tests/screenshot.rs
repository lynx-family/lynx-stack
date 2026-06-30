use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const REACT_BUNDLE_NAME: &str = "main.lynx.bundle";
const REACT_REFERENCE_NAME: &str = "main.lynx.snapshot.png";
#[cfg(target_os = "macos")]
const CHANNEL_TOLERANCE: u8 = 12;
#[cfg(target_os = "macos")]
const MAX_DIFFERENT_PIXEL_RATIO: f64 = 0.35;
#[cfg(target_os = "macos")]
const MAX_MEAN_CHANNEL_DELTA: f64 = 8.0;

#[test]
#[cfg(target_os = "macos")]
fn react_fixture_render_matches_reference_png() {
  if std::env::var_os("LYNX_SDK_DIR").is_none() && std::env::var_os("LYNX_LIB_PATH").is_none() {
    eprintln!("skipping headless render test; set LYNX_SDK_DIR or LYNX_LIB_PATH to libLynx_clay");
    return;
  }

  let manifest_dir = Path::new(env!("CARGO_MANIFEST_DIR"));
  let repo_root = manifest_dir
    .join("../../../..")
    .canonicalize()
    .expect("canonicalize repository root");
  let react_fixture_dir = repo_root.join("packages/genui/ui-judge/tests/fixtures/react");
  let react_dist_dir = react_fixture_dir.join(".generated");
  let bundle = react_dist_dir.join(REACT_BUNDLE_NAME);
  let reference = react_fixture_dir.join(REACT_REFERENCE_NAME);
  assert!(
    bundle.is_file(),
    "missing React fixture bundle: {}; build or restore the checked-in fixture output",
    bundle.display()
  );

  let executable = PathBuf::from(env!("CARGO_BIN_EXE_lynx-headless-example"));
  install_lynx_resources_bundle(manifest_dir, &executable);

  let actual = std::env::temp_dir().join(format!(
    "lynx-react-fixture-{}-{}.png",
    std::process::id(),
    thread_id()
  ));

  let output = Command::new(&executable)
    .arg("--native-ui-loop")
    .arg("--bundle")
    .arg(&bundle)
    .arg("--asset-root")
    .arg(&react_dist_dir)
    .arg("--asset-root")
    .arg(react_fixture_dir.join("src/assets"))
    .arg("--timeout-ms")
    .arg("30000")
    .arg("--screenshot")
    .arg(&actual)
    .output()
    .expect("run headless renderer");
  assert!(
    output.status.success(),
    "headless renderer failed with status {:?}\nstdout:\n{}\nstderr:\n{}",
    output.status.code(),
    String::from_utf8_lossy(&output.stdout),
    String::from_utf8_lossy(&output.stderr)
  );

  if std::env::var_os("LYNX_UPDATE_REFERENCES").is_some() {
    fs::create_dir_all(&react_fixture_dir).expect("create reference directory");
    fs::copy(&actual, &reference).expect("update reference screenshot");
    return;
  }

  assert_pngs_are_similar(&actual, &reference);
}

#[test]
#[cfg(not(target_os = "macos"))]
fn react_fixture_render_matches_reference_png() {
  eprintln!("skipping headless render test; libLynx_clay fixture is currently macOS-only");
}

#[cfg(target_os = "macos")]
fn install_lynx_resources_bundle(manifest_dir: &Path, executable: &Path) {
  let source = manifest_dir
    .join("tests/fixtures/LynxResources.bundle")
    .canonicalize()
    .expect("canonicalize LynxResources.bundle fixture");
  let destination = executable
    .parent()
    .expect("headless executable has parent directory")
    .join("LynxResources.bundle");
  if destination.exists() {
    fs::remove_dir_all(&destination).expect("remove stale LynxResources.bundle");
  }
  copy_dir_all(&source, &destination).expect("copy LynxResources.bundle beside headless binary");
}

#[cfg(target_os = "macos")]
fn copy_dir_all(source: &Path, destination: &Path) -> std::io::Result<()> {
  fs::create_dir_all(destination)?;
  for entry in fs::read_dir(source)? {
    let entry = entry?;
    let file_type = entry.file_type()?;
    let destination_path = destination.join(entry.file_name());
    if file_type.is_dir() {
      copy_dir_all(&entry.path(), &destination_path)?;
    } else {
      fs::copy(entry.path(), destination_path)?;
    }
  }
  Ok(())
}

#[cfg(target_os = "macos")]
fn assert_pngs_are_similar(actual: &Path, reference: &Path) {
  let actual_bytes = fs::read(actual).expect("read actual screenshot");
  assert!(
    actual_bytes.len() > 100,
    "rendered screenshot is unexpectedly small"
  );

  let actual_image = decode_png_rgba(&actual_bytes)
    .unwrap_or_else(|error| panic!("decode actual screenshot {}: {error}", actual.display()));
  let reference_bytes = fs::read(reference).expect("read reference screenshot");
  let reference_image = decode_png_rgba(&reference_bytes).unwrap_or_else(|error| {
    panic!(
      "decode reference screenshot {}: {error}",
      reference.display()
    )
  });

  assert_eq!(
    (actual_image.width, actual_image.height),
    (reference_image.width, reference_image.height),
    "React fixture screenshot dimensions changed; inspect {actual} and update {reference} intentionally with LYNX_UPDATE_REFERENCES=1",
    actual = actual.display(),
    reference = reference.display()
  );

  let pixel_count = actual_image.width * actual_image.height;
  let mut different_pixels = 0usize;
  let mut total_channel_delta = 0u64;
  let mut max_channel_delta = 0u8;

  for (actual_pixel, reference_pixel) in actual_image
    .rgba
    .chunks_exact(4)
    .zip(reference_image.rgba.chunks_exact(4))
  {
    let mut pixel_delta = 0u8;
    for (actual_channel, reference_channel) in actual_pixel.iter().zip(reference_pixel) {
      let delta = actual_channel.abs_diff(*reference_channel);
      pixel_delta = pixel_delta.max(delta);
      max_channel_delta = max_channel_delta.max(delta);
      total_channel_delta += u64::from(delta);
    }
    if pixel_delta > CHANNEL_TOLERANCE {
      different_pixels += 1;
    }
  }

  let different_ratio = different_pixels as f64 / pixel_count as f64;
  let mean_channel_delta = total_channel_delta as f64 / (pixel_count as f64 * 4.0);

  assert!(
    different_ratio <= MAX_DIFFERENT_PIXEL_RATIO && mean_channel_delta <= MAX_MEAN_CHANNEL_DELTA,
    "React fixture rendering changed: {different_pixels}/{pixel_count} pixels ({different_percent:.2}%) differ above channel tolerance {CHANNEL_TOLERANCE}; mean channel delta {mean_channel_delta:.2}; max channel delta {max_channel_delta}; inspect {actual} and update {reference} intentionally with LYNX_UPDATE_REFERENCES=1",
    different_percent = different_ratio * 100.0,
    actual = actual.display(),
    reference = reference.display()
  );
}

#[cfg(target_os = "macos")]
struct PngImage {
  width: usize,
  height: usize,
  rgba: Vec<u8>,
}

#[cfg(target_os = "macos")]
fn decode_png_rgba(bytes: &[u8]) -> Result<PngImage, String> {
  const PNG_SIGNATURE: &[u8; 8] = b"\x89PNG\r\n\x1a\n";
  if !bytes.starts_with(PNG_SIGNATURE) {
    return Err("invalid PNG signature".into());
  }

  let mut cursor = PNG_SIGNATURE.len();
  let mut width = None;
  let mut height = None;
  let mut idat = Vec::new();
  let mut saw_iend = false;

  while cursor < bytes.len() {
    if cursor + 8 > bytes.len() {
      return Err("truncated PNG chunk header".into());
    }
    let chunk_len = u32::from_be_bytes(bytes[cursor..cursor + 4].try_into().unwrap()) as usize;
    let chunk_type = &bytes[cursor + 4..cursor + 8];
    let data_start = cursor + 8;
    let data_end = data_start
      .checked_add(chunk_len)
      .ok_or_else(|| "PNG chunk length overflow".to_string())?;
    let next_chunk = data_end
      .checked_add(4)
      .ok_or_else(|| "PNG chunk CRC overflow".to_string())?;
    if next_chunk > bytes.len() {
      return Err("truncated PNG chunk data".into());
    }

    let data = &bytes[data_start..data_end];
    match chunk_type {
      b"IHDR" => {
        if data.len() != 13 {
          return Err("invalid IHDR length".into());
        }
        if data[8..13] != [8, 6, 0, 0, 0] {
          return Err("unsupported PNG format; expected 8-bit RGBA without interlace".into());
        }
        width = Some(u32::from_be_bytes(data[0..4].try_into().unwrap()) as usize);
        height = Some(u32::from_be_bytes(data[4..8].try_into().unwrap()) as usize);
      }
      b"IDAT" => idat.extend_from_slice(data),
      b"IEND" => {
        saw_iend = true;
        break;
      }
      _ => {}
    }
    cursor = next_chunk;
  }

  if !saw_iend {
    return Err("missing IEND chunk".into());
  }
  let width = width.ok_or_else(|| "missing IHDR width".to_string())?;
  let height = height.ok_or_else(|| "missing IHDR height".to_string())?;
  if width == 0 || height == 0 {
    return Err("empty PNG dimensions".into());
  }
  let row_stride = width
    .checked_mul(4)
    .ok_or_else(|| "PNG row stride overflow".to_string())?;
  let expected_scanline_len = height
    .checked_mul(row_stride + 1)
    .ok_or_else(|| "PNG scanline length overflow".to_string())?;

  let scanlines = inflate_zlib_store_blocks(&idat)?;
  if scanlines.len() != expected_scanline_len {
    return Err(format!(
      "unexpected PNG scanline length {}, expected {expected_scanline_len}",
      scanlines.len()
    ));
  }

  let mut rgba = Vec::with_capacity(width * height * 4);
  for row in scanlines.chunks_exact(row_stride + 1) {
    if row[0] != 0 {
      return Err(format!("unsupported PNG row filter {}", row[0]));
    }
    rgba.extend_from_slice(&row[1..]);
  }

  Ok(PngImage {
    width,
    height,
    rgba,
  })
}

#[cfg(target_os = "macos")]
fn inflate_zlib_store_blocks(bytes: &[u8]) -> Result<Vec<u8>, String> {
  if bytes.len() < 6 {
    return Err("truncated zlib stream".into());
  }
  let cmf = bytes[0];
  let flg = bytes[1];
  let header = u16::from(cmf) << 8 | u16::from(flg);
  if cmf & 0x0f != 8 || header % 31 != 0 {
    return Err("invalid zlib header".into());
  }
  if flg & 0x20 != 0 {
    return Err("zlib preset dictionaries are not supported".into());
  }

  let adler_start = bytes.len() - 4;
  let mut cursor = 2;
  let mut out = Vec::new();
  loop {
    if cursor >= adler_start {
      return Err("missing final deflate block".into());
    }
    let block_header = bytes[cursor];
    cursor += 1;
    let is_final_block = block_header & 1 == 1;
    let block_type = (block_header >> 1) & 0b11;
    if block_type != 0 {
      return Err("compressed deflate blocks are not supported in test PNGs".into());
    }
    if cursor + 4 > adler_start {
      return Err("truncated deflate store block length".into());
    }
    let len = u16::from_le_bytes(bytes[cursor..cursor + 2].try_into().unwrap());
    let nlen = u16::from_le_bytes(bytes[cursor + 2..cursor + 4].try_into().unwrap());
    if len != !nlen {
      return Err("invalid deflate store block length check".into());
    }
    cursor += 4;

    let len = usize::from(len);
    if cursor + len > adler_start {
      return Err("truncated deflate store block data".into());
    }
    out.extend_from_slice(&bytes[cursor..cursor + len]);
    cursor += len;

    if is_final_block {
      break;
    }
  }

  if cursor != adler_start {
    return Err("unexpected trailing deflate data".into());
  }
  let expected_adler = u32::from_be_bytes(bytes[adler_start..].try_into().unwrap());
  let actual_adler = adler32(&out);
  if actual_adler != expected_adler {
    return Err(format!(
      "zlib adler32 mismatch: expected {expected_adler:#010x}, got {actual_adler:#010x}"
    ));
  }

  Ok(out)
}

#[cfg(target_os = "macos")]
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

fn thread_id() -> String {
  format!("{:?}", std::thread::current().id())
    .chars()
    .filter(|ch| ch.is_ascii_alphanumeric())
    .collect()
}
