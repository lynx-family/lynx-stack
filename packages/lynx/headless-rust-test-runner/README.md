# Lynx Headless Rust Test Runner

`lynx-headless-rust-test-runner` drives a real Lynx runtime in-process through
Tokio futures and Puppeteer-style page APIs. It combines the original
windowless software-rendering harness with DOM inspection and interaction APIs:

- `Lynx::connect` initializes the process-wide runtime and local DebugRouter.
- `Lynx::new_page` creates a windowless `Page`.
- `Page::goto`, `content`, and `locator` load and inspect compiled Lynx bundles
  or UTF-8 `.lynxml` source documents through CDP.
- `Page::goto_for_screenshot` loads either format without attaching a DOM
  session.
- `ElementNode` reads attributes and computed styles and dispatches taps by
  native node id, without absolute coordinates or hit-testing.
- `Page::screenshot` captures the software renderer directly as PNG.
- A process-wide DebugRouter actor owns the TCP connection and routes concurrent
  responses to callers.
- Screenshot frames use shared RGBA storage, and a dedicated Rayon pool encodes
  PNG data away from the native page owner thread.

## Example

```rust
use lynx_headless_rust_test_runner::{
  ConnectOptions, GotoOptions, Lynx, ScreenshotOptions,
};

let lynx = Lynx::connect(ConnectOptions {
  lynx_core_path: Some("/path/to/lynx_core.js".into()),
  ..ConnectOptions::default()
}).await?;
let mut page = lynx.new_page()?;
page.goto("/path/to/main.lynx.bundle", GotoOptions::default()).await?;

let title = page.locator(".Title").await?.expect("title exists");
assert_eq!(title.get_attribute("class").await?.as_deref(), Some("Title"));
let png = page.screenshot(ScreenshotOptions::default()).await?;
# Ok::<(), lynx_headless_rust_test_runner::Error>(())
```

Navigation chooses the native load API from the final URL path. Inputs ending
in `.lynxml` are decoded as UTF-8 and loaded as LynxML source; all other inputs
keep the compiled-template byte path. File paths, `file://` URLs, and HTTP(S)
URLs are supported. `GotoOptions::initial_data_json` applies to both formats;
`global_props_json` applies only to compiled templates. Passing it for LynxML
returns an error because the public LynxML load API does not accept global
properties.

`Lynx` is cloneable, `Send`, and `Sync`. Native pages are not. The first
`new_page()` call selects the native owner thread; every later page must be
created, used, and dropped on that thread. Run those futures on a Tokio
current-thread runtime and use a `LocalSet` when several pages need to overlap.

For screenshot-only work, call `goto_for_screenshot` instead of `goto`. It waits
for a new rendered frame but skips DebugRouter session discovery and DOM setup.
PNG encoding runs on the Rayon pool. Use regular `goto` when the caller also
needs `content`, `locator`, or other DOM APIs.

The runner's `build.rs` downloads the default `lynx_core.js` with SHA-256
verification. At runtime it installs the script beside the executable on Linux
or inside `LynxResources.bundle` beside it on macOS and serves
`ResourceType::LynxCoreJs` requests from that installed path. Set
`lynx_core_path` or `LYNX_CORE_JS_PATH` to use a local override. Otherwise the
runner checks `$LYNX_SDK_DIR/resources/lynx_core.js`; its build script downloads
a missing script into that SDK location. Use `LYNX_CORE_JS_URL` with
`LYNX_CORE_JS_SHA256` for a different build-time download.

## React fixture test

Build the shared fixture before running the runtime-backed test:

```bash
NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build --root packages/genui/ui-judge/tests/fixtures/react
cargo test -p lynx-headless-rust-test-runner --all-targets
```

The test uses the public page APIs to verify DOM content, attributes, computed
styles, node-id tap state updates, PNG capture, and the original runner's visual
pixel signals. Linux is the CI contract. On macOS, run the ignored integration
test explicitly for diagnostics:

```bash
cargo test -p lynx-headless-rust-test-runner --test react_fixture -- --ignored
```
