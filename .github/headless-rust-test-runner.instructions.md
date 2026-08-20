---
applyTo: "packages/lynx/headless-rust-test-runner/**,packages/lynx/engine-bridge/lynx/**"
---

Keep `lynx-headless-rust-test-runner` as the single Rust-only headless testing crate built on `packages/lynx/engine-bridge/lynx`. Expose Tokio futures and Puppeteer-style page APIs with CDP behavior parity to `packages/testing-library/kitten-lynx` where the headless host supports it. Use the software renderer frame as the screenshot source and the local desktop DebugRouter instead of ADB; do not create a parallel Kitten Lynx Rust crate.

Reuse the React fixture generated under `packages/genui/ui-judge/tests/fixtures/react/.generated`; do not copy generated bundle output into this crate. Runtime-backed CI tests are Linux-only unless the platform contract is deliberately expanded. macOS may keep an ignored diagnostic test.

The shipped runtime starts its local DebugRouter after app metadata is registered through `lynx_env_set_devtool_app_info` and devtool support is enabled. Scan ports 8901 through 8910 with the Peertalk Initialize request. Keep one initialized DebugRouter connection per process. A dedicated I/O actor must own its socket, serialize writes, continuously read messages, and route CDP responses by request id. Coalesce ListSession calls while supporting runtimes that omit its correlation id; never let concurrent callers read from the socket directly.

Treat the configured connect timeout as a bound for DebugRouter discovery and required global-switch setup. Propagate `enable_devtool` and `enable_dom_tree` failures instead of returning a partially configured connection.

Keep the renderer and global UI task queues pumping while waiting for frames or interaction updates. On macOS, preserve the Rust-only fake display-link setup used by `headless-rust-test-runner`; on non-macOS platforms, register the windowless global UI task runner once per process. The embedder has one process-wide native UI owner: make `Lynx` a cloneable `Send + Sync` process handle, but never move a `Page` or `HeadlessView` between OS threads or add unsafe `Send` implementations. Support direct Page ownership on the thread selected by the first `new_page()` call and a mutually exclusive high-level screenshot-dispatch mode. The latter must use a bounded queue, a dedicated current-thread runtime plus `LocalSet`, and complete create, navigation, screenshot, and page destruction on that owner while allowing callers on multiple OS threads.

Use a newly presented software-frame sequence as navigation readiness even when every pixel is transparent. Provide a screenshot-only navigation path that waits for that frame without discovering or attaching a DOM session. When regular navigation attaches after loading, accept only a newly observed session or the page's current session, reject missing URLs, and compare exact URLs or exact final path components rather than arbitrary suffixes. Serialize session discovery with a lock key equivalent to that URL-matching rule.

Use Tokio futures for DebugRouter requests, CDP waits, resource reads, and public waiting APIs. Drive the native task pump with `tokio::select!` while CDP is pending. The process-wide DebugRouter actor is the only helper thread allowed to read its TCP connection.

Copy a presented native frame into owned storage once, then share its RGBA bytes with `Arc`. Encode PNG data on a bounded process-wide worker pool so concurrent local page futures can overlap CPU encoding without blocking the native owner thread. Keep queue capacity bounded to provide backpressure.

In concurrent rendering tests, release a fixed number of OS callers together and have each submit one screenshot visit. Do not add duration, QPS, latency, or other performance thresholds to repository tests. Decode every result and check its PNG signature, dimensions, and visible fixture pixel signals so an empty or incomplete first frame cannot count as a successful render.

Destroy each page on the same process-wide owner thread that created it. Do not treat pumping for a quiet period as native teardown completion; the embedder exposes no completion signal, and a second native owner can still leave engine or layout destruction queued after `lynx_view_release` resets its UI renderer.

Resolve Lynx core requests by `ResourceType::LynxCoreJs` or an exact final `lynx_core.js` URL component. Do not use substring matching because it can redirect source maps or similarly named resources to the core script.

Dispatch `ElementNode::tap` directly to the Lynx node id with the native `tap` event. Do not derive an absolute point from `DOM.getBoxModel` and do not add coordinate-based tap APIs, because overlay and stacking relationships can make coordinate hit-testing select a different node.
