---
"@lynx-js/react-simple-styling-webpack-plugin": patch
"@lynx-js/template-webpack-plugin": patch
"@lynx-js/react-webpack-plugin": patch
"@lynx-js/react-rsbuild-plugin": patch
"@lynx-js/react": patch
---

Support Simple Styling for ReactLynx. Simple Styling is a high-performance styling solution for Lynx.

Enable it in `lynx.config.js`:

```js
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default {
  plugins: [
    pluginReactLynx({
      enableSimpleStyling: true,
    }),
  ],
};
```

Use simple styling in your code:

```js
import { SimpleStyleSheet } from '@lynx-js/react';

const styles = SimpleStyleSheet.create({
  main: {
    width: '100px',
    height: '100px',
  },
  active: {
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: 'red',
  },
  withColor: (color) => ({
    backgroundColor: color,
  }),
});

export function ComponentWithSimpleStyle({
  color,
  isActive,
}) {
  return (
    <view
      simpleStyle={[
        styles.main,
        isActive && styles.active,
        styles.withColor(color),
      ]}
    />
  );
}
```
