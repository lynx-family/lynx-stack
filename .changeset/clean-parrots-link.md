---
"create-lynx-library": minor
---

Keep `native-module` and `napi-native-module` as separate features, add
HarmonyOS source scaffolding for NAPI addons, and generate a Lynxtron Node-API
adapter for platform native modules.

When both module features are selected, the NAPI module uses the `Napi` suffix
and both modules are available through `NativeModules`.
