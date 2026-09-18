#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const test = require('node:test');

const { findMissingChangesets } = require(
  './check-dep-changes-have-changeset.cjs',
);

const TEMPLATE = 'packages/genui/cli/templates/default/package.json';
const PACKAGE = 'packages/genui/package.json';

function bumped(name, version) {
  return JSON.stringify({
    name,
    dependencies: { '@lynx-js/lynx-ui': version },
  });
}

function run(releases) {
  const current = {
    [TEMPLATE]: bumped('{{projectName}}', '^3.135.4'),
    [PACKAGE]: bumped('@lynx-js/genui', '^3.135.4'),
  };
  const base = {
    [TEMPLATE]: bumped('{{projectName}}', '^3.135.0'),
    [PACKAGE]: bumped('@lynx-js/genui', '^3.135.0'),
  };
  return findMissingChangesets({
    releases,
    changedFiles: Object.keys(current),
    readCurrent: (f) => current[f],
    readBase: (f) => base[f],
  }).map((m) => m.name);
}

test('scaffolding templates with a placeholder name are skipped', () => {
  // `{{projectName}}` is substituted at generation time and can never appear in
  // `changeset status` releases, so it must not be reported as missing one.
  assert.deepEqual(run([{ name: '@lynx-js/genui', type: 'patch' }]), []);
});

test('a real package with dep changes and no changeset is still reported', () => {
  assert.deepEqual(run([]), ['@lynx-js/genui']);
});
