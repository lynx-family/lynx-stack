---
"@lynx-js/web-elements": minor
"@lynx-js/web-style-transformer": patch
"@lynx-js/web-elements-compat": patch
---

feat: support `justify-content`, `align-self` in linear container

Now these two properties could work in a linear container.

We don't transforms the `justify-content` and `align-self` to css vars any more.

The previous version of `@lynx-js/web-core` won't work with current `@lynx-js/web-core` after this change.
