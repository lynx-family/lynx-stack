---
applyTo: "packages/genui/server-bundle-rsbuild-plugin/**/*"
---

Keep ZIP production gating based on both the Rsbuild action and production mode. Rspeedy preview normally uses development mode and initializes bundler configs before calling preview, so do not disable the ZIP preview hooks based on NODE_ENV or plugin apply. Dev with production mode must retain its HTTP asset URLs and unpacked output.

Keep archive paths and limits aligned with packages/genui/ui-judge/src/zip/mod.rs. Archive the output directory contents without an enclosing directory, use zip:/// resource URLs, and validate before replacing unpacked output. Preserve the output directory for Rspeedy preview's existence check. Keep preview ZIP downloads and printed URLs within this plugin; do not modify the QR code plugin to support ZIP output.

Run real ReactLynx build fixtures with a workspace package as cwd so the native resolver can find workspace dependencies on Windows. Keep generated entries and output in an isolated temporary directory using absolute config paths. Do not connect a temporary fixture to workspace dependencies through a node_modules junction; that layout failed to resolve @lynx-js/react/jsx-runtime in Windows CI.

Rsbuild 2.2 applies tools.rspack after modifyRspackConfig hooks, including post-order hooks. A post-order hook alone cannot guarantee the final publicPath when the user supplies tools.rspack.output.publicPath. Validate emitted resource URLs with that override, and handle final compiler configuration when ZIP URLs must take precedence. Keep the environment assetPrefix update: ReactLynx source maps consume it independently of Rspack output.publicPath.

When testing preview simplifications, cover Node targets as well as Web targets and verify the actually printed URL with HTML routes present. Rsbuild's built-in preview assets middleware filters out Node targets, so successful default Rspeedy downloads alone do not prove the ZIP middleware is redundant. Test interrupted archive writes against an existing valid ZIP and verify that failure preserves the previous archive. For oversized-file rejection tests, map unexpected successful reads to a small sentinel before asserting; formatting a resolved Map of large byte arrays can exhaust the test runner's heap.

Keep this plugin private under the GenUI workspace, with no npm publishConfig or public @lynx-js/genui export. Its workspace exports must point to the dist files produced by its Turbo build. Keep its build reference in packages/genui/tsconfig.json and its tests discoverable through the root Vitest GenUI project glob when changing the package layout.
