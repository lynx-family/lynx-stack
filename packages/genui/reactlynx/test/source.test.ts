// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { expect, test } from '@rstest/core';

import {
  normalizeReactLynxSource,
  parseReactLynxSource,
} from '../src/source.js';

const source = {
  files: {
    'App.tsx': 'export default function App() { return <text>Hello</text>; }',
    'App.css': '',
  },
};

test('parses the bounded two-file artifact', () => {
  expect(parseReactLynxSource(JSON.stringify(source))).toEqual(source);
  expect(
    parseReactLynxSource(`\`\`\`json\n${JSON.stringify(source)}\n\`\`\``),
  ).toEqual(source);
  expect(normalizeReactLynxSource(JSON.stringify(source))).toBe(
    JSON.stringify(source),
  );
});

test('rejects additional and path-traversing files', () => {
  expect(() =>
    parseReactLynxSource(JSON.stringify({
      files: { ...source.files, 'rspeedy.config.ts': 'throw new Error()' },
    }))
  ).toThrow();
  expect(() =>
    parseReactLynxSource(JSON.stringify({
      files: { ...source.files, '../App.tsx': 'escape' },
    }))
  ).toThrow();
});

test('enforces source size limits', () => {
  expect(() =>
    parseReactLynxSource(JSON.stringify({
      files: {
        ...source.files,
        'App.tsx': 'x'.repeat(256_001),
      },
    }))
  ).toThrow();
});
