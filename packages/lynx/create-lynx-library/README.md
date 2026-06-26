# create-lynx-library

Create native Lynx libraries.

```bash
npm create lynx-library
```

The interactive flow lets you choose one or more library features:

- Native Module: Android, iOS, and shared C++ scaffolds.
- Element: Android, iOS, and shared C++ scaffolds.
- Service

It also lets you choose one or more Native platforms:

- Android
- iOS
- Lynxtron

For non-interactive usage:

```bash
npm create lynx-library -- \
  --dir ./lynx-button \
  --features native-module,element,service \
  --platforms android,ios,lynxtron \
  --package-name @example/lynx-button \
  --android-package com.example.button \
  --module-name ButtonModule \
  --element-name x-button \
  --service-name ButtonService
```

Use `--features all` to generate a package that contains all supported library
features. Use `--platforms all` to generate native directories for all supported
Native platforms. When `--platforms` is omitted in non-interactive usage,
Android, iOS, and Lynxtron are generated.

Generated libraries include `lynx.lib.json`, JS facade sources, selected Native
platform examples, an example app skeleton, and a `codegen` script powered by the
current published version of `@lynx-js/autolink-codegen`.

When the `lynxtron` platform is selected for a Native Module or Element project,
generated libraries also include shared C++ sources under `shared/`, a Lynxtron
loader under `lynxtron/`, and a `build:lynxtron` script. The script writes the
current OS/architecture `.node` artifact to
`dist/<platform>/<arch>/`. The shared CMake entry lives at
`shared/CMakeLists.txt`; generated packages do not create a top-level
`CMakeLists.txt`.
