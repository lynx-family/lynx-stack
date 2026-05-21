#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Print the directories of publishable workspace packages that appear in the
// `releases` array of a `changeset status --output` JSON file. One path per
// line, relative to the repository root. Used by the pkg.pr.new workflow to
// publish only packages touched by a PR's changesets.
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const raw = readFileSync(statusFile, 'utf8');
  const data = JSON.parse(raw);
  const releases = Array.isArray(data.releases) ? data.releases : [];
  const affected = new Set(releases.map((r) => r?.name).filter(Boolean));

  if (affected.size === 0) {
    return;
  }

  const workspace = JSON.parse(
    execSync('pnpm m ls --json --depth=-1', { encoding: 'utf8' }),
  );

  for (const pkg of workspace) {
    if (!pkg.name || pkg.private) continue;
    if (!affected.has(pkg.name)) continue;
    process.stdout.write(`${pkg.path}\n`);
  }
}

main();
