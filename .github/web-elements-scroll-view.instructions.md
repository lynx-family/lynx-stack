---
applyTo: "packages/web-platform/web-elements/src/elements/ScrollView/**,packages/web-platform/web-elements/src/elements/htmlTemplates.ts,packages/web-platform/web-elements/src/template.rs"
---

For scroll-view fading-edge animations applied through `::part(...)` selectors, keep the `@keyframes` definitions in the same outer stylesheet scope as the `::part` animation declarations. Keyframes inside the shadow DOM template are not visible to outer `::part` rules, so Chromium can show an `animation-name` in computed styles while creating no actual `ScrollTimeline` animation.

Keep optional scroll-view behavior in an `AttributeReactiveClass` plugin with no observed attributes, and register it before `@lynx-js/web-elements/all` so declarative elements are upgraded with the plugin. Runtime `registerPlugin` calls only affect instances constructed afterward. For mouse-drag scrolling, filter each PointerEvent by pointer type instead of disabling the plugin through a one-time device capability check, because hybrid devices can expose both touch and mouse input. Let the nearest scroll-view own a pointer sequence, but build per-axis chains from its composed path so orthogonal nesting works and unused distance can propagate at a boundary; stop propagation when the current container's computed `overscroll-behavior` is `contain` or `none`. Install post-drag click suppression on window capture before pointerup so document/root capture listeners cannot observe the synthetic click.

Coalesce repeated mouse-drag `pointermove` updates through `boostedQueueMicrotask`, store only the latest pending delta, and flush it when the drag ends so synchronous pointerup or teardown cannot drop the final scroll position.
