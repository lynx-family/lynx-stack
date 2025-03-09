# @lynx-js/lynx-dom-jest-matchers

Lynx equivalent of [@testing-library/jest-dom](https://github.com/testing-library/jest-dom)

## Installation

This module is distributed via [npm][npm] which is bundled with [node][node] and
should be installed as one of your project's `devDependencies`:

```
npm install --save-dev @lynx-js/lynx-dom-jest-matchers
```

or

for installation with [yarn](https://yarnpkg.com/) package manager.

```
yarn add --dev @lynx-js/lynx-dom-jest-matchers
```

## Usage

Import `@lynx-js/lynx-dom-jest-matchers` once (for instance in your [tests setup file](https://vitest.dev/config/#setupfiles)) and you're good to go:

```javascript
// In your own vitest-setup.js (or any other name)
import '@lynx-js/lynx-dom-jest-matchers';

// In vitest.config.js add (if you haven't already)
setupFilesAfterEnv: ['<rootDir>/vitest-setup.js'];
```
