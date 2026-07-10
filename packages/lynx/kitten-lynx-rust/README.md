# Kitten Lynx Rust

`kitten-lynx-rust` is a Rust, headless counterpart to
`@lynx-js/kitten-lynx-test-infra`. It runs a real Lynx bundle through the
runtime-loaded `lynx` engine bridge and keeps the familiar testing flow:

- `Lynx::connect` initializes the runtime and local DebugRouter.
- `Lynx::new_page` creates a windowless software-rendered Lynx view.
- `KittenLynxView::goto` loads local, `file://`, `assets://`, or HTTP(S)
  bundles and attaches to their CDP session.
- `locator`, `content`, `get_attribute`, and `computed_style_map` use the same
  CDP domains as the TypeScript Kitten Lynx implementation; taps use the
  headless view's native Lynx-node event path and target the node id directly.
- `screenshot` captures the software renderer directly, without a device or
  `Lynx.getScreenshot` stream.
- DebugRouter I/O and public waiting operations are asynchronous Tokio futures.

## Example

```rust
use kitten_lynx_rust::{ConnectOptions, GotoOptions, Lynx, ScreenshotOptions};

let lynx = Lynx::connect(ConnectOptions {
  lynx_core_path: Some("/path/to/lynx_core.js".into()),
  ..ConnectOptions::default()
}).await?;
let mut page = lynx.new_page()?;
page.goto("/path/to/main.lynx.bundle", GotoOptions::default()).await?;

let title = page.locator(".Title").await?.expect("title exists");
assert_eq!(title.get_attribute("class").await?.as_deref(), Some("Title"));
title.tap().await?;
let png = page.screenshot(ScreenshotOptions::default()).await?;
# Ok::<(), kitten_lynx_rust::Error>(())
```

Run these futures on a Tokio current-thread runtime. The headless Lynx view and
its native task pump stay on the thread where the page was created.

The runtime needs `lynx_core.js` beside the executable on Linux or inside
`LynxResources.bundle` beside it on macOS. Set `lynx_core_path` or the
`LYNX_CORE_JS_PATH` environment variable and Kitten Lynx Rust installs it in
the expected location.

Build the shared React fixture before running the runtime-backed test:

```bash
NODE_ENV=production node packages/rspeedy/core/bin/rspeedy.js build --root packages/genui/ui-judge/tests/fixtures/react
cargo test -p kitten-lynx-rust --all-targets
```

The integration test is a Linux CI contract. On macOS it is compiled but
ignored by default. Run it explicitly for local diagnostics:

```bash
cargo test -p kitten-lynx-rust --test react_fixture -- --ignored
```
