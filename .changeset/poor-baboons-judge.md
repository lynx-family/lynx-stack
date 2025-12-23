---
"@lynx-js/stylelint-plugin": patch
---

Introduce `@lynx-js/stylelint-plugin`.

Install dependencies:

```bash
pnpm add -D stylelint @lynx-js/stylelint-plugin
```

Add the plugin and enable rules in your Stylelint config:

```js
// stylelint.config.mjs
import lynxPlugin from '@lynx-js/stylelint-plugin';

export default {
  plugins: [lynxPlugin],
  rules: {
    'lynx/no-unsupported-properties': true,
  },
};
```

Run:

```bash
pnpm stylelint **/*.css
```
