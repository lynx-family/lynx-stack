---
applyTo: "packages/lynx/headless-rust-test-runner/**,packages/lynx/engine-bridge/lynx/**"
---

Keep `lynx-headless-rust-test-runner` as the single Rust-only headless testing crate built on `packages/lynx/engine-bridge/lynx`. Expose a blocking, Puppeteer-style page API with CDP behavior parity to `packages/testing-library/kitten-lynx` where the headless host supports it. Use the software renderer frame as the screenshot source and the local desktop DebugRouter instead of ADB; do not create a parallel Kitten Lynx Rust crate.

The crate has no async runtime and must not gain one: no `tokio` dependency, no futures, and no single-threaded async concurrency. `LynxContainer` and `LynxPage` are the only implementation types; input and output types such as `ContainerOptions`, `GotoOptions`, `ScreenshotOptions`, `BoundingBox`, `Bitmap`, and `NodeInfo` are data. Process-wide setup (runtime load, devtool app info, DebugRouter, `lynx_core.js` installation) lives in free functions behind `OnceLock`s rather than a `LynxProcess`-style object, and page state is not split into a separate runtime object.

Reuse the React fixture generated under `packages/genui/ui-judge/tests/fixtures/react/.generated`; do not copy generated bundle output into this crate. Runtime-backed CI tests are Linux-only unless the platform contract is deliberately expanded. macOS may keep an ignored diagnostic test.

Container-contract tests run against the committed LynxML fixture and report a skip when the configured runtime lacks the optional LynxML or DevTools-target exports. Native Lynx state is process-wide and thread-bound and `libtest` runs every test on a fresh thread, so each runtime-backed test file holds exactly one test.

Obtain the default `lynx_core.js` through the shared, SHA-256-verified Cargo build-artifact downloader. Do not check a copied core script into the runner fixtures. Preserve `ContainerOptions::lynx_core_path` and `LYNX_CORE_JS_PATH` as local overrides and keep custom URL downloads paired with an explicit checksum.

When no explicit core path is configured, resolve `$LYNX_SDK_DIR/resources/lynx_core.js` before Cargo-injected default paths. The build script should download a missing core script into the selected SDK directory, and runtime SDK environment overrides must win over build-time SDK defaults.

The shipped runtime starts its local DebugRouter after app metadata is registered through `lynx_env_set_devtool_app_info` and devtool support is enabled. Scan ports 8901 through 8910 with the Peertalk Initialize request. Keep one initialized DebugRouter connection per process. A dedicated I/O actor must own its socket, serialize writes, continuously read messages, and route CDP responses by request id. Coalesce ListSession calls while supporting runtimes that omit its correlation id; never let concurrent callers read from the socket directly.

Treat the configured connect timeout as a bound for DebugRouter discovery and required global-switch setup. Propagate `enable_devtool` and `enable_dom_tree` failures instead of returning a partially configured connection.

Keep the renderer and global UI task queues pumping while waiting for frames or interaction updates; a blocking call must drive the container's native tasks inline instead of sleeping. On macOS, preserve the Rust-only fake display-link setup; on non-macOS platforms, register the windowless global UI task runner once per process and let only the process owner thread drain the shared global queue.

On non-macOS platforms, keep `runs_on_current_thread` false while `set_global_ui_task_runner` is installing the callback, then publish the process owner only after registration succeeds. Do not make the runner active from a captured `ThreadId` before the native registration call returns; changing that ordering can leave the native thread host in an unsafe teardown state.

Native Lynx has one permanent owner thread per process. After recoverable non-native resource validation succeeds, the first `LynxContainer::new` claims that owner immediately before native initialization; later containers are allowed only on the same thread, even after earlier containers are dropped, because process-global teardown can outlive a view. A missing `lynx_core.js` must not claim the owner. Reject another thread with a distinct affinity error before it touches native state. `LynxContainer`, `LynxPage`, and `ElementNode` must stay `!Send` and `!Sync`, and must never gain unsafe `Send` implementations. `LynxPage` has no public constructor: it exists only through `LynxContainer::new_page`. Keep page admission, queueing, and worker-thread scheduling in higher-level consumers.

Keep at most one live `LynxPage` in the process, including across multiple `LynxContainer` values on the owner thread. A container may repeatedly create, render, and destroy pages, but every container must reject a second process-wide page until the first page and its `ElementNode` handles are dropped. Multiple simultaneously live windowless views make Linux native teardown flaky even when operations are pumped serially; a passing run does not establish that lifetime pattern as safe. Higher-level consumers must serialize native capture and move concurrency to request preparation and post-capture work.

Use a newly presented software-frame sequence as navigation readiness even when every pixel is transparent. Keep one navigation entry point: `goto` waits for that frame and nothing else, and the DOM session attaches lazily on the first `content` or `locator` call, so a screenshot-only caller never pays for DevTools setup.

Resolve each page's DevTools session from its own native view through `lynx_view_get_devtool_target`. Do not reintroduce `ListSession` polling, URL or filename matching, session selection heuristics, or per-URL session locks: successive pages can load the same URL, and only the per-view target can identify each native view directly. When the loaded runtime does not export that API, fail the DOM APIs with a distinct error while navigation and screenshots keep working.

The DebugRouter client is blocking and process-wide: one actor thread owns the connection and serializes writes, one reader thread does the blocking reads, and callers poll a returned handle while they pump native tasks. Requests are routed by id and expire on the actor. No other helper may read that TCP connection.

Copy a presented native frame into owned storage once, then share its RGBA bytes with `Arc`. Encode screenshots as an uncompressed 32-bit `BITMAPV4HEADER` BMP with an explicit alpha mask, inline on the calling thread. Do not add an image encoder dependency, worker pool, permit accounting, or job loop to the runner; consumers that need a compressed format transcode it themselves.

Destroy each page on the container thread that created it. Do not treat pumping for a quiet period as native teardown completion; the embedder exposes no completion signal, and a second native owner can still leave engine or layout destruction queued after `lynx_view_release` resets its UI renderer.

Resolve Lynx core requests by `ResourceType::LynxCoreJs` or an exact final `lynx_core.js` URL component. Do not use substring matching because it can redirect source maps or similarly named resources to the core script.

When `GotoOptions::base_dir` is set, treat it as a navigation sandbox: canonicalize the directory before reading the template, retain that canonical root for every later resource request, and reject HTTP(S) and unsupported schemes. Before any target filesystem access, lexically reject absolute paths, Windows prefixes/UNC paths, and parent traversal that would underflow the root; then inspect only in-root components with `symlink_metadata` and reject every symlink before canonicalizing and reading the target. This sandbox assumes the server-owned base directory is private and is not mutated concurrently. Apply the same boundary to bare paths, `file://`, `assets://`, and `zip://` resources. Treat the authority and path of `zip://` as one relative path below the root, percent-decode it before validation, and reject NULs and backslashes. The trusted installed `lynx_core.js` remains the only resource fetched outside this per-navigation sandbox.

Route UTF-8 inputs whose final URL path ends in `.lynxml` through the public `lynx_view_load_lynx_ml` API; keep all other navigation on the compiled-template byte path. The LynxML API accepts initial data but not global properties, so reject an explicit `GotoOptions::global_props_json` instead of silently dropping it.

Dispatch `ElementNode::tap` directly to the Lynx node id with the native `tap` event. Do not derive an absolute point from `DOM.getBoxModel` and do not add coordinate-based tap APIs, because overlay and stacking relationships can make coordinate hit-testing select a different node.
