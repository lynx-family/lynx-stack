# @lynx-js/autolink-codegen

## 0.5.0

### Minor Changes

- Generate separate Lynxtron registration paths for platform and NAPI native ([#3646](https://github.com/lynx-family/lynx-stack/pull/3646))
  modules, register shared NAPI addons with standard `napi_module_register`, and
  preserve existing AutoLink modules before falling back to runtime loaders.

### Patch Changes

- Fix strict TypeScript checks for generated Node-API facades and scope generated podspecs to iOS. ([#3733](https://github.com/lynx-family/lynx-stack/pull/3733))

- Prefer the unambiguous LynxWeakNodeAPI C++ header in generated Node-API sources when it is available. ([#3737](https://github.com/lynx-family/lynx-stack/pull/3737))

## 0.4.1

### Patch Changes

- Build shared Node-API module sources against `@lynx-js/weak-node-api` on every ([#3403](https://github.com/lynx-family/lynx-stack/pull/3403))
  platform while limiting weak suffix remapping to runtimes that require it.

## 0.4.0

### Minor Changes

- Add HarmonyOS Native Module spec generation and complete HAR scaffolding for Lynx Autolink libraries. ([#2990](https://github.com/lynx-family/lynx-stack/pull/2990))

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
