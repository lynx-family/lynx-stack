---
applyTo: "packages/motion/**"
---

Compile upstream Motion dependencies through the private runtime import transform in `build/pluginMotionRuntime.ts`. The adapter remains bundleless to preserve ReactLynx main-thread directives and shared import attributes; `src/upstream` entries are bundled separately with their transitive dependencies included. Keep full and mini vendor exports narrow so mini does not acquire the full DOM runtime.

Do not install DOM or scheduling polyfills on globals or assign to the Lynx for Web lexical `window`. Lynx main-thread elements are not browser DOM nodes even in a browser host. Keep the private runtime external to the vendor bundles so its ElementCompt constructor is shared with the adapter and instanceof checks remain valid. Runtime modules must not pass through their own substitution loader.

When updating Motion or adding an upstream API, audit its reachable host API accesses and extend the private runtime and transform together. Babel syntax transforms and core-js do not implement Lynx DOM behavior. Keep scope-aware replacements for bare globals and static globalThis accesses, including typeof checks, without rewriting local bindings or object keys. Validate the built ESM in a separate process with absent and read-only browser globals; source-only tests cannot validate substitutions inside dependencies.

Include `build/**` in the Motion Turbo inputs and cache `dist/**` so changes to the runtime transform invalidate the build and generated vendor chunks are restored with the adapter. Normalize filesystem paths returned by the Vitest resolver to forward slashes for Windows.
