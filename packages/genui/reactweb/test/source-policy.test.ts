// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { validateReactWebAppSource } from '../src/source-policy.js';

test('accepts React hooks and ordinary JSX with import-like text', () => {
  expect(() =>
    validateReactWebAppSource(`
      import { useState } from 'react';
      export default function App() {
        const [count, setCount] = useState(0);
        return <button onClick={() => setCount(count + 1)}>
          {"require('example') import.meta"} {count}
        </button>;
      }
    `)
  ).not.toThrow();
});

test.each([
  'import fs from \'node:fs\';',
  'export { default } from \'/etc/passwd\';',
  'import \'./App.css\';',
  'import(\'react\');',
  'const load = require; load(\'node:fs\');',
  'const url = new URL("./secret", import.meta.url);',
  'module.exports = 1;',
  '__webpack_require__(1);',
  'import foo = require("foo");',
])('rejects compiler module access: %s', source => {
  expect(() => validateReactWebAppSource(source)).toThrow();
});
