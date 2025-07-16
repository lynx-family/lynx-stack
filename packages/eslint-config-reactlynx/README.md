# @lynx-js/eslint-config-reactlynx

An unopinionated baseline ESLint configuration for ReactLynx codebases. This is based on the [eslint-config-preact](https://github.com/preactjs/eslint-config-preact) package.

## Usage

Install eslint and this config:

```
npm i -D eslint @lynx-js/eslint-config-reactlynx
```

Then you need to configure it in `eslint.config.js`.

In TS project, you can use this config like this:

```js
import { globalIgnores } from 'eslint/config';
import * as tseslint from 'typescript-eslint';

import configs from '@lynx-js/eslint-config-reactlynx/ts';

/** @type {tseslint.ConfigArray} */
const config = tseslint.config([
  ...configs,
  {
    files: ['src/**/*.{js,jsx,ts,tsx}'],
  },
  globalIgnores(['dist']),
]);

export default config;
```

In JS project, you can use this config like this:

```js
import { defineConfig, globalIgnores } from 'eslint/config';

import configs from '@lynx-js/eslint-config-reactlynx';

export default defineConfig([
  ...configs,
  {
    files: ['src/**/*.{js,jsx}'],
  },
  globalIgnores(['dist']),
]);
```
