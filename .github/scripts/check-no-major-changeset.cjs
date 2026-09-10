#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { readFileSync } = require('node:fs');

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const raw = readFileSync(statusFile, 'utf8');
  const data = JSON.parse(raw);
  const releases = Array.isArray(data.releases) ? data.releases : [];

  const majorReleases = releases.filter((release) => release?.type === 'major');

  if (majorReleases.length === 0) {
    process.stdout.write('No major changeset bump detected.\n');
    return;
  }

  process.stderr.write('Major changeset bump detected.\n');
  for (const release of majorReleases) {
    process.stderr.write(
      `- ${release.name} (${release.oldVersion} -> ${release.newVersion})\n`,
    );
  }

  throw new Error('Major changeset bump detected.');
}

main();
