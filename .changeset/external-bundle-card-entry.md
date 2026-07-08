---
"@lynx-js/react-webpack-plugin": patch
---

Fix `globDynamicComponentEntry is not defined` when an external bundle's main-thread section is evaluated. An external bundle is not a dynamic component, so `globDynamicComponentEntry` (only in scope for the main card and dynamic components) is undeclared there. The snapshot / element-template transform now bakes the `__Card__` entry name into an external bundle's snapshots instead of referencing the bare identifier, via a new internal `isExternalBundle` loader option.
