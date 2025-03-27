---
"@lynx-js/web-core": patch
---

fix(web): rsbuild will bundle 2 exactly same chunk for two same `new Worker` stmt

the bundle size will be optimized about 28.2KB
