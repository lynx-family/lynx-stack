---
"@lynx-js/external-bundle-rsbuild-plugin": minor
---

Support Rsbuild v2 in the external bundle plugin by replacing the removed `dev.setupMiddlewares` integration with [`server.setup`](https://rsbuild.rs/guide/upgrade/v1-to-v2#others) and registering local external bundle asset middleware only during dev server startup.
