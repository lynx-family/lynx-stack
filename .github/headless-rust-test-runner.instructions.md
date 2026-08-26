---
applyTo: "packages/lynx/headless-rust-test-runner/**,packages/lynx/engine-bridge/lynx/**"
---

Keep `lynx-headless-rust-test-runner` as the single Rust-only headless testing crate built on `packages/lynx/engine-bridge/lynx`. Expose Tokio futures and Puppeteer-style page APIs with CDP behavior parity to `packages/testing-library/kitten-lynx` where the headless host supports it. Use the software renderer frame as the screenshot source and the local desktop DebugRouter instead of ADB; do not create a parallel Kitten Lynx Rust crate.

Reuse the React fixture generated under `packages/genui/ui-judge/tests/fixtures/react/.generated`; do not copy generated bundle output into this crate. Runtime-backed CI tests are Linux-only unless the platform contract is deliberately expanded. macOS may keep an ignored diagnostic test.

Obtain the default `lynx_core.js` through the shared, SHA-256-verified Cargo build-artifact downloader. Do not check a copied core script into the runner fixtures. Preserve `ConnectOptions::lynx_core_path` and `LYNX_CORE_JS_PATH` as local overrides and keep custom URL downloads paired with an explicit checksum.

The shipped runtime starts its local DebugRouter after app metadata is registered through `lynx_env_set_devtool_app_info` and devtool support is enabled. Scan ports 8901 through 8910 with the Peertalk Initialize request. Keep one initialized DebugRouter connection per process. A dedicated I/O actor must own its socket, serialize writes, continuously read messages, and route CDP responses by request id. Coalesce ListSession calls while supporting runtimes that omit its correlation id; never let concurrent callers read from the socket directly.

Treat the configured connect timeout as a bound for DebugRouter discovery and required global-switch setup. Propagate `enable_devtool` and `enable_dom_tree` failures instead of returning a partially configured connection.

Keep the renderer and global UI task queues pumping while waiting for frames or interaction updates. On macOS, preserve the Rust-only fake display-link setup used by `headless-rust-test-runner`; on non-macOS platforms, register the windowless global UI task runner once per process. The embedder has one process-wide native UI owner: make `Lynx` a cloneable `Send + Sync` process handle, but never move a `Page` or `LynxView` between OS threads or add unsafe `Send` implementations. Bind Page ownership to the thread selected by the first `new_page()` call, and keep page admission, queueing, and pinned scheduling in higher-level consumers.

Use a newly presented software-frame sequence as navigation readiness even when every pixel is transparent. Provide a screenshot-only navigation path that waits for that frame without discovering or attaching a DOM session. When regular navigation attaches after loading, accept only a newly observed session or the page's current session, reject missing URLs, and compare exact URLs or exact final path components rather than arbitrary suffixes. Serialize session discovery with a lock key equivalent to that URL-matching rule.

Use Tokio futures for DebugRouter requests, CDP waits, resource reads, and public waiting APIs. Drive the native task pump with `tokio::select!` while CDP is pending. The process-wide DebugRouter actor is the only helper thread allowed to read its TCP connection.

Copy a presented native frame into owned storage once, then share its RGBA bytes with `Arc`. Encode PNG data on a dedicated process-wide Rayon pool so concurrent local page futures can overlap CPU encoding without blocking the native owner thread. Limit outstanding Rayon work with an async semaphore acquired before submission and held by the Rayon closure through completion. Do not implement PNG worker threads, receiver locks, or job loops in the runner.

Destroy each page on the same process-wide owner thread that created it. Do not treat pumping for a quiet period as native teardown completion; the embedder exposes no completion signal, and a second native owner can still leave engine or layout destruction queued after `lynx_view_release` resets its UI renderer.

Resolve Lynx core requests by `ResourceType::LynxCoreJs` or an exact final `lynx_core.js` URL component. Do not use substring matching because it can redirect source maps or similarly named resources to the core script.

Route UTF-8 inputs whose final URL path ends in `.lynxml` through the public `lynx_view_load_lynx_ml` API; keep all other navigation on the compiled-template byte path. The LynxML API accepts initial data but not global properties, so reject an explicit `GotoOptions::global_props_json` instead of silently dropping it.

Dispatch `ElementNode::tap` directly to the Lynx node id with the native `tap` event. Do not derive an absolute point from `DOM.getBoxModel` and do not add coordinate-based tap APIs, because overlay and stacking relationships can make coordinate hit-testing select a different node.
