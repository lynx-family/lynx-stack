---
"@lynx-js/react": patch
---

Add typed `MainThreadObject` handles whose target factory is defined by a Main Thread Function, with identity-preserving capture and hydration, runtime-owned reference release, and type-scoped initial-payload inspection. V1 intentionally exposes no user-land disposal API. Applications can import the APIs from `@lynx-js/react` or `@lynx-js/react/main-thread-object`.
