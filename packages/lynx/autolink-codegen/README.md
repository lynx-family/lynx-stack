# @lynx-js/autolink-codegen

Lynx library code generator.

It scans native module declarations annotated with `/** @lynxmodule */`, reads
`lynx.lib.json`, and generates:

- `generated/<ModuleName>.ts`
- Android `<ModuleName>Spec.java` from `types/platform-native-module.d.ts`,
  when `platforms.android` is declared
- iOS `<ModuleName>Spec.h` and `<ModuleName>Spec.m` from
  `types/platform-native-module.d.ts`, when `platforms.ios` is declared
- shared C++ N-API binding files from `types/napi-native-module.d.ts`

For NAPI native modules, codegen creates a minimal user-owned N-API callback
stub under `shared/nativeModule/`. The stub registers each module method as a
`napi_value` callback and leaves argument parsing to the method body via
`napi_callback_info`.

When a package declares NAPI native module typings, codegen writes these files
as applicable to the Native platforms in `lynx.lib.json`:

- `generated/<ModuleName>.ts`: an Android/iOS BTS TypeScript facade that lazily
  loads the addon with `globalThis.getNapiLoader()` or
  `globalThis.__lynxNapiLoader`, exports the typed module object, and
  auto-installs a `NativeModules.<ModuleName>` shim when the package is
  imported. Lynxtron does not use this facade.
- `shared/nativeModule/<ModuleName>.cc`: the shared C++ implementation file.
  Codegen creates it once and preserves it on later runs. Method callback bodies
  are intentionally user-owned so library authors can add argument parsing,
  validation, native logic, return values, and errors.
- `shared/nativeModule/CMakeLists.txt`: the shared CMake object target for NAPI
  sources. Codegen creates it once and preserves later edits. Library authors
  usually only extend it for extra C++ sources, include directories, compile
  definitions, or native dependencies. Android and Lynxtron consume this CMake
  target; iOS compiles the shared implementation through its generated
  CocoaPods wrapper instead.
- `ios/generated/<ModuleName>NapiWrapper.cc`: an iOS CocoaPods compile entry
  generated when iOS is declared. It includes the shared implementation from
  the iOS pod source root.
- `ios/addon_use.h`: generated static-registration references for the declared
  module when iOS is declared.
- `lynxtron/generated_napi_registration.cc`: the Lynxtron C API registration
  bridge generated when Lynxtron is declared and used when the package's
  `.node` binding is required.

After changing the typings, rerun codegen to refresh the facade and registration
files. Codegen does not overwrite the user-owned shared C++ implementation, so
manually keep its callbacks and exports in sync with added, removed, or renamed
methods. Put native implementation logic in
`shared/nativeModule/<ModuleName>.cc`; do not put it in generated facades or
platform wrappers. If the module class is renamed, also rename or remove the old
shared C++ file and update the addon name in `lynx.lib.json`; codegen does not
delete stale user-owned files or rewrite the manifest.

Each library currently supports one NAPI native module declaration.

For compatibility, packages without split typings still use `types/**/*.d.ts`
as platform native module declarations.

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

Web spec generation is outside this package.
