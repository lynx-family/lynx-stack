#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { findLeftoverChangesets } = require(
  './check-no-leftover-changesets.cjs',
);

function withChangesetDir(files, run) {
  const dir = mkdtempSync(join(tmpdir(), 'leftover-changeset-check-'));
  const changesetDir = join(dir, '.changeset');
  mkdirSync(changesetDir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(changesetDir, name), content, 'utf8');
  }

  try {
    run(changesetDir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('passes when no unreleased changeset markdown files remain', () => {
  withChangesetDir(
    {
      'config.json': '{}\n',
      'README.md': '# Changesets\n',
    },
    (changesetDir) => {
      assert.deepEqual(findLeftoverChangesets(changesetDir), []);
    },
  );
});

test('reports unreleased changeset markdown files left after versioning', () => {
  withChangesetDir(
    {
      'config.json': '{}\n',
      'README.md': '# Changesets\n',
      'private-package.md':
        '---\n"private-pkg": patch\n---\n\nPrivate change.\n',
    },
    (changesetDir) => {
      assert.deepEqual(findLeftoverChangesets(changesetDir), [
        'private-package.md',
      ]);
    },
  );
});
