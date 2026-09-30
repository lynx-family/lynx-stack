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
