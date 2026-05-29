---
"a2ui-playground": patch
---

Add an instant offline examples strip to the Create page so users can preview recorded A2UI streams in one click, without spending API tokens. The strip lazy-mounts each preview iframe via `IntersectionObserver` + a small per-tile mount delay to avoid the lynx-view layout race that occurs when many iframes mount concurrently. The prompt suggestion row gains a dedicated label and a horizontally scrollable chip rail mirroring the tile rail.
