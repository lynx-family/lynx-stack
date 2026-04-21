#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const test = require('node:test');

const { findHeadingViolationsFromStatusFile } = require(
  './check-no-heading-changeset.cjs',
);

function withChangesetStatus(files, run) {
  const dir = mkdtempSync(join(tmpdir(), 'changeset-heading-check-'));
  const changesetDir = join(dir, '.changeset');
  const statusFile = join(dir, '.changeset-status.json');
  mkdirSync(changesetDir, { recursive: true });

  for (const [name, content] of Object.entries(files)) {
    writeFileSync(join(changesetDir, name), content, 'utf8');
  }

  writeFileSync(
    statusFile,
    JSON.stringify(
      {
        changesets: Object.keys(files).map((name) => ({
          id: name.replace(/\.md$/, ''),
          summary: '',
          releases: [],
        })),
      },
      null,
      2,
    ),
    'utf8',
  );

  try {
    run({ statusFile, changesetDir });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('passes when changeset files do not contain H1/H2 headings', () => {
  withChangesetStatus(
    {
      'valid.md': '---\n\'pkg\': patch\n---\n\nnormal paragraph\n',
    },
    ({ statusFile, changesetDir }) => {
      assert.deepEqual(
        findHeadingViolationsFromStatusFile(statusFile, changesetDir),
        [],
      );
    },
  );
});

test('reports H1 heading in changeset file', () => {
  withChangesetStatus(
    {
      'invalid.md': '---\n\'pkg\': patch\n---\n\n# Not Allowed\n',
    },
    ({ statusFile, changesetDir }) => {
      assert.deepEqual(
        findHeadingViolationsFromStatusFile(statusFile, changesetDir),
        [
          {
            file: 'invalid.md',
            line: 5,
            heading: '# Not Allowed',
          },
        ],
      );
    },
  );
});

test('reports H2 heading in changeset file', () => {
  withChangesetStatus(
    {
      'invalid.md': '---\n\'pkg\': patch\n---\n\n## Not Allowed\n',
    },
    ({ statusFile, changesetDir }) => {
      assert.deepEqual(
        findHeadingViolationsFromStatusFile(statusFile, changesetDir),
        [
          {
            file: 'invalid.md',
            line: 5,
            heading: '## Not Allowed',
          },
        ],
      );
    },
  );
});

test('reports H3 heading in changeset file', () => {
  withChangesetStatus(
    {
      'invalid.md': '---\n\'pkg\': patch\n---\n\n### Not Allowed\n',
    },
    ({ statusFile, changesetDir }) => {
      assert.deepEqual(
        findHeadingViolationsFromStatusFile(statusFile, changesetDir),
        [
          {
            file: 'invalid.md',
            line: 5,
            heading: '### Not Allowed',
          },
        ],
      );
    },
  );
});
