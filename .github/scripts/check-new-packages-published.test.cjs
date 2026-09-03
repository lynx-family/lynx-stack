#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const test = require('node:test');

const { findUnpublishedPackages, publishedNames } = require(
  './check-new-packages-published.cjs',
);

const packages = [
  { path: 'packages/a/package.json', manifest: { name: '@lynx-js/a' } },
  { path: 'packages/b/package.json', manifest: { name: '@lynx-js/b' } },
  {
    path: 'packages/c/package.json',
    manifest: { name: '@lynx-js/c', private: true },
  },
];

function publishedOn(names) {
  const published = new Set(names);
  return async (name) => published.has(name);
}

test('checks the package name and its canary name', () => {
  assert.deepEqual(publishedNames('@lynx-js/a'), [
    '@lynx-js/a',
    '@lynx-js/a-canary',
  ]);
});

test('reports a changed package that is missing on npm', async () => {
  const unpublished = await findUnpublishedPackages({
    changed: ['packages/a/package.json'],
    packages,
    isPublished: publishedOn([]),
  });
  assert.deepEqual(unpublished, [
    {
      path: 'packages/a/package.json',
      name: '@lynx-js/a',
      missing: ['@lynx-js/a', '@lynx-js/a-canary'],
    },
  ]);
});

test('reports only the names that are missing', async () => {
  const unpublished = await findUnpublishedPackages({
    changed: ['packages/a/package.json'],
    packages,
    isPublished: publishedOn(['@lynx-js/a']),
  });
  assert.deepEqual(unpublished[0].missing, ['@lynx-js/a-canary']);
});

test('ignores unchanged and private packages', async () => {
  const unpublished = await findUnpublishedPackages({
    changed: ['packages/b/package.json', 'packages/c/package.json'],
    packages,
    isPublished: publishedOn(['@lynx-js/b', '@lynx-js/b-canary']),
  });
  assert.deepEqual(unpublished, []);
});
