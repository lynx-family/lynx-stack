// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import { normalizeReactWebSource, parseReactWebSource } from '../src/source.js';

const files = {
  'App.tsx': 'export default function App() { return <button>你好</button>; }',
  'App.css': 'button { color: red; }',
};

test('normalizes fenced source without altering file contents', () => {
  const response = `\`\`\`json\n${JSON.stringify({ files }, null, 2)}\n\`\`\``;
  expect(parseReactWebSource(response)).toEqual({ files });
  expect(normalizeReactWebSource(response)).toBe(JSON.stringify({ files }));
});

test.each([
  { files: { ...files, '../outside.ts': 'export {}' } },
  { files: { 'App.tsx': files['App.tsx'] } },
  { files: { ...files, 'App.tsx': '' } },
  { files, artifact: { webUrl: 'https://example.com/untrusted.html' } },
  { files: { ...files, 'App.tsx': 'x'.repeat(256_001) } },
  { files: { ...files, 'App.css': 'x'.repeat(128_001) } },
])('rejects files outside the compiler contract (case %#)', value => {
  expect(() => parseReactWebSource(JSON.stringify(value))).toThrow();
});

test('rejects oversized envelopes before JSON parsing', () => {
  expect(() => parseReactWebSource('x'.repeat(512_001))).toThrow(
    '512 KB limit',
  );
});
