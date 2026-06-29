use lynx_headless_example::write_png;
use std::fs;
use std::path::Path;

const WIDTH: usize = 64;
const HEIGHT: usize = 48;

#[test]
fn screenshot_output_matches_reference_png() {
  let fixture_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("tests/fixtures");
  let reference = fixture_dir.join("reference.png");
  let actual = std::env::temp_dir().join(format!(
    "lynx-headless-reference-{}-{}.png",
    std::process::id(),
    thread_id()
  ));

  write_png(&actual, WIDTH, HEIGHT, &fixture_rgba()).expect("write actual screenshot");

  if std::env::var_os("LYNX_UPDATE_REFERENCES").is_some() {
    fs::create_dir_all(&fixture_dir).expect("create fixture directory");
    fs::copy(&actual, &reference).expect("update reference screenshot");
    return;
  }

  let actual_bytes = fs::read(&actual).expect("read actual screenshot");
  let reference_bytes = fs::read(&reference).expect("read reference screenshot");
  assert_eq!(
    actual_bytes,
    reference_bytes,
    "screenshot output changed; inspect {actual} and update {reference} intentionally",
    actual = actual.display(),
    reference = reference.display()
  );
}

fn fixture_rgba() -> Vec<u8> {
  let mut rgba = Vec::with_capacity(WIDTH * HEIGHT * 4);
  for y in 0..HEIGHT {
    for x in 0..WIDTH {
      let inside = (8..56).contains(&x) && (6..42).contains(&y);
      let stripe = ((x / 8) + (y / 6)) % 2 == 0;
      let red = if inside { 0x28 + (x as u8 * 2) } else { 0x10 };
      let green = if stripe { 0xb8 } else { 0x54 };
      let blue = if inside { 0xe0 - (y as u8 * 2) } else { 0x40 };
      let alpha = if inside { 0xff } else { 0xcc };
      rgba.extend_from_slice(&[red, green, blue, alpha]);
    }
  }
  rgba
}

fn thread_id() -> String {
  format!("{:?}", std::thread::current().id())
    .chars()
    .filter(|ch| ch.is_ascii_alphanumeric())
    .collect()
}
