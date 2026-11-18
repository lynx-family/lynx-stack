---
applyTo: "packages/testing-library/testing-environment/src/__tests__/**"
---

Before asserting resolved values from `__GetComputedStyleByKey`, create a page with `__CreatePage('0', 0)` and attach the element with `__AppendElement`. `__CreateView` creates a disconnected element, and jsdom 31 returns empty computed styles for disconnected elements, matching browsers. Keep unknown-property and camelCase checks on connected elements too, so their empty results exercise property lookup.
