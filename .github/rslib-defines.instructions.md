---
applyTo: "packages/rspeedy/lynx-bundle-rslib-config/**,packages/webpack/react-webpack-plugin/**"
---

When rslib splits ReactLynx external bundle entries, pass the resulting thread pairs to ReactWebpackPlugin. The ReactLynx application plugin deliberately leaves entry splitting to rslib, so it cannot supply those pairs itself. Definition collection must include eager imports in the owning scope while preserving real lazy chunk boundaries. Verify registration by executing the emitted main-thread section, including background-only JSX and preservation of the library exports.

Keep the React build plugins aligned with their supported runtime and transform versions. For maintenance consumers, backport a collection fix onto the compatible plugin version rather than bypassing the loader's runtime-requirements checks.

Thread-specific transforms may make a parent eager on the background thread but lazy on the main thread. Match nested boundary owners against the entire paired main-thread graph without promoting their definitions into the entry. Legacy worklet definitions without semantic requirements still require main-thread programmability; preserve an explicit false value. Integration tests that execute loaders must use the built plugin so both share the boundary registry.
