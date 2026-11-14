---
applyTo: "packages/rspeedy/plugin-react/**,packages/rspeedy/lynx-bundle-rslib-config/**,packages/webpack/react-webpack-plugin/**"
---

Keep entry-pair collection in pluginReactLynx, after bundler-chain transforms have produced final layered entries. Applications split their entries in pluginReactLynx; rslib's external-bundle config owns its own splitting but must not mutate the React plugin's options. Match main/background layers as well as the conventional entry names, and keep collection isolated per Rsbuild environment. Definition collection must include eager imports in the owning scope while preserving real lazy chunk boundaries. Verify registration by executing the emitted main-thread section, including background-only JSX and preservation of library exports for both shorthand and explicitly layered entries.

Keep the React build plugins aligned with their supported runtime and transform versions. For maintenance consumers, backport a collection fix onto the compatible plugin version rather than bypassing the loader's runtime-requirements checks.

Thread-specific transforms may make a parent eager on the background thread but lazy on the main thread. Match nested boundary owners against the entire paired main-thread graph without promoting their definitions into the entry. Legacy worklet definitions without semantic requirements still require main-thread programmability; preserve an explicit false value. Integration tests that execute loaders must use the built plugin so both share the boundary registry.
