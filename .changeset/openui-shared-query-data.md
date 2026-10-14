---
"@lynx-js/genui": minor
---

Add the platform-independent `@lynx-js/genui/openui/data-tools` entry with
`getQueryDefaults`, `createQueryDataStore`, and `createQueryDataTools`. Reuse parsed Query defaults,
inject scoped host storage, and restore saved values through
`initialQueryResults`. Playground now delegates complete Query value replacements to this API
while preserving its existing browser storage format. Share tool registration,
default initialization, and scope lifecycle handling independently of host transport.
