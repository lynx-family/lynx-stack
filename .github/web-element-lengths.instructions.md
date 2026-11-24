---
applyTo: "packages/web-platform/web-elements/**"
---

Length-valued element attributes bypass CSS stylesheet transformation. Preserve CSS units and use the runtime's `--rpx-unit` and `--ppx-unit` custom properties for Lynx units rather than parsing every value as pixels. Test attribute updates and removal as well as changes to the underlying unit variables, so viewport or pixel-ratio updates do not leave stale computed lengths.
