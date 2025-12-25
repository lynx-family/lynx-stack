---
"@lynx-js/web-elements": minor
---

chore: migrate all @lynx-js/web-elements-\* packages into one

### Before

```js
import '@lynx-js/web-elements-template';
import '@lynx-js/web-elements-compat/LinearContainer';
```

### After

```js
import '@lynx-js/web-elements/html-templates';
import '@lynx-js/web-elements/compat/LinearContainer';
```
