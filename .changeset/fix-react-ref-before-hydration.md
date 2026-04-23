---
"@lynx-js/react": patch
---

Fix ref callbacks not being cleaned up or re-applied correctly when the ref at the same element slot changes across rerenders that happen before hydration (e.g. a `useEffect` triggering `setState` during the initial background render).
