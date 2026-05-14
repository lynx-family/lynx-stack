# create-lynx-extension

Create Native Autolink Lynx extensions.

```bash
npm create lynx-extension
```

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

Generated extensions include `lynx.ext.json`, JS facade sources, Android and
iOS native examples, an example app skeleton, and a `codegen` script powered by
`@lynx-js/autolink-codegen`.
