---
"@lynx-js/web-elements": patch
---

Fix `x-text` custom truncation when its `inline-truncation` is mounted inside a `lynx-wrapper`, as ReactLynx does for a conditionally rendered child. The truncation is now shown only when the text is clipped, instead of always being painted while the text falls back to a plain line clamp.
