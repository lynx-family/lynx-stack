#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const test = require('node:test');

const { findMissingChangesets, isShallowEqual } = require(
  './check-dep-changes-have-changeset.cjs',
);

function fakeReader(files) {
  return (path) => (path in files ? files[path] : null);
}

test('passes when no package.json changed', () => {
  const out = findMissingChangesets({
    releases: [],
    changedFiles: [],
    readCurrent: () => null,
    readBase: () => null,
  });
  assert.deepEqual(out, []);
});

test('flags `dependencies` change with no matching changeset', () => {
  const cur = JSON.stringify({ name: 'foo', dependencies: { a: '1.0.0' } });
  const base = JSON.stringify({ name: 'foo', dependencies: {} });
  const out = findMissingChangesets({
    releases: [],
    changedFiles: ['packages/foo/package.json'],
    readCurrent: fakeReader({ 'packages/foo/package.json': cur }),
    readBase: fakeReader({ 'packages/foo/package.json': base }),
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'foo');
  assert.equal(out[0].deps, true);
  assert.equal(out[0].peer, false);
});

test('flags `peerDependencies` change with no matching changeset', () => {
  const cur = JSON.stringify({
    name: 'foo',
    peerDependencies: { p: '^1.0.0 || ^2.0.0' },
  });
  const base = JSON.stringify({
    name: 'foo',
    peerDependencies: { p: '^1.0.0' },
  });
  const out = findMissingChangesets({
    releases: [],
    changedFiles: ['packages/foo/package.json'],
    readCurrent: fakeReader({ 'packages/foo/package.json': cur }),
    readBase: fakeReader({ 'packages/foo/package.json': base }),
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].peer, true);
  assert.equal(out[0].deps, false);
});

test('passes when dep change is covered by a changeset', () => {
  const cur = JSON.stringify({ name: 'foo', dependencies: { a: '1.0.0' } });
  const base = JSON.stringify({ name: 'foo', dependencies: {} });
  const out = findMissingChangesets({
    releases: [{ name: 'foo', type: 'patch' }],
    changedFiles: ['packages/foo/package.json'],
    readCurrent: fakeReader({ 'packages/foo/package.json': cur }),
    readBase: fakeReader({ 'packages/foo/package.json': base }),
  });
  assert.deepEqual(out, []);
});

test('ignores private packages', () => {
  const cur = JSON.stringify({
    name: 'foo',
    private: true,
    dependencies: { a: '1' },
  });
  const base = JSON.stringify({
    name: 'foo',
    private: true,
    dependencies: {},
  });
  const out = findMissingChangesets({
    releases: [],
    changedFiles: ['packages/foo/package.json'],
    readCurrent: fakeReader({ 'packages/foo/package.json': cur }),
    readBase: fakeReader({ 'packages/foo/package.json': base }),
  });
  assert.deepEqual(out, []);
});

test('ignores `devDependencies`-only changes', () => {
  const cur = JSON.stringify({ name: 'foo', devDependencies: { a: '2' } });
  const base = JSON.stringify({ name: 'foo', devDependencies: { a: '1' } });
  const out = findMissingChangesets({
    releases: [],
    changedFiles: ['packages/foo/package.json'],
    readCurrent: fakeReader({ 'packages/foo/package.json': cur }),
    readBase: fakeReader({ 'packages/foo/package.json': base }),
  });
  assert.deepEqual(out, []);
});

test('ignores newly added package.json files', () => {
  const cur = JSON.stringify({ name: 'foo', dependencies: { a: '1' } });
  const out = findMissingChangesets({
    releases: [],
    changedFiles: ['packages/foo/package.json'],
    readCurrent: fakeReader({ 'packages/foo/package.json': cur }),
    readBase: fakeReader({}),
  });
  assert.deepEqual(out, []);
});

test('flags multiple packages independently', () => {
  const out = findMissingChangesets({
    releases: [{ name: 'foo', type: 'patch' }],
    changedFiles: ['packages/foo/package.json', 'packages/bar/package.json'],
    readCurrent: fakeReader({
      'packages/foo/package.json': JSON.stringify({
        name: 'foo',
        dependencies: { a: '1' },
      }),
      'packages/bar/package.json': JSON.stringify({
        name: 'bar',
        peerDependencies: { p: '^2' },
      }),
    }),
    readBase: fakeReader({
      'packages/foo/package.json': JSON.stringify({
        name: 'foo',
        dependencies: {},
      }),
      'packages/bar/package.json': JSON.stringify({
        name: 'bar',
        peerDependencies: { p: '^1' },
      }),
    }),
  });
  assert.equal(out.length, 1);
  assert.equal(out[0].name, 'bar');
});

test('isShallowEqual treats reordered keys as equal', () => {
  assert.equal(
    isShallowEqual({ a: '1', b: '2' }, { b: '2', a: '1' }),
    true,
  );
});

test('isShallowEqual treats different version ranges as unequal', () => {
  assert.equal(
    isShallowEqual({ a: '^1.0.0' }, { a: '^2.0.0' }),
    false,
  );
});
