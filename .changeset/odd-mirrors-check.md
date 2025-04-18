---
"@lynx-js/web-style-transformer": minor
"@lynx-js/web-elements": minor
"@lynx-js/web-core": minor
---

feat: improve compatibility for chrome 108 & support linear-gradient for nested x-text

**This is a breaking change**

- Please upgrade your `@lynx-js/web-elements` to >=0.6.0
- Please upgrade your `@lynx-js/web-core` to >=0.12.0
- The compiled lynx template json won't be impacted.

On chrome 108, the `-webkit-background-clip:text` cannot be computed by a `var(--css-var-value-text)`

Therefore we move the logic into style transformation logic.

Now the following status is supported

```
<text style="color:linear-gradient()">
  <text>
  <text>
</text>
```
