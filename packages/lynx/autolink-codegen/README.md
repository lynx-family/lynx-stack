# @lynx-js/autolink-codegen

Lynx library code generator.

It scans `types/**/*.d.ts` for native module declarations annotated with
`/** @lynxmodule */`, reads `lynx.lib.json`, and generates:

- `generated/<ModuleName>.ts`
- Android `<ModuleName>Spec.java`, when `platforms.android` is declared
- iOS `<ModuleName>Spec.h` and `<ModuleName>Spec.m`, when `platforms.ios` is
  declared

`lynx.lib.json` must declare at least one supported Native platform under
`platforms`.

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

The first version intentionally supports only native library code generation.
Web spec generation is outside this package.
