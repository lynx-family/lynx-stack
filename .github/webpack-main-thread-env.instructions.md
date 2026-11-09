---
applyTo: "packages/webpack/cache-events-webpack-plugin/**,packages/web-platform/web-core-e2e/tests/reactlynx/async-external-env/**"
---

Async entry factories can evaluate ordinary synchronous dependencies before awaiting external ReactLynx. Keep main-thread compatibility global initialization in the generated runtime before entry evaluation, and preserve existing NativeModules properties and background bridge behavior. Web hosts already provide SystemInfo, so use a top-level NativeModules read with the actual ReactLynx external request blocked to cover this ordering on Web; use an isolated runtime test for native hosts that lack global SystemInfo.
