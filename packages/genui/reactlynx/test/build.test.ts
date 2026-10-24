// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

// Exercise the shipped worker and its package-relative dependencies.
const builtEntry = new URL('../dist/index.js', import.meta.url).href;
const { buildReactLynx } = await import(
  builtEntry
) as typeof import('../src/index.js');

test('builds Web and Native JSX with compiler-injected imports', async () => {
  const statuses: string[] = [];
  const assets = await buildReactLynx(
    {
      files: {
        'App.tsx': `
          import { useState } from '@lynx-js/react';
          if (typeof lynx === 'undefined') throw new Error('Executed on the server');
          export default function App() {
            const [count, setCount] = useState(0);
            const props = { className: 'counter' };
            return <view bindtap={() => setCount(count + 1)}>
              <text {...props}>Count {count}</text>
            </view>;
          }
        `,
        'App.css': '.counter { color: red; }',
      },
    },
    new AbortController().signal,
    status => statuses.push(status),
  );
  expect(statuses).toEqual(['queued', 'building']);
  for (const name of ['main.web.js', 'main.lynx.js']) {
    expect(assets.find(asset => asset.name === name)?.data.length)
      .toBeGreaterThan(0);
  }
}, 30_000);

test.each([
  ['node:fs', `import fs from 'node:fs';`],
  ['React', `import { useState } from 'react';`],
  ['runtime internals', `import * as runtime from '@lynx-js/react/internal';`],
  ['SWC helpers', `import { _ } from '@swc/helpers/_/_object_spread';`],
  ['local files', `import './App.css';`],
  ['dynamic imports', `const runtime = import('@lynx-js/react');`],
])('rejects authored %s imports in the worker', async (_name, request) => {
  await expect(
    buildReactLynx(
      {
        files: {
          'App.tsx': `${request}\nexport default () => <text>Hello</text>;`,
          'App.css': '',
        },
      },
      new AbortController().signal,
      () => undefined,
    ),
  ).rejects.toThrow(
    request.startsWith('const')
      ? 'Dynamic modules and import.meta are not supported'
      : /App.tsx:1:\d+: App.tsx may only import @lynx-js\/react; unsupported module/u,
  );
}, 30_000);
