# create-lynx-library

## 0.4.0

### Minor Changes

- Add scaffolding and code generation support for Lynx Node-API addon libraries. ([#2958](https://github.com/lynx-family/lynx-stack/pull/2958))

  `create-lynx-library` can now generate NAPI native module packages with shared C++ sources, Android and iOS addon manifest entries, Android CMake integration backed by PrimJS 4.x runtime libraries, iOS podspec wiring, generated addon-use headers, and Lynxtron C API registration.

  `@lynx-js/autolink-codegen` now generates Node-API TypeScript facades, shared native module stubs, iOS wrapper and registration sources, Lynxtron registration sources, and an auto-installed `NativeModules` shim backed by the Lynx NAPI loader.

  The generated projects also support older Android Gradle and CMake toolchains, install all build-time packages required by published consumers, use CocoaPods-compatible podspec and header paths, and exclude local CMake dependency caches from published library tarballs.

### Patch Changes

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
