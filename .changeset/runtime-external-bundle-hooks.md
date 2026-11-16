---
'@lynx-js/externals-loading-webpack-plugin': minor
'@lynx-js/external-bundle-rsbuild-plugin': patch
---

Support normally bundled runtime loader modules for dynamic external URLs and custom section evaluation, with per-container factory instances and explicit configured URL inputs. Preserve standalone async predicates, lazy URL resolver callbacks, custom section loaders and deferred asynchronous startup. Resolve function-valued URLs and fetch their bundles only when the external is imported, sharing pending requests across concurrent imports.
