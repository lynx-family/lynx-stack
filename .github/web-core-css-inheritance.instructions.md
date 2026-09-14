---
applyTo: "packages/web-platform/web-core/**,packages/web-platform/web-core-e2e/**"
---

Implement page-level CSS inheritance through the same page-attribute path in client element APIs and SSR. WebEncodePlugin already merges sourceContent.config into pageConfig. Text color inheritance must include `--lynx-text-bg-color`, `background-clip`, and `-webkit-background-clip`: the color transformer represents gradient colors as transparent text plus a background image, and x-text.css resets that image at view-to-text boundaries. Keep inheritance rules below authored text styles in specificity and test both solid and gradient overrides, wrapper elements, and disabled configurations.
