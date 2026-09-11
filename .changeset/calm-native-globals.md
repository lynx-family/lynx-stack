---
"@lynx-js/autolink-codegen": patch
---

Avoid intersecting the generated Node-API shim's dynamic global access with
host-specific NativeModules declarations, which may require fields such as bridge.
