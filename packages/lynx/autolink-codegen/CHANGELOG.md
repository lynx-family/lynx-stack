# @lynx-js/autolink-codegen

## 0.3.0

### Minor Changes

- Add scaffolding and code generation support for Lynx Node-API addon libraries. ([#2958](https://github.com/lynx-family/lynx-stack/pull/2958))

  `create-lynx-library` can now generate NAPI native module packages with shared C++ sources, Android and iOS addon manifest entries, Android CMake integration backed by PrimJS 4.x runtime libraries, iOS podspec wiring, generated addon-use headers, and Lynxtron C API registration.

  `@lynx-js/autolink-codegen` now generates Node-API TypeScript facades, shared native module stubs, iOS wrapper and registration sources, Lynxtron registration sources, and an auto-installed `NativeModules` shim backed by the Lynx NAPI loader.

  The generated projects also support older Android Gradle and CMake toolchains, install all build-time packages required by published consumers, use CocoaPods-compatible podspec and header paths, and exclude local CMake dependency caches from published library tarballs.

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

- Add the Native Autolink codegen package. ([#2601](https://github.com/lynx-family/lynx-stack/pull/2601))

## 0.0.0

### Minor Changes

- Initial Native Autolink codegen package.
