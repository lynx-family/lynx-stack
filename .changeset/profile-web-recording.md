---
"@lynx-js/react": patch
"@lynx-js/web-core": patch
"@lynx-js/rspeedy": patch
---

Make ReactLynx profiling activation intentional on Web. Browser User Timing
support no longer reports active host recording by itself; use
`performance.profile: true` to include Web profiling, while native hosts can
continue activating production profiling when host recording is already active
as the ReactLynx runtime initializes.
