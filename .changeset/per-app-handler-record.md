---
"@lynx-js/react": patch
---

Keep the app-level callbacks in a record on the app object instead of assigning
the handlers onto it directly. The engine and lynx-core look these callbacks up
on the app by name, and that object is per card, so a runtime shared by a
LynxGroup could only ever serve whichever card assigned last. Each card now
keeps its own handlers, and `createRenderContext({ lynx })` registers against
that page's app.
