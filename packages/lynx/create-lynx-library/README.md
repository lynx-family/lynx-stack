# create-lynx-library

Create native Lynx libraries.

```bash
npm create lynx-library
```

The interactive flow lets you choose one or more library features:

- Native Module
- Element
- Service

For non-interactive usage:

```bash
npm create lynx-library -- \
  --dir ./lynx-button \
  --features native-module,element,service \
  --package-name @example/lynx-button \
  --android-package com.example.button \
  --module-name ButtonModule \
  --element-name x-button \
  --service-name ButtonService
```

Use `--features all` to generate a package that contains all supported library
features.

Generated libraries include `lynx.lib.json`, JS facade sources, Android and
iOS native examples, an example app skeleton, and a `codegen` script powered by
the current published version of `@lynx-js/autolink-codegen`.
