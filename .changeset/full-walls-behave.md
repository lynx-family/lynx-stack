---
"@lynx-js/react": patch
---

Trace refactor

- Remove `ReactLynx::renderOpcodes` from the trace
- Use `ReactLynx::transferRoot` to measure the time spent transferring the root to the background thread
