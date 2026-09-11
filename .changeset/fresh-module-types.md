---
"create-lynx-library": patch
---

Export generated module objects from the public type entry to match the runtime
entry. Keep annotated class declarations as codegen inputs, not consumer-facing
constructors, for both platform and N-API native modules.
