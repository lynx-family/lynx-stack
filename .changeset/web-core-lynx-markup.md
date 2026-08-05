---
"@lynx-js/web-core": minor
---

Support loading Lynx-specific `.xml` markup artifacts containing style,
main-thread script, and background script sections, including direct
main-thread event binding through `__AddEventListener`. Expose
`lynx.getEngine()` in Web main-thread, background, and SSR environments, and
dispatch `__DestroyLifetime` before page resources are released.
