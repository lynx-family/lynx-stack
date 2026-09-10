---
"@lynx-js/react": patch
---

Fix `use()` from `@lynx-js/react/compat` throwing `cannot read property '__cC0' of undefined` on the main thread. The main-thread renderer never set `_globalContext` on the components it builds, and `use` reads its context provider from there. `useContext` was unaffected because it reads `context` instead.
