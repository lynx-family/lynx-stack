---
"@lynx-js/template-webpack-plugin": patch
---

Add `defaultOverflowVisible` option to `LynxTemplatePlugin`.

```js
import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin';

new LynxTemplatePlugin({
  defaultOverflowVisible: false,
});
```
