---
applyTo: "packages/rspeedy/lynx-bundle-rslib-config/**,packages/webpack/react-webpack-plugin/**"
---

When external bundles split their entries, pass existing background/main-thread pairs to the React plugin's definition collector. Do not synthesize a main-thread pair for explicitly background-only packages. Keep application entry collection unchanged.

Eager imports stay in their owning chunk, so include their definitions in that scope rather than treating them as lazy boundaries. Verify this by executing the emitted main-thread section and checking snapshot registration.
