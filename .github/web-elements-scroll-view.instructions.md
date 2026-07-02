---
applyTo: "packages/web-platform/web-elements/src/elements/ScrollView/**,packages/web-platform/web-elements/src/elements/htmlTemplates.ts,packages/web-platform/web-elements/src/template.rs"
---

For scroll-view fading-edge animations applied through `::part(...)` selectors, keep the `@keyframes` definitions in the same outer stylesheet scope as the `::part` animation declarations. Keyframes inside the shadow DOM template are not visible to outer `::part` rules, so Chromium can show an `animation-name` in computed styles while creating no actual `ScrollTimeline` animation.
