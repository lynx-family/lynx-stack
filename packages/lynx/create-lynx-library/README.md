# create-lynx-library

Create native Lynx libraries.

```bash
npm create lynx-library
```

The interactive flow lets you choose one or more library features:

- Native Module: Android, iOS, and Harmony platform scaffolds.
- NAPI Native Module: shared C++ N-API scaffolds generated from typings.
- Element: Android, iOS, Harmony, and shared C++ scaffolds.
- Service

It also lets you choose one or more Native platforms:

- Android
- iOS
- Harmony
- Lynxtron

For non-interactive usage:

```bash
npm create lynx-library -- \
  --dir ./lynx-button \
  --features native-module,napi-native-module,element,service \
  --platforms android,ios,harmony,lynxtron \
  --package-name @example/lynx-button \
  --android-package com.example.button \
  --module-name ButtonModule \
  --element-name x-button \
  --service-name ButtonService
```

Use `--features all` to generate a package that contains all supported library
features. Use `--platforms all` to generate native directories for all supported
Native platforms. When `--platforms` is omitted in non-interactive usage,
Android, iOS, Harmony, and Lynxtron are generated.

Generated libraries include `lynx.lib.json`, JS facade sources, selected Native
platform examples, an example app skeleton, and a `codegen` script powered by the
current published version of `@lynx-js/autolink-codegen`.

Native Module declarations live in `types/platform-native-module.d.ts`. NAPI
Native Module declarations live in `types/napi-native-module.d.ts`; running
`npm run codegen` generates a minimal shared C++ N-API callback stub under
`shared/nativeModule/`.

When Harmony is selected, the generated `harmony/` directory is a source HAR.
It exports `LynxLibraryProviderImpl`, which registers the selected Element,
Native Module, and Extension Service with the Harmony global Autolink registry.
The application calls `setupGlobal()` from its generated Registry HAR before
creating a Lynx runtime.

When the `lynxtron` platform is selected for a NAPI Native Module or Element
project, generated libraries also include shared C++ sources under `shared/`, a
Lynxtron loader under `lynxtron/`, and a `build:lynxtron` script. The script
writes the current OS/architecture `.node` artifact to
`dist/<platform>/<arch>/`. The shared CMake entry lives at
`shared/CMakeLists.txt`; generated packages do not create a top-level
`CMakeLists.txt`.
