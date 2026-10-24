---
applyTo: "packages/motion/**"
---

Compile upstream Motion dependencies through the private runtime import transform in `build/pluginMotionRuntime.ts`. The adapter remains bundleless to preserve ReactLynx main-thread directives and shared import attributes; `src/upstream` entries are bundled separately with their transitive dependencies included. Keep full and mini vendor exports narrow so mini does not acquire the full DOM runtime.

Do not install DOM or scheduling polyfills on globals or assign to the Lynx for Web lexical `window`. Lynx main-thread elements are not browser DOM nodes even in a browser host. Keep the private runtime external to the vendor bundles so its ElementCompt constructor is shared with the adapter and instanceof checks remain valid. Runtime modules must not pass through their own substitution loader.

When updating Motion or adding an upstream API, audit its reachable host API accesses and extend the private runtime and transform together. Babel syntax transforms and core-js do not implement Lynx DOM behavior. Keep scope-aware replacements for bare globals and static globalThis accesses, including typeof checks, without rewriting local bindings or object keys. Validate the built ESM in a separate process with absent and read-only browser globals; source-only tests cannot validate substitutions inside dependencies.

Include `build/**` in the Motion Turbo inputs and cache `dist/**` so changes to the runtime transform invalidate the build and generated vendor chunks are restored with the adapter. Normalize filesystem paths returned by the Vitest resolver to forward slashes for Windows.

Exercise compiled Mini core modules with their real callable registry and vendor spring/easing code in subprocess feature tests, alongside full Motion with absent and read-only host globals. Native/Web feature pages should assert observed state and cleanup; wait for native computed styles to converge after Mini completion, since the final value notification can precede the engine style flush. Allow pixel rounding when comparing computed dimensions. Run the full repository build before building the independent feature entries; the default example build cleans their parent dist directory. Keep pre-existing ReactLynx worklet reachability issues outside Motion build-format changes.

The isolated effect-started values example temporarily anchors its ordinary Motion import with `useMemo(() => springValue, [])` while issue #4244 is open. Preserve this example-only workaround until the compiler can inject definitions that depend on shared imports. Do not replace public worklet imports with shared imports: that bypasses descriptor hydration. Verify workaround changes with an isolated build and runtime animation; other hooks or callbacks in the same entry can hide the missing-definition path.
