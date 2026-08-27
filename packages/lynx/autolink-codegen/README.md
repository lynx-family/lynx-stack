# @lynx-js/autolink-codegen

Lynx library code generator.

It scans native module declarations annotated with `/** @lynxmodule */`, reads
`lynx.lib.json`, and generates:

- `generated/<ModuleName>.ts`
- Android, iOS, and HarmonyOS platform specs when the manifest selects platform
  native modules
- shared C++ Node-API binding and registration files when the manifest declares
  Node-API addons

New projects declare their API in `types/native-module.d.ts`. The legacy
`types/platform-native-module.d.ts` and `types/napi-native-module.d.ts` files
remain supported for migration. `types/native-module.d.ts` takes precedence:
when it exists, codegen ignores both legacy files. Move all declarations in one
step.

For Node-API native modules, codegen creates a minimal user-owned Node-API callback
stub under `shared/nativeModule/`. The stub registers each module method as a
`napi_value` callback and leaves argument parsing to the method body via
`napi_callback_info`.

When a package declares Node-API native module metadata, codegen writes these files
as applicable to the Native platforms in `lynx.lib.json`:

- `generated/<ModuleName>.ts`: a BTS TypeScript facade that lazily loads the
  addon through `globalThis.getNapiLoader()`, `globalThis.__lynxNapiLoader`, or
  the standard `lynx.getModuleLoader()` fallback. For a pure Node-API backend,
  importing the package replaces the bundle-local `NativeModules` variable with
  a JavaScript proxy. The proxy exposes `NativeModules.<ModuleName>` from the
  addon and forwards every other property to the original native HostObject.
  Its target is a plain JavaScript object rather than the HostObject itself, so
  the shim does not violate JavaScript proxy invariants.
- `shared/nativeModule/<ModuleName>.cc`: the shared C++ implementation file.
  Codegen creates it once and preserves it on later runs. Method callback bodies
  are intentionally user-owned so library authors can add argument parsing,
  validation, native logic, return values, and errors.
- `shared/nativeModule/generated/<ModuleName>Registration.cc`: generated
  Android, iOS, and HarmonyOS registration code. It is overwritten on every
  codegen run.
- `shared/nativeModule/CMakeLists.txt`: the shared CMake object target for NAPI
  sources. Android, HarmonyOS, and Lynxtron consume this target; iOS compiles
  the same implementation through its generated CocoaPods wrapper.
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

All shared business sources use the standard headers from
`@lynx-js/weak-node-api`. Android and iOS use unsuffixed symbols, while
HarmonyOS and Lynxtron enable weak suffix remapping.

Each library currently supports one Node-API native module declaration.

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
