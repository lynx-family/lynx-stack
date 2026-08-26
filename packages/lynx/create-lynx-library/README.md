# create-lynx-library

Create native Lynx libraries.

```bash
npm create lynx-library
```

The interactive flow lets you choose one or more library features:

- Native Module
- Element: Android, iOS, HarmonyOS, and shared C++ scaffolds.
- Service

Native Module has a separate backend choice:

- `platform`: Android, iOS, and HarmonyOS use platform implementations.
  Lynxtron still uses Node-API.
- `node-api`: Android, iOS, HarmonyOS, and Lynxtron share one C++ Node-API
  implementation.

It also lets you choose one or more Native platforms:

- Android
- iOS
- HarmonyOS
- Lynxtron

For non-interactive usage:

```bash
npm create lynx-library -- \
  --dir ./lynx-button \
  --features native-module,element,service \
  --native-module-backend node-api \
  --platforms android,ios,harmony,lynxtron \
  --package-name @example/lynx-button \
  --android-package com.example.button \
  --module-name ButtonModule \
  --element-name x-button \
  --service-name ButtonService
```

Use `--features all` to generate a package that contains all supported library
features. Use `--platforms all` to generate native directories for all supported
Native platforms. When `--platforms` is omitted in non-interactive usage,
Android, iOS, HarmonyOS, and Lynxtron are generated.

Generated libraries include `lynx.lib.json`, JS facade sources, selected Native
platform examples, an example app skeleton, and a `codegen` script powered by the
current published version of `@lynx-js/autolink-codegen`.

Native Module declarations live in `types/native-module.d.ts`. The selected
backend and platforms control which implementations codegen emits. New projects
no longer generate the old `types/platform-native-module.d.ts` and
`types/napi-native-module.d.ts` split, but codegen still reads those files for
migration compatibility.

## Node-API Native Module backend

Select the shared backend with:

```bash
create-lynx-library lynx-storage \
  --features native-module \
  --native-module-backend node-api \
  --platforms android,ios,harmony,lynxtron
```

The generated package depends on `@lynx-js/weak-node-api` and
`@lynx-js/lynx-library-headers`. Shared business sources use the standard
Node-API headers from `@lynx-js/weak-node-api`:

- Android and iOS use unsuffixed `napi_*` symbols.
- HarmonyOS and Lynxtron enable weak suffix remapping.
- Android, iOS, and HarmonyOS register through `napi_module_register`.
- Lynxtron registers through `lynx_env_register_native_module`.

Edit `types/native-module.d.ts` to describe the JavaScript API:

```ts
/** @lynxmodule */
export declare class StorageModule {
  setValue(key: string, value: string): void;
  getValue(key: string): string | null;
}
```

Then run:

```bash
npm run codegen
```

The generated files have the following responsibilities:

- `generated/<Module>.ts` is the BTS TypeScript facade. It lazily loads the
  addon through `globalThis.getNapiLoader()`, `globalThis.__lynxNapiLoader`, or
  `lynx.getModuleLoader()`. For the shared Node-API backend, importing the
  package installs a JavaScript `NativeModules.<Module>` shim and forwards all
  unrelated module names to the original native HostObject. Do not edit it
  directly; update the declaration file and rerun codegen instead.
- `shared/nativeModule/<Module>.cc` is the user-owned shared C++ implementation.
  Codegen creates it once and preserves it on later runs. Fill in the generated
  N-API callback method bodies, including argument parsing, validation, return
  value creation, and error handling. After changing the typings, manually keep
  this file's callbacks and exports in sync because codegen will not overwrite
  it.
- `shared/nativeModule/generated/<Module>Registration.cc` is overwritten by
  codegen and owns Android, iOS, and HarmonyOS registration boilerplate. Do not
  move registration macros into the user-owned implementation.
- `shared/nativeModule/CMakeLists.txt` builds the shared N-API sources as an
  object target that Android, HarmonyOS, and Lynxtron reuse. iOS compiles the
  same implementation through its generated CocoaPods wrapper.
- `ios/generated/<Module>NapiWrapper.cc` is an iOS CocoaPods compile entry that
  is generated when iOS is selected and includes the shared implementation from
  inside the iOS pod source root. Do not put business logic in this wrapper;
  keep it in `shared/nativeModule/<Module>.cc`.
- `ios/addon_use.h` exposes `NAPI_USE(<Module>)` so the generated iOS autolink
  registry can keep the Node-API registration symbol from being stripped by the
  linker.
- `lynxtron/generated_napi_registration.cc` is generated when Lynxtron is
  selected and registers the shared creator through the Lynxtron C API when the
  `.node` binding is required.
- `harmony/src/main/cpp/harmony_entry.cc` is the system OHOS N-API entry exposed
  to ArkTS. It only loads the HAR native library; shared business sources remain
  on weak Node-API symbols.

If the module class is renamed, also rename or remove the old user-owned shared
C++ file and update the addon name in `lynx.lib.json`. Codegen does not delete
stale C++ files or rewrite the manifest.

For Android, the generated library project can build the addon from source via
its `externalNativeBuild` configuration. The project resolves
`org.lynxsdk.lynx:primjs` with the Gradle property `lynx.primjs.version`,
defaulting to `4.+`, extracts its native libraries, and links the addon against
`libnapi_adapter.so` and `libnapi.so`. `libnapi_adapter.so` contains the
non-suffixed weak-node-api implementation and injects a PrimJS-backed host table,
so shared source continues to call the standard Node-API functions. Host apps
that need a pinned PrimJS runtime should set `lynx.primjs.version` from the root
build so the addon and host resolve the same AAR. The default manifest omits
`jniLibsDir`, which tells Android AutoLink that the generated Android library
project builds the addon. Packages that distribute prebuilt artifacts instead
can set `jniLibsDir` explicitly; AutoLink then copies `lib<Module>.so` from each
ABI subdirectory.

For iOS, the generated podspec compiles the generated wrapper and uses
`ios/addon_use.h` for the registration-symbol reference. The iOS autolink step
adds the addon pod and a generated registry pod automatically. The addon compiles
against the standard headers and implementation from `LynxWeakNodeAPI/core`;
the generated registry owns the one-time PrimJS bridge initialization before it
uses any addon registration. The podspec file is generated as
`ios/<pod-name>.podspec`, matching its CocoaPods `s.name`.

For HarmonyOS, the package contains a source HAR, links the shared weak Node-API
implementation, and exports an idempotent initializer. Harmony AutoLink imports
and calls that initializer during AppStartup before registering any optional
platform provider from the same package.

Import the package root in BTS on every selected platform, then use one call
shape:

```ts
import '@example/storage-library';

NativeModules.StorageModule.getValue('key');
```

When the `lynxtron` platform is selected for a Node-API Native Module or Element
project, generated libraries also include shared C++ sources under `shared/`, a
Lynxtron loader under `lynxtron/`, and a `build:lynxtron` script. The script
writes the current OS/architecture `.node` artifact to
`dist/<platform>/<arch>/`. The shared CMake entry lives at
`shared/CMakeLists.txt`; generated packages do not create a top-level
`CMakeLists.txt`. Requiring `./lynxtron` loads the dynamic library and registers
the generated NAPI creator with `lynx_env_register_native_module`; the require
result continues to expose `initialize()` without exposing the BTS module API.

Build `dist/<platform>/<arch>/` on every Lynxtron OS/architecture that the npm
package supports before publishing. `npm pack` and `npm publish` do not compile
native artifacts. The Node.js main thread requires the Lynxtron subpath and
calls `initialize()`:

<!-- eslint-disable-next-line n/no-missing-require -->

```cjs
const addon = require('@example/storage-library/lynxtron');

addon.initialize();
```

Lynxtron BTS imports the package root like the other platforms and calls the
registered runtime module directly:

```ts
import '@example/storage-library';

NativeModules.StorageModule.getValue('key');
```

Run `npm pack --dry-run` before publishing. Generated packages exclude the
local `shared/third_party/` CMake header cache, but authors should still verify
that `dist/` contains every intended Lynxtron artifact and that no other local
build outputs are included.
