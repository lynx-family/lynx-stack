# @lynx-js/stylelint-plugin

Stylelint plugin for Lynx CSS.

## Install

```bash
pnpm add -D stylelint @lynx-js/stylelint-plugin
```

**Required Stylelint Version**: `>= 16.0.0`

## Usage

Add the plugin and enable rules in your Stylelint config:

```js
// stylelint.config.js (ESM)
import lynxPlugin from '@lynx-js/stylelint-plugin';

export default {
  plugins: [lynxPlugin],
  rules: {
    'lynx/no-unsupported-properties': true,
  },
};
```

Finally run:

```bash
pnpm stylelint **/*.css
```

If you use JSON config, you may need to reference the compiled entry (depending on your tooling). Prefer JS/ESM config as above.

## Rules

### `lynx/no-unsupported-properties`

> Base on [`@lynx-js/css-defines`](https://www.npmjs.com/package/@lynx-js/css-defines)

Warns when a CSS declaration uses a property that is not supported by Lynx.

- Ignores custom properties (e.g. `--foo`)
- Supported property list is loaded from `@lynx-js/css-defines/property_index.json`

#### Options

Rule options are passed as the secondary options object:

```js
export default {
  plugins: [lynxPlugin],
  rules: {
    'lynx/no-unsupported-properties': [
      true,
      {
        allow: ['-webkit-line-clamp'],
        ignore: ['backdrop-filter'],
      },
    ],
  },
};
```

- `allow?: string[]` Add extra supported properties.
- `ignore?: string[]` Ignore these properties (do not warn).

#### Disable the rule

```js
export default {
  plugins: [lynxPlugin],
  rules: {
    'lynx/no-unsupported-properties': false,
  },
};
```
