#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { readdirSync } = require('node:fs');

function findLeftoverChangesets(changesetDir = '.changeset') {
  return readdirSync(changesetDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .sort();
}

function main() {
  const changesetDir = process.argv[2] || '.changeset';
  const leftovers = findLeftoverChangesets(changesetDir);

  if (leftovers.length === 0) {
    process.stdout.write('No leftover changeset files found.\n');
    return;
  }

  process.stderr.write(
    '\nThe following changeset files were left after `pnpm changeset version`:\n\n',
  );
  for (const file of leftovers) {
    process.stderr.write(`  - ${file}\n`);
  }
  process.stderr.write(
    '\nMake sure every package named in these changesets is versioned by Changesets, or delete changesets for packages that should not be versioned.\n',
  );

  throw new Error(`${leftovers.length} leftover changeset file(s) found.`);
}

module.exports = { findLeftoverChangesets };

if (require.main === module) {
  main();
}
