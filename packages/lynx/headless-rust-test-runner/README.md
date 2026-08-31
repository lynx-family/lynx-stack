# Lynx Headless Rust Test Runner

`lynx-headless-rust-test-runner` drives a real Lynx runtime in-process through a
blocking, Puppeteer-style page API. It combines the original windowless
software-rendering harness with DOM inspection and interaction:

- After non-native resource validation succeeds, the first
  `LynxContainer::new` binds native Lynx state to a permanent process owner
  thread and prepares the runtime and local DebugRouter on first use.
- `LynxContainer::new_page` creates a windowless `LynxPage`. The process owns
  one live page at a time and can create later pages after dropping it.
- `LynxPage::goto`, `content`, and `locator` load and inspect compiled Lynx
  bundles or UTF-8 `.lynxml` source documents through CDP.
- `ElementNode` reads attributes and computed styles and dispatches taps by
  native node id, without absolute coordinates or hit-testing.
- `LynxPage::screenshot` captures the software renderer directly as a 32-bit
  BMP; `decode_screenshot` reads that frame back.
- A process-wide DebugRouter actor owns the TCP connection and routes responses
  to callers by request id.

## Example

```rust
use lynx_headless_rust_test_runner::{
  ContainerOptions, GotoOptions, LynxContainer, ScreenshotOptions,
};

let container = LynxContainer::new(ContainerOptions {
  lynx_core_path: Some("/path/to/lynx_core.js".into()),
  ..ContainerOptions::default()
})?;
let mut page = container.new_page()?;
page.goto("/path/to/main.lynx.bundle", GotoOptions::default())?;

let title = page.locator(".Title")?.expect("title exists");
assert_eq!(title.get_attribute("class")?.as_deref(), Some("Title"));
let bmp = page.screenshot(ScreenshotOptions::default())?;
# Ok::<(), lynx_headless_rust_test_runner::Error>(())
```

## Threading

The API is blocking, and there is no async runtime anywhere in the crate.
`LynxContainer`, `LynxPage`, and `ElementNode` are all `!Send` and `!Sync`
because they own native handles bound to the process owner thread. While a page
waits — for a frame, a CDP reply, or a settle interval — it runs the container's
native task queues inline on that same thread.

Native page creation, rendering, and destruction are serialized on **one owner
thread per process**. A second thread receives a thread-affinity error before it
touches native state, and dropping all containers does not transfer ownership.
The runner also rejects a second live page, even through another container,
until the current page and its `ElementNode` handles are dropped. Higher-level
consumers can overlap request preparation and post-capture work after the owned
BMP has left the native thread.

## Navigation

Navigation chooses the native load API from the final URL path. Inputs ending
in `.lynxml` are decoded as UTF-8 and loaded as LynxML source; all other inputs
keep the compiled-template byte path. File paths, `file://` URLs, and HTTP(S)
URLs are supported. `GotoOptions::initial_data_json` applies to both formats;
`global_props_json` applies only to compiled templates. Passing it for LynxML
returns an error because the public LynxML load API does not accept global
properties.

`goto` waits for a newly presented software frame and nothing more. The DOM
session attaches lazily on the first `content` or `locator` call, so a
screenshot-only caller never pays for DevTools setup and there is no separate
screenshot-only navigation entry point.

Each page resolves its **own** DevTools session from its native view through
`lynx_view_get_devtool_target`, so successive pages that load the same URL do
not depend on URL-based session matching. Runtimes that predate that export return
`Error::DevtoolTargetUnavailable` from the DOM APIs; navigation and screenshots
still work.

## Screenshots

`screenshot` returns an uncompressed 32-bit BMP with a `BITMAPV4HEADER` and an
explicit alpha mask. Writing one costs a header plus a channel swap, so capture
needs no encoder threads, permits, or async plumbing. `decode_screenshot` reads
that exact layout back into RGBA. Consumers that must ship a compressed image
transcode it themselves.

## Runtime resources

The runner's `build.rs` downloads the default `lynx_core.js` with SHA-256
verification. At runtime it installs the script beside the executable on Linux
or inside `LynxResources.bundle` beside it on macOS and serves
`ResourceType::LynxCoreJs` requests from that installed path. Set
`lynx_core_path` or `LYNX_CORE_JS_PATH` to use a local override. Otherwise the
runner checks `$LYNX_SDK_DIR/resources/lynx_core.js`; its build script downloads
a missing script into that SDK location. Use `LYNX_CORE_JS_URL` with
`LYNX_CORE_JS_SHA256` for a different build-time download.

## Tests

Build the shared fixture before running the runtime-backed React test:

```bash
NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build --root packages/genui/ui-judge/tests/fixtures/react
```

```bash
cargo test -p lynx-headless-rust-test-runner --all-targets
```

`tests/react_fixture.rs` uses the public page APIs to verify DOM content,
attributes, computed styles, node-id tap state updates, BMP capture, and the
original runner's visual pixel signals. Linux is the CI contract. On macOS, run
the ignored integration test explicitly for diagnostics:

```bash
cargo test -p lynx-headless-rust-test-runner --test react_fixture -- --ignored
```

`tests/lynxml_container.rs` covers process-wide page admission, repeated native
page lifetimes, per-view DevTools sessions, and BMP capture against a LynxML
fixture.
`tests/parallel_containers.rs` verifies that a second OS thread cannot become a
native owner. Each lives in its own test binary because native Lynx state is
process-wide and thread-bound, and `libtest` runs every test on a fresh thread.
