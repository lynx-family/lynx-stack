#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const HEADING_RE = /^\s{0,3}#{1,3}\s+\S/;

function parseChangesetIds(statusFile) {
  const data = JSON.parse(readFileSync(statusFile, 'utf8'));
  const changesets = Array.isArray(data.changesets) ? data.changesets : [];
  return changesets
    .map((changeset) => changeset?.id)
    .filter((id) => typeof id === 'string' && id.length > 0);
}

function findHeadingViolationsFromStatusFile(statusFile, changesetDir) {
  const ids = parseChangesetIds(statusFile);
  const violations = [];

  for (const id of ids) {
    const file = `${id}.md`;
    const fullPath = join(changesetDir, file);
    const lines = readFileSync(fullPath, 'utf8').split(/\r?\n/);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (!HEADING_RE.test(line)) {
        continue;
      }
      violations.push({
        file,
        line: index + 1,
        heading: line.trim(),
      });
    }
  }

  return violations;
}

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const changesetDir = process.argv[3] || '.changeset';
  const violations = findHeadingViolationsFromStatusFile(
    statusFile,
    changesetDir,
  );

  if (violations.length === 0) {
    process.stdout.write('No H1/H2/H3 headings found in changeset files.\n');
    return;
  }

  process.stderr.write(
    'H1/H2/H3 headings are not allowed in changeset files.\n',
  );
  for (const violation of violations) {
    process.stderr.write(
      `- ${violation.file}:${violation.line} -> ${violation.heading}\n`,
    );
  }

  throw new Error('H1/H2/H3 headings found in changeset files.');
}

module.exports = {
  findHeadingViolationsFromStatusFile,
};

if (require.main === module) {
  main();
}
