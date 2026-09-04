---
applyTo: ".dprint.jsonc"
---

Keep dprint plugins pinned as `npm:` specifiers in `.dprint.jsonc`; do not add plugin packages to `package.json`.
When an npm plugin package does not declare its dprint entry point, include the Wasm path in the specifier, for example `npm:dprint-plugin-sort-package-json@0.1.0/plugin.wasm`.
