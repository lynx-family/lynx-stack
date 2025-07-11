# @lynx-js/eslint-config-reactlynx

An unopinionated baseline ESLint configuration for ReactLynx codebases. This is based on the [eslint-config-preact](https://github.com/preactjs/eslint-config-preact) package.

## Usage

Install eslint and this config:

```
npm i -D eslint @lynx-js/eslint-config-reactlynx
```

Then you need to configure it in `eslint.config.js`.

In TS project, you can use this config like this:

```ts
import configs from '@lynx-js/eslint-config-reactlynx/ts';

export default [
  ...configs,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
    ignores: ['dist/'],
  },
];
```

In JS project, you can use this config like this:

```js
import configs from '@lynx-js/eslint-config-reactlynx';

export default [
  ...configs,
  {
    files: ['src/**/*.{js,jsx}'],
    ignores: ['dist/'],
  },
];
```
