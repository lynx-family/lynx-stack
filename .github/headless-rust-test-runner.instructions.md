---
applyTo: "packages/lynx/headless-rust-test-runner/**,packages/lynx/engine-bridge/lynx/**"
---

Keep `lynx-headless-rust-test-runner` as the single Rust-only headless testing crate built on `packages/lynx/engine-bridge/lynx`. Expose Tokio futures and Puppeteer-style page APIs with CDP behavior parity to `packages/testing-library/kitten-lynx` where the headless host supports it. Use the software renderer frame as the screenshot source and the local desktop DebugRouter instead of ADB; do not create a parallel Kitten Lynx Rust crate.

Reuse the React fixture generated under `packages/genui/ui-judge/tests/fixtures/react/.generated`; do not copy generated bundle output into this crate. Runtime-backed CI tests are Linux-only unless the platform contract is deliberately expanded. macOS may keep an ignored diagnostic test.

The shipped runtime starts its local DebugRouter after app metadata is registered through `lynx_env_set_devtool_app_info` and devtool support is enabled. Scan ports 8901 through 8910 with the Peertalk Initialize request. Unlike the Android transport, the local desktop DebugRouter requires Initialize, ListSession, and CDP messages to reuse the same TCP connection; serialize requests on that initialized stream.

Treat the configured connect timeout as a bound for DebugRouter discovery and required global-switch setup. Propagate `enable_devtool` and `enable_dom_tree` failures instead of returning a partially configured connection.

Keep the renderer and global UI task queues pumping while waiting for frames or interaction updates. On macOS, preserve the Rust-only fake display-link setup used by `headless-rust-test-runner`; on non-macOS platforms, register the windowless global UI task runner once per process.

Use a newly presented software-frame sequence as navigation readiness even when every pixel is transparent. When attaching after navigation, accept only a newly observed session or the page's current session, reject missing URLs, and compare exact URLs or exact final path components rather than arbitrary suffixes.

Use Tokio futures for DebugRouter I/O, CDP waits, resource reads, and public waiting APIs. Drive the native task pump with `tokio::select!` while CDP is pending; do not reintroduce an idle callback or a helper reader thread.

Resolve Lynx core requests by `ResourceType::LynxCoreJs` or an exact final `lynx_core.js` URL component. Do not use substring matching because it can redirect source maps or similarly named resources to the core script.

Dispatch `ElementNode::tap` directly to the Lynx node id with the native `tap` event. Do not derive an absolute point from `DOM.getBoxModel` and do not add coordinate-based tap APIs, because overlay and stacking relationships can make coordinate hit-testing select a different node.
