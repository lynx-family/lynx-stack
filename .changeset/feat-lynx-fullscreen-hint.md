---
"create-rspeedy": patch
---

feat(create-rspeedy): print fullscreen URL hint in dev server output

Add a `pluginLynxFullscreenHint` Rsbuild plugin to the React-TS template that wraps `server.printUrls` and appends a `∟ No nav` entry with `?fullscreen=true` under each Lynx bundle URL. Tapping the variant opens the bundle in LynxExplorer with the in-app nav chrome stripped.
