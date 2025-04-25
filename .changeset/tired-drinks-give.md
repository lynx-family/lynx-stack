---
"@lynx-js/react": minor
---

Fixes:

- Fixed effect hook variable capture issue where stale values might be captured in closure.
- Ensured `ref` and `useEffect()` side effects are now guaranteed to execute before event triggers.

**Breaking Changes**:

- The execution timing of `ref` and `useEffect()` side effects has been moved forward. These effects will now execute before hydration is complete, rather than waiting for the main thread update to complete.
- For components inside `<list />`, `ref` callbacks will now be triggered during background thread rendering, regardless of component visibility. If your code depends on component visibility timing, use `main-thread:ref` instead of regular `ref`.
