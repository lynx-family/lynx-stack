# @lynx-js/autolink-codegen

Lynx library code generator.

It scans native module declarations annotated with `/** @lynxmodule */`, reads
`lynx.lib.json`, and generates:

- `generated/<ModuleName>.ts`
- Android, iOS, and HarmonyOS platform specs from
  `types/platform-native-module.d.ts`
- shared C++ Node-API bindings from `types/napi-native-module.d.ts`
- a shared Node-API adapter for platform native modules when Lynxtron is
  selected

Projects keep the two module capabilities separate:

- `types/platform-native-module.d.ts` describes platform native modules. On
  Android, iOS, and HarmonyOS codegen emits platform specs. On Lynxtron it emits
  a shared Node-API adapter registered by `lynx_env_register_native_module`.
- `types/napi-native-module.d.ts` describes a standard Node-API addon shared by
  Android, iOS, HarmonyOS, and Lynxtron. It is registered with
  `napi_module_register` and exposed through the generated `NativeModules` shim.

For compatibility, packages without split typings still use
`types/**/*.d.ts` as platform native module declarations.

For Node-API native modules, codegen creates a minimal user-owned Node-API callback
stub under `shared/nativeModule/`. The stub registers each module method as a
`napi_value` callback and leaves argument parsing to the method body via
`napi_callback_info`.

When a package declares Node-API native module metadata, codegen writes these files
as applicable to the Native platforms in `lynx.lib.json`:

- `generated/<ModuleName>.ts`: a BTS TypeScript facade that lazily loads the
  addon through `globalThis.getNapiLoader()`, `globalThis.__lynxNapiLoader`, or
  the standard `lynx.getModuleLoader()` fallback. For a NAPI native module,
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
  registration code used by Android, iOS, HarmonyOS, and Lynxtron. It is
  overwritten on every codegen run.
- `shared/nativeModule/CMakeLists.txt`: the shared CMake object target for NAPI
  sources. Android, HarmonyOS, and Lynxtron consume this target; iOS compiles
  the same implementation through its generated CocoaPods wrapper.
- `ios/generated/<ModuleName>NapiWrapper.cc`: an iOS CocoaPods compile entry
  generated when iOS is declared. It includes the shared implementation from
  the iOS pod source root.
- `ios/addon_use.h`: generated static-registration references for the declared
  module when iOS is declared.
- `lynxtron/generated_napi_registration.cc`: invokes the standard
  `_napi_register_xx_<ModuleName>()` entry when the Lynxtron `.node` binding is
  required.

When a package declares platform native module typings and Lynxtron, codegen
also writes `lynxtron/generated_platform_registration.cc`. It registers the
Lynxtron adapters through `lynx_env_register_native_module`.

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
HarmonyOS and Lynxtron enable weak suffix remapping. The NAPI module
registration generated for mobile and Lynxtron uses `napi_module_register`;
only the Lynxtron adapter for a platform native module uses
`lynx_env_register_native_module`.

Each library currently supports one Node-API native module declaration.

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
