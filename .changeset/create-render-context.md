---
"@lynx-js/react": minor
---

Add `createRenderContext({ lynx })`, which installs the runtime's app-level
callbacks for the calling page and returns that page's root. A runtime shared
between the cards of a LynxGroup is evaluated once, so the callbacks it installs
at module scope would otherwise belong to whichever card was evaluated first.

The adapters and hooks that belong to the runtime rather than to a page are
installed only on the first call.

Registration happens synchronously when it is called, and rendering does not,
so a page may defer `render` without missing the engine's queued first-screen
events.
