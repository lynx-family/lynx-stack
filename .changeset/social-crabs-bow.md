---
"@lynx-js/web-mainthread-apis": patch
---

fix: correctly handle with CSS compound-selector, such as `.a.b`, which will be processed as `.a .b` incorrectly.

This problem also occurs when used in combination with other selectors, here are some ways to write styles that worked incorrectly before this commit:

- `.a.b { }`
- `.a.b view { }`
- `.a.b:not(.c) { }`
- `.a.b::placeholder { }`
