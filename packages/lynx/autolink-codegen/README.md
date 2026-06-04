# @lynx-js/autolink-codegen

Lynx native library code generator.

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

The first version intentionally supports only Lynx native libraries. Web spec
generation is outside this package.
