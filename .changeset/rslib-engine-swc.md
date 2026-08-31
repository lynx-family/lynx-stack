---
"@lynx-js/rsbuild-plugin": minor
"@lynx-js/lynx-bundle-rslib-config": minor
---

Lower an external bundle to the same ES baseline a template build uses. Its background chunk now ships `var` instead of `let`/`const`, which QuickJS parses faster, and `@lynx-js/lynx-bundle-rslib-config` no longer carries a `syntax` default of its own.
