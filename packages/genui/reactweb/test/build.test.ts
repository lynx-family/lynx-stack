// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

// Use the shipped entry so worker lookup and package-relative dependencies are real.
const builtEntry = new URL('../dist/index.js', import.meta.url).href;
const { buildReactWeb } = await import(
  builtEntry
) as typeof import('../src/index.js');

const source = {
  files: {
    'App.tsx': `
      import { useState } from 'react';
      if (typeof document === 'undefined') throw new Error('Executed on the server');
      export default function App() {
        const [count, setCount] = useState(0);
        return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
      }
    `,
    'App.css': 'button { color: rgb(12, 34, 56); }',
  },
};

test(
  'builds self-contained HTML without executing application code',
  async () => {
    const statuses: string[] = [];
    const html = await buildReactWeb(
      source,
      new AbortController().signal,
      status => statuses.push(status),
    );
    expect(statuses).toEqual(['queued', 'building']);
    expect(html).toMatch(/^<!doctype html>/iu);
    expect(html).toContain('id="root"');
    // Inline scripts execute during parsing, even when marked defer.
    expect(html.indexOf('id="root"')).toBeLessThan(html.indexOf('<script'));
    expect(html).toMatch(/<script\b[^>]*>[\s\S]+<\/script>/u);
    expect(html).toMatch(/<style\b[^>]*>[\s\S]+<\/style>/u);
    expect(html).not.toMatch(/<script\b[^>]+\bsrc=/u);
    expect(html).not.toMatch(/<link\b[^>]+\brel="stylesheet"/u);
  },
  30_000,
);

test.each([
  [
    'unsupported module',
    'import fs from \'node:fs\'; export default () => <div />;',
  ],
  ['invalid JSX', 'export default function App() { return <div>; }'],
])('reports %s compilation failures', async (_name, app) => {
  await expect(
    buildReactWeb(
      { files: { ...source.files, 'App.tsx': app } },
      new AbortController().signal,
      () => undefined,
    ),
  ).rejects.toThrow('ReactWeb build failed');
}, 30_000);

test('cancellation ends an active build and releases its slot', async () => {
  const controller = new AbortController();
  await expect(
    buildReactWeb(source, controller.signal, status => {
      if (status === 'building') controller.abort(new Error('Stop build'));
    }),
  ).rejects.toThrow('cancelled');
  const html = await buildReactWeb(
    source,
    new AbortController().signal,
    () => undefined,
  );
  expect(html).toMatch(/<\/html>$/u);
}, 30_000);

test('does not start an already cancelled build', async () => {
  const statuses: string[] = [];
  await expect(
    buildReactWeb(
      source,
      AbortSignal.abort(new Error('Cancelled request')),
      status => statuses.push(status),
    ),
  ).rejects.toThrow('Cancelled request');
  expect(statuses).not.toContain('building');
});
