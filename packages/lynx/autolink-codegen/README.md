# @lynx-js/autolink-codegen

Native Autolink code generator for Lynx extensions.

It scans `types/**/*.d.ts` for native module declarations annotated with
`/** @lynxmodule */`, reads `lynx.ext.json`, and generates:

- `generated/<ModuleName>.ts`
- Android `<ModuleName>Spec.java`
- iOS `<ModuleName>Spec.h` and `<ModuleName>Spec.m`

Run it from an extension package:

```bash
npx @lynx-js/autolink-codegen
```

The installed binary name is `lynx-autolink-codegen`, so generated extensions
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
