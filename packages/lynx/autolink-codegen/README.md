# @lynx-js/autolink-codegen

Native Autolink code generator for Lynx libraries.

It scans `types/**/*.d.ts` for native module declarations annotated with
`/** @lynxmodule */`, reads `lynx.lib.json`, and generates:

- `generated/<ModuleName>.ts`
- Android `<ModuleName>Spec.java`
- iOS `<ModuleName>Spec.h` and `<ModuleName>Spec.m`

Run it from a library package:

```bash
npx @lynx-js/autolink-codegen
```

The installed binary name is `lynx-autolink-codegen`, so generated libraries
can use:

```json
{
  "scripts": {
    "codegen": "lynx-autolink-codegen"
  }
}
```

The first version intentionally supports only Native Autolink. Web Autolink and
Web spec generation are outside this package.
