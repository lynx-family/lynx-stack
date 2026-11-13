---
applyTo: "packages/rspeedy/lynx-bundle-rslib-config/**,packages/webpack/react-webpack-plugin/**"
---

When rslib splits ReactLynx external bundle entries, pass the resulting thread pairs to ReactWebpackPlugin. The ReactLynx application plugin deliberately leaves entry splitting to rslib, so it cannot supply those pairs itself. Definition collection must include eager imports in the owning scope while preserving real lazy chunk boundaries. Verify registration by executing the emitted main-thread section, including background-only JSX and preservation of the library exports.
