#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const test = require('node:test');

const {
  DOCS_PACKAGE,
  changesetPackages,
  needsDocsChangeset,
} = require('./add-docs-changeset.cjs');

const PUBLIC = new Set(['@lynx-js/react', '@lynx-js/rspeedy', DOCS_PACKAGE]);

test('reads package names from the frontmatter', () => {
  assert.deepEqual(
    changesetPackages(
      '---\n"@lynx-js/react": patch\n\'@lynx-js/rspeedy\': minor\ncreate-rspeedy: patch\n---\n\nSummary: with a colon.\n',
    ),
    ['@lynx-js/react', '@lynx-js/rspeedy', 'create-rspeedy'],
  );
});

test('an empty changeset releases nothing', () => {
  assert.deepEqual(changesetPackages('---\n\n---\n\nNo release.\n'), []);
  assert.deepEqual(changesetPackages('No frontmatter.\n'), []);
});

test('adds the docs changeset when a public package is released', () => {
  assert.equal(needsDocsChangeset([['@lynx-js/react']], PUBLIC), true);
});

test('keeps an existing docs changeset', () => {
  assert.equal(
    needsDocsChangeset([['@lynx-js/react'], [DOCS_PACKAGE]], PUBLIC),
    false,
  );
});

test('skips releases of private or ignored packages only', () => {
  assert.equal(needsDocsChangeset([['@lynx-js/example-react']], PUBLIC), false);
  assert.equal(needsDocsChangeset([[]], PUBLIC), false);
  assert.equal(needsDocsChangeset([], PUBLIC), false);
});
