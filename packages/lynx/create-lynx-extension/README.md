# create-lynx-extension

Create Native Autolink Lynx extensions.

```bash
npm create lynx-extension
```

The interactive flow lets you choose one or more extension types:

- Native Module
- Element
- Service

For non-interactive usage:

```bash
npm create lynx-extension -- \
  --dir ./lynx-button \
  --types native-module,element,service \
  --package-name @example/lynx-button \
  --android-package com.example.button \
  --module-name ButtonModule \
  --element-name x-button \
  --service-name ButtonService
```

Use `--types all` to generate a package that contains all supported extension
types.

Generated extensions include `lynx.ext.json`, JS facade sources, Android and
iOS native examples, an example app skeleton, and a `codegen` script powered by
the current published version of `@lynx-js/autolink-codegen`.
