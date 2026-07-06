---
"@lynx-js/react-alias-rsbuild-plugin": patch
---

Fix `Cannot find module '@lynx-js/react/jsx-runtime'` when a stray Yarn PnP manifest (`.pnp.cjs`) exists in an ancestor directory of an npm/pnpm project. Yarn PnP resolution is now only enabled when the build actually runs under the PnP runtime.
