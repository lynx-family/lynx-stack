---
"@lynx-js/template-webpack-plugin": patch
---

Create the TASM encode worker pool (`LynxEncodePlugin.encodePool`) on first use instead of when the package is imported. A build with no native Lynx bundle, such as one with only a `web` environment, no longer starts encode worker threads. The package can also be imported where `tinypool` and `worker_threads` are not available, such as in the browser through `@rspack/browser`.
