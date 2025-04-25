---
"@lynx-js/web-mainthread-apis": patch
"@lynx-js/web-worker-runtime": patch
"@lynx-js/web-core": patch
---

feat: support thread strategy `all-on-ui`

```html
<lynx-view thread-strategy="all-on-ui"></lynx-view>
```

This will make the lynx's main-thread run on the UA's main thread.

Note that the `all-on-ui` does not support the HMR & chunk splitting yet.
