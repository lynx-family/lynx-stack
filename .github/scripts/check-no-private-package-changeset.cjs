#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

function findPrivatePackageChangesets(changesets, workspace) {
  const privatePackages = new Set(
    workspace
      .filter((pkg) => pkg?.private && pkg.name)
      .map((pkg) => pkg.name),
  );
  const violations = [];

  for (const changeset of changesets) {
    const releases = Array.isArray(changeset?.releases)
      ? changeset.releases
      : [];
    for (const release of releases) {
      if (!privatePackages.has(release?.name)) continue;
      violations.push({
        changeset: changeset.id,
        name: release.name,
        type: release.type,
      });
    }
  }

  return violations;
}

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const status = JSON.parse(readFileSync(statusFile, 'utf8'));
  const changesets = Array.isArray(status.changesets) ? status.changesets : [];
  const workspace = JSON.parse(
    execFileSync('pnpm', ['m', 'ls', '--json', '--depth=-1'], {
      encoding: 'utf8',
    }),
  );
  const violations = findPrivatePackageChangesets(changesets, workspace);

  if (violations.length === 0) {
    process.stdout.write('No private packages found in changesets.\n');
    return;
  }

  process.stderr.write(
    'Private packages must not be included in changesets.\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      `- .changeset/${violation.changeset}.md: ${violation.name} (${violation.type})\n`,
    );
  }
  process.stderr.write(
    '\nRemove these packages from the changeset frontmatter.\n',
  );

  throw new Error('Private packages found in changesets.');
}

module.exports = { findPrivatePackageChangesets };

if (require.main === module) {
  main();
}
