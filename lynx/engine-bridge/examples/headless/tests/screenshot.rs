use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const REACT_BUNDLE_NAME: &str = "main.lynx.bundle";
const REACT_REFERENCE_NAME: &str = "main.lynx.snapshot.png";

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

  let actual_bytes = fs::read(&actual).expect("read actual screenshot");
  let reference_bytes = fs::read(&reference).expect("read reference screenshot");
  assert!(
    actual_bytes.len() > 100,
    "rendered screenshot is unexpectedly small"
  );
  assert_eq!(
    actual_bytes,
    reference_bytes,
    "React fixture rendering changed; inspect {actual} and update {reference} intentionally with LYNX_UPDATE_REFERENCES=1",
    actual = actual.display(),
    reference = reference.display()
  );
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

fn thread_id() -> String {
  format!("{:?}", std::thread::current().id())
    .chars()
    .filter(|ch| ch.is_ascii_alphanumeric())
    .collect()
}
