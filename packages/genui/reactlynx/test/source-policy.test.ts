// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { validateReactLynxAppSource } from '../src/source-policy.js';

test('accepts static ReactLynx imports', () => {
  expect(() =>
    validateReactLynxAppSource(
      `import { useState } from '@lynx-js/react';
export default function App() {
  const [count] = useState(0);
  return <text>{count}</text>;
}`,
    )
  ).not.toThrow();
});

test('rejects imports outside the generated source boundary', () => {
  expect(() =>
    validateReactLynxAppSource(
      `import value from './local.js'; export default value;`,
    )
  ).toThrow('App.tsx may only import @lynx-js/react');
  expect(() =>
    validateReactLynxAppSource(
      `export { value } from '@lynx-js/other';`,
    )
  ).toThrow('App.tsx may only import @lynx-js/react');
});

test.each([
  [
    `import { useState } from 'react';`,
    'App.tsx:2:26: App.tsx may only import @lynx-js/react; unsupported module "react". Import ReactLynx hooks and types from @lynx-js/react instead.',
  ],
  [
    `import './App.css';`,
    'App.tsx:2:8: App.tsx may only import @lynx-js/react; unsupported module "./App.css". Remove this import; the host imports App.css automatically.',
  ],
  [
    `export { value } from './local.js';`,
    'App.tsx:2:23: App.tsx may only import @lynx-js/react; unsupported module "./local.js". Keep components and helpers in App.tsx without importing other modules.',
  ],
])(
  'reports the unsupported request and its location for %s',
  (source, diagnostic) => {
    expect(() => validateReactLynxAppSource(`// App\n${source}`)).toThrow(
      diagnostic,
    );
  },
);

test.each([
  '@lynx-js/react/internal',
  '@lynx-js/react/lepus',
  '@lynx-js/react/lepus/jsx-runtime',
  '@lynx-js/react/runtime-components',
])('rejects authored imports of compiler-only module %s', module => {
  expect(() =>
    validateReactLynxAppSource(
      `import * as runtime from '${module}'; export default runtime;`,
    )
  ).toThrow('App.tsx may only import @lynx-js/react');
});

test('rejects dynamic module access', () => {
  expect(() =>
    validateReactLynxAppSource(`export default import('@lynx-js/react');`)
  ).toThrow('Dynamic modules and import.meta are not supported');
  expect(() => validateReactLynxAppSource(`export default import.meta.url;`))
    .toThrow('Dynamic modules and import.meta are not supported');
  expect(() =>
    validateReactLynxAppSource(`export default require('@lynx-js/react');`)
  ).toThrow('Dynamic modules and import.meta are not supported');
});
