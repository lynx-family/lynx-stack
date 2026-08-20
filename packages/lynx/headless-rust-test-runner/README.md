# Lynx Headless Rust Test Runner

`lynx-headless-rust-test-runner` drives a real Lynx runtime in-process through
Tokio futures and Puppeteer-style page APIs. It combines the original
windowless software-rendering harness with DOM inspection and interaction APIs:

- `Lynx::connect` initializes the process-wide runtime and local DebugRouter.
- `Lynx::new_page` creates a windowless `Page`.
- `Lynx::visit_screenshot` dispatches a complete screenshot visit from any OS
  thread to the process-wide native page owner.
- `Page::goto`, `content`, and `locator` load and inspect Lynx bundles through
  CDP.
- `Page::goto_for_screenshot` loads a bundle without attaching a DOM session.
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

`Lynx` is cloneable, `Send`, and `Sync`. Native pages are not. Choose one of two
process-wide ownership modes:

- For the low-level Page API, the first `new_page()` call selects the native
  owner thread. Every later page must be created, used, and dropped on that
  thread. Run those futures on a Tokio current-thread runtime and use a
  `LocalSet` when several pages need to overlap.
- For screenshot services with callers on multiple OS threads, call
  `visit_screenshot`. A single-thread Tokio local pool pins every visit to one
  native owner. A four-permit admission semaphore applies backpressure before a
  visit is submitted, so the runner does not maintain a separate request
  backlog. Up to four visits overlap on that owner while PNG encoding runs on
  the Rayon pool.

Direct Page mode and dispatched screenshot mode are mutually exclusive. Start
the chosen mode before creating pages; the runner returns a clear error rather
than transferring native ownership between threads.

For screenshot-only work, call `goto_for_screenshot` instead of `goto`. It waits
for a new rendered frame but skips DebugRouter session discovery and DOM setup.
Several screenshot visits can then overlap while PNG encoding runs on the
Rayon pool. Use regular `goto` when the caller also needs `content`, `locator`,
or other DOM APIs.

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

## Concurrent rendering test

The runtime-backed concurrency test runs two fixed waves of four caller OS
threads. Each thread submits exactly one complete dispatched visit as
`new_page -> goto_for_screenshot -> screenshot -> drop(page)`, while all native
pages remain on one owner thread. The test decodes every returned screenshot and
checks its dimensions and visible fixture content. It intentionally contains no
duration, throughput, or latency assertion. Its second wave verifies that pages
can be created again after the first wave is destroyed:

```bash
cargo test --locked -p lynx-headless-rust-test-runner \
  --test concurrent_render -- --nocapture --test-threads=1
```

Linux runs this behavior as the CI contract. On macOS, add `--ignored` for a
local diagnostic run. The admission semaphore caps active native visits at four
because the current embedder runtime has one process-wide UI owner and does not
support pages owned by different OS threads.
