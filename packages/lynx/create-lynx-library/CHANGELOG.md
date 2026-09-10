# create-lynx-library

## 0.6.0

### Minor Changes

- Keep `native-module` and `napi-native-module` as separate features, add ([#3646](https://github.com/lynx-family/lynx-stack/pull/3646))
  HarmonyOS source scaffolding for NAPI addons, and generate a Lynxtron Node-API
  adapter for platform native modules.

  When both module features are selected, the NAPI module uses the `Napi` suffix
  and both modules are available through `NativeModules`.

### Patch Changes

- Fix strict TypeScript checks for generated Node-API facades and scope generated podspecs to iOS. ([#3733](https://github.com/lynx-family/lynx-stack/pull/3733))
- Updated dependencies [[`3449187`](https://github.com/lynx-family/lynx-stack/commit/3449187a04a81a5c46a114d23cc2d24634082177), [`f7ba7e1`](https://github.com/lynx-family/lynx-stack/commit/f7ba7e116b885f21dd6cc239a37abe28c9a4daff), [`5ce8fe3`](https://github.com/lynx-family/lynx-stack/commit/5ce8fe37d3c1b8f900f24f785a972841355fd855)]:
  - @lynx-js/autolink-codegen@0.5.0

## 0.5.2

### Patch Changes

- Build shared Node-API module sources against `@lynx-js/weak-node-api` on every ([#3403](https://github.com/lynx-family/lynx-stack/pull/3403))
  platform while limiting weak suffix remapping to runtimes that require it.
- Updated dependencies [[`db621f4`](https://github.com/lynx-family/lynx-stack/commit/db621f4baad431c6b0f2796e6ea67342f8c0ea23)]:
  - @lynx-js/autolink-codegen@0.4.1

## 0.5.1

### Patch Changes

- Use the workspace versions of `@lynx-js/react` and `@lynx-js/react-rsbuild-plugin` in generated example projects. ([#3384](https://github.com/lynx-family/lynx-stack/pull/3384))

## 0.5.0

### Minor Changes

- Add HarmonyOS Native Module spec generation and complete HAR scaffolding for Lynx Autolink libraries. ([#2990](https://github.com/lynx-family/lynx-stack/pull/2990))

### Patch Changes

- Keep the generated example's `@lynx-js/rspeedy` version aligned with the workspace release. ([#3308](https://github.com/lynx-family/lynx-stack/pull/3308))

- Updated dependencies [[`46dfcc2`](https://github.com/lynx-family/lynx-stack/commit/46dfcc2166a3750bbf2c5f5600d7b3721eac4dd2)]:
  - @lynx-js/autolink-codegen@0.4.0

## 0.4.0

### Minor Changes

- Add scaffolding and code generation support for Lynx Node-API addon libraries. ([#2958](https://github.com/lynx-family/lynx-stack/pull/2958))

  `create-lynx-library` can now generate NAPI native module packages with shared C++ sources, Android and iOS addon manifest entries, Android CMake integration backed by PrimJS 4.x runtime libraries, iOS podspec wiring, generated addon-use headers, and Lynxtron C API registration.

  `@lynx-js/autolink-codegen` now generates Node-API TypeScript facades, shared native module stubs, iOS wrapper and registration sources, Lynxtron registration sources, and an auto-installed `NativeModules` shim backed by the Lynx NAPI loader.

  The generated projects also support older Android Gradle and CMake toolchains, install all build-time packages required by published consumers, use CocoaPods-compatible podspec and header paths, and exclude local CMake dependency caches from published library tarballs.

### Patch Changes

- Update `@clack/prompts` from `1.0.1` to `1.7.0` ([#3114](https://github.com/lynx-family/lynx-stack/pull/3114))

- Updated dependencies [[`53fe61c`](https://github.com/lynx-family/lynx-stack/commit/53fe61cd0440c4e1b8b61d6e8899be008a6e5d9e)]:
  - @lynx-js/autolink-codegen@0.3.0

## 0.3.0

### Minor Changes

- Add shared native targets for native module and element library templates, with ([#2843](https://github.com/lynx-family/lynx-stack/pull/2843))
  Node-API package subpath loading for desktop hosts.

### Patch Changes

- Refine desktop element templates to share `LynxNativeView` state between Native ([#2909](https://github.com/lynx-family/lynx-stack/pull/2909))
  UI and Texture backends.

## 0.2.1

### Patch Changes

- Add Android and iOS platform selection to library scaffolding and make native autolink codegen honor the platforms declared in `lynx.lib.json`. ([#2864](https://github.com/lynx-family/lynx-stack/pull/2864))

## 0.2.0

### Minor Changes

- Rename the Native Autolink scaffold flow to libraries and switch codegen manifests to `lynx.lib.json`. ([#2729](https://github.com/lynx-family/lynx-stack/pull/2729))

### Patch Changes

- Update generated native library examples and package descriptions to use the current Lynx marker names. ([#2799](https://github.com/lynx-family/lynx-stack/pull/2799))

## 0.1.0

### Minor Changes

- Add the Native Autolink create-library package. ([#2587](https://github.com/lynx-family/lynx-stack/pull/2587))

### Patch Changes

- Use published package versions for scaffolded autolink codegen dependencies instead of workspace placeholders. ([#2628](https://github.com/lynx-family/lynx-stack/pull/2628))

- Fix npm bin symlink entrypoint detection for the create library CLI. ([#2623](https://github.com/lynx-family/lynx-stack/pull/2623))

## 0.0.0

### Minor Changes

- Initial Native Autolink library scaffolding package.
