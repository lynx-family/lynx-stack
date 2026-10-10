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

test.each([1, 2])(
  'completes %i missing enclosing braces after both file strings',
  count => {
    const incomplete = JSON.stringify(source).slice(0, -count);
    expect(parseReactLynxSource(incomplete)).toEqual(source);
    expect(normalizeReactLynxSource(incomplete)).toBe(JSON.stringify(source));
  },
);

test.each([
  JSON.stringify(source).slice(0, -3),
  '{"files":{"App.tsx":"unfinished',
  '{"files":{"App.tsx":"complete" "App.css":""}',
  '{"files":{"App.tsx":"unescaped "quote"","App.css":""}',
])('rejects incomplete or malformed file strings: %s', text => {
  expect(() => parseReactLynxSource(text)).toThrow(SyntaxError);
});

test('still requires exactly two files when completing the envelope', () => {
  expect(() =>
    parseReactLynxSource(
      JSON.stringify({ files: { 'App.tsx': source.files['App.tsx'] } }).slice(
        0,
        -1,
      ),
    )
  ).toThrow();
  expect(() =>
    parseReactLynxSource(
      JSON.stringify({ files: { ...source.files, 'extra.ts': 'escape' } })
        .slice(0, -1),
    )
  ).toThrow();
});

test('counts the completed envelope toward the JSON size limit', () => {
  const incomplete = JSON.stringify({
    files: { 'App.tsx': '"'.repeat(255_000), 'App.css': '' },
  }).slice(0, -1);
  const padded = incomplete.replace(
    '{',
    `{${' '.repeat(512_000 - incomplete.length)}`,
  );
  expect(padded).toHaveLength(512_000);
  expect(() => parseReactLynxSource(padded)).toThrow(SyntaxError);
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
