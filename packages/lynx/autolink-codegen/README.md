# @lynx-js/autolink-codegen

Lynx library code generator.

It scans native module declarations annotated with `/** @lynxmodule */`, reads
`lynx.lib.json`, and generates:

- `generated/<ModuleName>.ts`
- Android `<ModuleName>Spec.java` from `types/platform-native-module.d.ts`,
  when `platforms.android` is declared
- iOS `<ModuleName>Spec.h` and `<ModuleName>Spec.m` from
  `types/platform-native-module.d.ts`, when `platforms.ios` is declared
- HarmonyOS `<ModuleName>Spec.ets` from
  `types/platform-native-module.d.ts`, when `platforms.harmony` is declared
- shared C++ N-API binding files from `types/napi-native-module.d.ts`

For NAPI native modules, codegen creates a minimal user-owned N-API callback
stub under `shared/nativeModule/`. The stub registers each module method as a
`napi_value` callback and leaves argument parsing to the method body via
`napi_callback_info`.

For compatibility, packages without split typings still use `types/**/*.d.ts`
as platform native module declarations.

`lynx.lib.json` must declare at least one supported Native platform under
`platforms`.

HarmonyOS specs support `void`, `string`, `number`, `boolean`, and nullable
primitive types. The generated file is written under
`<packageDir>/src/main/ets/generated/`, where `packageDir` defaults to
`harmony`.

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

Web spec generation is outside this package.
