---
applyTo: "packages/web-platform/web-core/**,packages/web-platform/web-core-e2e/tests/reactlynx/api-get-fields/**"
---

`lynx-core` implements `NodesRef.fields()` by calling `nativeApp.getFields(type, identifier, componentId, firstOnly, fields, callback, rootUniqueId)`. Its callback consumes `{ data, status: { code, data } }`, unlike the top-level `code` used by `invokeUIMethod`. Read `dataset` through `__GetDataset` to retain typed values, and `tag` through `__GetTag` to return Lynx tag names. Verify changes with a ReactLynx fixture that executes the query directly in its initial `useEffect`.
