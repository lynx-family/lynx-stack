---
"@lynx-js/react": patch
---

Build the `defineDCE` value map without swc's process-wide cache, so the source map of a module no longer depends on which module was transformed before it. It made production builds non-reproducible: the source map is part of the module hash in Rspack, so an unchanged source could produce a different chunk hash, and with minification on, different mangled names.
