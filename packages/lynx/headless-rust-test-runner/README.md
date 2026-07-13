# Lynx Headless Rust Test Runner

`lynx-headless-rust-test-runner` drives a real Lynx runtime in-process through
Tokio futures and Puppeteer-style page APIs. It combines the original
windowless software-rendering harness with DOM inspection and interaction APIs:

- `Lynx::connect` initializes the runtime and local DebugRouter.
- `Lynx::new_page` creates a windowless `Page`.
- `Page::goto`, `content`, and `locator` load and inspect Lynx bundles through
  CDP.
- `ElementNode` reads attributes and computed styles and dispatches taps by
  native node id, without absolute coordinates or hit-testing.
- `Page::screenshot` captures the software renderer directly as PNG.
- DebugRouter I/O, resource loading, waits, and public waiting operations use
  Tokio `async`/`await`.

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

Run these futures on a Tokio current-thread runtime. The headless Lynx view and
its native task pump stay on the thread where the page was created.

The runtime needs `lynx_core.js` beside the executable on Linux or inside
`LynxResources.bundle` beside it on macOS. Set `lynx_core_path` or
`LYNX_CORE_JS_PATH`; the runner installs the file and also serves
`ResourceType::LynxCoreJs` requests from that installed path.

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
