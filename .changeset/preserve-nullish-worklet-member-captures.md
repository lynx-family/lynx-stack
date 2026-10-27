---
"@lynx-js/react": patch
---

Preserve nullish bases (`null` and `undefined`) when narrowing worklet object-member and optional-chain captures so creating a worklet does not eagerly dereference properties on nullish objects before guards inside the worklet body run.
