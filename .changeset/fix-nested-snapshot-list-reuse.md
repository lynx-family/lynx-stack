---
"@lynx-js/react": patch
---

Keep nested list cells bound to the correct logical item when an outer list recycles a row for another item, restore each item's own horizontal scroll position, and reuse measured cell sizes to avoid transient height changes. Suppress cross-item transitions on supported Native runtimes while retaining normal same-item animations.

Template reload, first-screen and main-thread hydration keep the existing native nested list and its offset. Preserve native-held cell roots and first-screen event mappings, forward SSR spread handlers, and keep internal scroll tracking when consumer event handlers are removed, when no authored main-thread runtime is present, or when the app bundles its own copy of the worklet runtime. A nested list recreated after offscreen edits receives its full data source, and a deferred cell that finishes after its list was destroyed is dropped. Fix retained move-clone recycle grouping for ordinary lists as well, isolate cloned values, and release cached nested-list callbacks when their owning list is destroyed.

Scroll tracking runs on Native runtimes with the UI-method and attribute-read PAPIs; it adds visible-cell data to nested-list scroll events and listens to nested-list scroll and capture-phase touchstart. Web and unsupported runtimes keep their existing binding behavior. Coalesced cell-root holders retain their native binding; this change does not claim to repair the engine's opaque-anchor behavior for every legacy-slot template. Transition suppression is not guaranteed for already-parsed `!important` declarations or arbitrary direct Native style writes outside the SDK style APIs.
