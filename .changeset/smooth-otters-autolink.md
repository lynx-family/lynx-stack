---
"@lynx-js/autolink-codegen": minor
"create-lynx-library": minor
---

Add scaffolding and code generation support for Lynx Node-API addon libraries.

`create-lynx-library` can now generate NAPI native module packages with shared C++ sources, Android and iOS addon manifest entries, Android CMake integration backed by PrimJS 4.x runtime libraries, iOS podspec wiring, generated addon-use headers, and Lynxtron C API registration.

`@lynx-js/autolink-codegen` now generates Node-API TypeScript facades, shared native module stubs, iOS wrapper and registration sources, Lynxtron registration sources, and an auto-installed `NativeModules` shim backed by the Lynx NAPI loader.

The generated projects also support older Android Gradle and CMake toolchains, install all build-time packages required by published consumers, use CocoaPods-compatible podspec and header paths, and exclude local CMake dependency caches from published library tarballs.
