---
applyTo: "packages/web-platform/web-elements/src/elements/common/CommonEventsAndMethods.ts"
---

Read layoutchange width and height from ResizeObserver border-box dimensions in logical CSS pixels, mapping inline/block sizes to physical axes for the target's writing mode. Do not use transformed client rectangles or integer offset dimensions for these sizes. Observe the border box so padding and border changes are detected even when the content box stays unchanged. The event's position fields currently retain their visual-coordinate behavior; changing their coordinate contract requires a separate compatibility review.
