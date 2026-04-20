---
"@lynx-js/web-elements": patch
"@lynx-js/web-core": patch
---

feat: add x-markdown support

Add opt-in support for the `x-markdown` element on Lynx Web, including
Markdown rendering together with its related styling, interaction, animation,
truncation, range rendering, and effect capabilities exposed through the
component API.

Update the `web-core`, `web-core-wasm`, and `web-mainthread-apis` runtime
paths to use the shared property-or-attribute setter from `web-constants`, so
custom elements such as `x-markdown` can receive structured property values
correctly instead of being forced through string-only attribute updates.

```javascript
import '@lynx-js/web-elements/XMarkdown';
```
