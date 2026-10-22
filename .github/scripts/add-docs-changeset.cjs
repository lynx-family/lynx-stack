#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { execFileSync } = require('node:child_process');
const { readFileSync, readdirSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');

const DOCS_PACKAGE = '@lynx-js/lynx-stack-docs';
const DOCS_CHANGESET = 'lynx-stack-docs-release.md';

function changesetPackages(content) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  if (!frontmatter) return [];
  return frontmatter[1]
    .split(/\r?\n/)
    .map((line) => /^\s*["']?([^"':\s]+)["']?\s*:/.exec(line)?.[1])
    .filter((name) => typeof name === 'string');
}

function needsDocsChangeset(changesets, publicPackages) {
  const released = changesets.flat();
  if (released.includes(DOCS_PACKAGE)) return false;
  return released.some((name) =>
    name !== DOCS_PACKAGE && publicPackages.has(name)
  );
}

function readChangesets(dir) {
  return readdirSync(dir)
    .filter((file) => file.endsWith('.md') && file !== 'README.md')
    .map((file) => changesetPackages(readFileSync(join(dir, file), 'utf8')));
}

function readPublicPackages(cwd = process.cwd()) {
  const projects = JSON.parse(
    execFileSync('pnpm', ['list', '--recursive', '--depth', '-1', '--json'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    }),
  );
  const config = JSON.parse(
    readFileSync(join(cwd, '.changeset', 'config.json'), 'utf8'),
  );
  const ignored = new Set(config.ignore ?? []);
  return new Set(
    projects
      .filter((project) =>
        project.name && project.private !== true && !ignored.has(project.name)
      )
      .map((project) => project.name),
  );
}

function main() {
  const dir = process.argv[2] || '.changeset';
  if (!needsDocsChangeset(readChangesets(dir), readPublicPackages())) {
    process.stdout.write(`No changeset needed for ${DOCS_PACKAGE}.\n`);
    return;
  }
  const file = join(dir, DOCS_CHANGESET);
  writeFileSync(
    file,
    `---\n"${DOCS_PACKAGE}": patch\n---\n\nUpdate the API reference for this release.\n`,
  );
  process.stdout.write(`Added ${file}.\n`);
}

if (require.main === module) {
  main();
}

module.exports = { DOCS_PACKAGE, changesetPackages, needsDocsChangeset };
