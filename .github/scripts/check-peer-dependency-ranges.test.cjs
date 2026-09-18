#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const test = require('node:test');

const { findOutOfRangePeerDependencies } = require(
  './check-peer-dependency-ranges.cjs',
);

function workspacePackage(name, peerDependencies, extra = {}) {
  return {
    path: `packages/${name.replace('@lynx-js/', '')}/package.json`,
    manifest: { name, peerDependencies, ...extra },
  };
}

function plannedReactRelease(type = 'minor') {
  return {
    name: '@lynx-js/react',
    type,
    oldVersion: '0.123.0',
    newVersion: '0.124.0',
  };
}

function findViolations(packages, releases = [plannedReactRelease()]) {
  return findOutOfRangePeerDependencies({ releases, packages });
}

test('reports a caret range that excludes the next 0.x minor', () => {
  const violations = findViolations([
    workspacePackage('@lynx-js/react-rsbuild-plugin', {
      '@lynx-js/react': '^0.123.0',
    }),
  ]);

  assert.deepEqual(violations, [
    {
      dependentName: '@lynx-js/react-rsbuild-plugin',
      dependencyName: '@lynx-js/react',
      range: '^0.123.0',
      newVersion: '0.124.0',
      path: 'packages/react-rsbuild-plugin/package.json',
      invalidRange: false,
    },
  ]);
});

test('accepts a manually widened union', () => {
  assert.deepEqual(
    findViolations([
      workspacePackage('@lynx-js/react-rsbuild-plugin', {
        '@lynx-js/react': '^0.123.0 || ^0.124.0',
      }),
    ]),
    [],
  );
});

test('accepts a broad compatibility range', () => {
  assert.deepEqual(
    findViolations([
      workspacePackage('@lynx-js/react-signals', {
        '@lynx-js/react': '>=0.121.0 <1',
      }),
    ]),
    [],
  );
});

test('reports every dependent with an out-of-range peer', () => {
  const violations = findViolations([
    workspacePackage('@lynx-js/react-rsbuild-plugin', {
      '@lynx-js/react': '^0.123.0',
    }),
    workspacePackage('@lynx-js/react-signals', {
      '@lynx-js/react': '^0.123.0',
    }),
  ]);

  assert.deepEqual(
    violations.map((violation) => violation.dependentName),
    ['@lynx-js/react-rsbuild-plugin', '@lynx-js/react-signals'],
  );
});

test('ignores peers without a planned release', () => {
  assert.deepEqual(
    findViolations([
      workspacePackage('@lynx-js/react-rsbuild-plugin', {
        '@lynx-js/rspeedy': '^0.16.0',
      }),
    ]),
    [],
  );
});

test('ignores releases with type none', () => {
  assert.deepEqual(
    findViolations(
      [
        workspacePackage('@lynx-js/react-rsbuild-plugin', {
          '@lynx-js/react': '^0.123.0',
        }),
      ],
      [plannedReactRelease('none')],
    ),
    [],
  );
});

test('treats workspace protocol peers as pnpm-managed', () => {
  assert.deepEqual(
    findViolations([
      workspacePackage('@lynx-js/web-core', {
        '@lynx-js/react': 'workspace:^',
      }),
    ]),
    [],
  );
});

test('ignores private packages because their peer metadata is not published', () => {
  assert.deepEqual(
    findViolations([
      workspacePackage(
        '@lynx-js/example-react',
        { '@lynx-js/react': '^0.123.0' },
        { private: true },
      ),
    ]),
    [],
  );
});
