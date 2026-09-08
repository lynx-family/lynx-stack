---
applyTo: "packages/rspeedy/plugin-zip/**/*"
---

Keep ZIP production gating based on both the Rsbuild action and production mode. Rspeedy preview normally uses development mode and initializes bundler configs before calling preview, so do not disable the ZIP preview hooks based on NODE_ENV or plugin apply. Dev with production mode must retain its HTTP asset URLs and unpacked output.

Keep archive paths and limits aligned with packages/genui/ui-judge/src/zip/mod.rs. Archive the output directory contents without an enclosing directory, use zip:/// resource URLs, and validate before replacing unpacked output. Preserve the output directory for Rspeedy preview's existence check. Keep preview ZIP downloads and printed URLs within this plugin; do not modify the QR code plugin to support ZIP output.
