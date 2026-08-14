---
"create-lynx-library": minor
---

Replace the separate `napi-native-module` feature with
`native-module-backend=platform|node-api`.

The Node-API backend generates one weak-node-api C++ implementation for
Android, iOS, HarmonyOS, and Lynxtron, generated platform registration files,
and a package-root shim that exposes the addon through
`NativeModules.<Module>`.

BREAKING CHANGE: Remove `napi-native-module` as a standalone library feature.
Use `--features native-module --native-module-backend node-api` instead. New
scaffolds also consolidate native module declarations into
`types/native-module.d.ts`.
