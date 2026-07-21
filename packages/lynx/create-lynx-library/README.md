# create-lynx-library

Create native Lynx libraries.

```bash
npm create lynx-library
```

The interactive flow lets you choose one or more library features:

- Native Module: Android and iOS platform scaffolds.
- NAPI Native Module: shared C++ N-API scaffolds generated from typings.
- Element: Android, iOS, and shared C++ scaffolds.
- Service

It also lets you choose one or more Native platforms:

- Android
- iOS
- Lynxtron

For non-interactive usage:

```bash
npm create lynx-library -- \
  --dir ./lynx-button \
  --features native-module,napi-native-module,element,service \
  --platforms android,ios,lynxtron \
  --package-name @example/lynx-button \
  --android-package com.example.button \
  --module-name ButtonModule \
  --element-name x-button \
  --service-name ButtonService
```

Use `--features all` to generate a package that contains all supported library
features. Use `--platforms all` to generate native directories for all supported
Native platforms. When `--platforms` is omitted in non-interactive usage,
Android, iOS, and Lynxtron are generated.

Generated libraries include `lynx.lib.json`, JS facade sources, selected Native
platform examples, an example app skeleton, and a `codegen` script powered by the
current published version of `@lynx-js/autolink-codegen`.

Native Module declarations live in `types/platform-native-module.d.ts`. NAPI
Native Module declarations live in `types/napi-native-module.d.ts`; running
`npm run codegen` generates a minimal shared C++ N-API callback stub under
`shared/nativeModule/`.

## NAPI Native Module workflow

When `napi-native-module` is selected, the generated package depends on
`@lynx-js/weak-node-api` and `@lynx-js/lynx-library-headers`. When Android
and/or iOS is selected, the package declares Node-API addons in `lynx.lib.json`
under those platform entries. The addon name must be a simple identifier such
as `StorageModule`; scoped npm package names are supported for the package
itself, but not for the addon name. A library currently supports one NAPI native
module declaration.

Edit `types/napi-native-module.d.ts` to describe the JavaScript API:

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

- `generated/<Module>.ts` is the Android/iOS BTS TypeScript facade. It lazily
  loads the addon through `globalThis.getNapiLoader()` or
  `globalThis.__lynxNapiLoader`, exports the typed module object, and
  automatically installs a `NativeModules.<Module>` shim when the package is
  imported. Lynxtron does not import this file. Do not edit it directly; update
  the declaration file and rerun codegen instead.
- `shared/nativeModule/<Module>.cc` is the user-owned shared C++ implementation.
  Codegen creates it once and preserves it on later runs. Fill in the generated
  N-API callback method bodies, including argument parsing, validation, return
  value creation, and error handling. After changing the typings, manually keep
  this file's callbacks and exports in sync because codegen will not overwrite
  it. Keep the `NAPI_MODULE(<Module>, ...)` name aligned with `lynx.lib.json`.
- `shared/nativeModule/CMakeLists.txt` builds the shared N-API sources as an
  object target that Android and Lynxtron can reuse. iOS compiles the same
  implementation through its generated CocoaPods wrapper. Codegen creates this
  CMake file once and preserves later edits. You normally only edit it when
  adding extra C++ source files, include directories, compile definitions, or
  native dependencies.
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

If the module class is renamed, also rename or remove the old user-owned shared
C++ file and update the addon name in `lynx.lib.json`. Codegen does not delete
stale C++ files or rewrite the manifest.

For Android, the generated library project can build the addon from source via
its `externalNativeBuild` configuration. The project resolves
`org.lynxsdk.lynx:primjs` with the Gradle property `lynx.primjs.version`,
defaulting to `4.+`, extracts its native libraries, and links the addon against
`libnapi_adapter.so` and `libnapi.so`. Host apps that need a pinned PrimJS
runtime should set `lynx.primjs.version` from the root build so the addon and
host resolve the same AAR. Packages that distribute prebuilt artifacts can also
place `lib<Module>.so` files under `android/src/main/jniLibs/<abi>/`; the
Android autolink plugin copies those prebuilt libraries when present.

For iOS, the generated podspec compiles the generated wrapper and uses
`ios/addon_use.h` for the registration-symbol reference. The iOS autolink step
adds the addon pod and a generated registry pod automatically. The podspec file
is generated as `ios/<pod-name>.podspec`, matching its CocoaPods `s.name`.

In Android/iOS BTS code, import the package root to install the generated shim,
then keep the existing call shape:

```ts
import '@example/storage-library';

NativeModules.StorageModule.getValue('key');
```

When the `lynxtron` platform is selected for a NAPI Native Module or Element
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

Lynxtron BTS code does not import the package root or
`generated/<Module>.ts`; it calls the registered runtime module directly:

```ts
NativeModules.StorageModule.getValue('key');
```

Run `npm pack --dry-run` before publishing. Generated packages exclude the
local `shared/third_party/` CMake header cache, but authors should still verify
that `dist/` contains every intended Lynxtron artifact and that no other local
build outputs are included.
