---
"@lynx-js/react": patch
---

Preserve nullish bases (`null` and `undefined`) when narrowing worklet optional-chain member captures so creating a worklet does not eagerly dereference properties on nullish objects before guards inside the worklet body run.
