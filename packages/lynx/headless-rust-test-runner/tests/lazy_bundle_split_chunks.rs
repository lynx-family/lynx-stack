use std::io::{BufRead, BufReader, Write};
use std::net::{SocketAddr, TcpListener, TcpStream};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Duration;

use lynx_headless_rust_test_runner::{ContainerOptions, GotoOptions, LynxContainer};

const EXAMPLE: &str = "examples/react-lazy-bundle-split-repro";
const SHARED_MARKER: &str = "SHARED_MODULE_BODY";

fn dist(variant: &str) -> PathBuf {
  PathBuf::from(env!("CARGO_MANIFEST_DIR"))
    .join("../../..")
    .join(EXAMPLE)
    .join("dist")
    .join(variant)
}

/// Lazy bundles are requested as root-relative URLs (`/lazy-bundle/...`), which
/// only resolve against an origin, so the fixtures are served over loopback
/// HTTP instead of `file://`.
fn serve(root: PathBuf) -> SocketAddr {
  let listener = TcpListener::bind("127.0.0.1:0").expect("bind a loopback port");
  let address = listener.local_addr().expect("read the bound port");
  thread::spawn(move || {
    for stream in listener.incoming().flatten() {
      let root = root.clone();
      thread::spawn(move || respond(stream, &root));
    }
  });
  address
}

fn respond(mut stream: TcpStream, root: &Path) {
  let mut request_line = String::new();
  if BufReader::new(&stream)
    .read_line(&mut request_line)
    .is_err()
  {
    return;
  }
  let target = request_line.split_whitespace().nth(1).unwrap_or("/");
  let relative = target
    .split('?')
    .next()
    .unwrap_or("/")
    .trim_start_matches('/');
  let body = if relative.contains("..") {
    None
  } else {
    std::fs::read(root.join(relative)).ok()
  };
  let response = match &body {
    Some(bytes) => format!(
      "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nContent-Type: application/octet-stream\r\nConnection: close\r\n\r\n",
      bytes.len()
    ),
    None => "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string(),
  };
  let _ = stream.write_all(response.as_bytes());
  if let Some(bytes) = body {
    let _ = stream.write_all(&bytes);
  }
}

fn render(container: &LynxContainer, address: SocketAddr) -> String {
  let mut page = container.new_page().expect("open a page");
  page
    .goto(
      &format!("http://{address}/main.lynx.bundle"),
      GotoOptions::default(),
    )
    .expect("load the example bundle");
  page.wait_for_timeout(Duration::from_secs(3));
  page.content().expect("serialize the document")
}

/// Both variants run on one container: the runtime is bound to the thread that
/// created it, and a process may only have one live page at a time.
#[test]
#[ignore = "reproduces https://github.com/lynx-family/lynx-stack/issues/4040: the dist/split half fails"]
fn split_chunks_keeps_lazy_bundles_renderable() {
  for variant in ["baseline", "split"] {
    assert!(
      dist(variant).join("main.lynx.bundle").is_file(),
      "run `pnpm --filter @lynx-js/example-react-lazy-bundle-split-repro build` first"
    );
  }

  let container = LynxContainer::new(ContainerOptions {
    width: 800,
    height: 600,
    ..ContainerOptions::default()
  })
  .expect("create a Lynx container");

  let baseline = render(&container, serve(dist("baseline")));
  assert_eq!(
    baseline.matches(SHARED_MARKER).count(),
    2,
    "without splitChunks both lazy bundles render the shared module:\n{baseline}"
  );

  let split = render(&container, serve(dist("split")));
  assert_eq!(
    split.matches(SHARED_MARKER).count(),
    2,
    "splitChunks moved the lazy bundles' main-thread code into a shared chunk:\n{split}"
  );
}
