#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const SKIPPED_DIRECTORIES = new Set([
  '.git',
  'dist',
  'lib',
  'node_modules',
  'target',
]);

function readPackageJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return undefined;
  }
}

function collectPackageJsonPaths(directory, found = new Map()) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        collectPackageJsonPaths(join(directory, entry.name), found);
      }
    } else if (entry.name === 'package.json') {
      const path = join(directory, entry.name);
      const name = readPackageJson(path)?.name;
      if (name && !found.has(name)) {
        found.set(name, path);
      }
    }
  }
  return found;
}

function majorsDeclaredInChangesets(changesets) {
  const declared = new Set();
  for (const changeset of changesets ?? []) {
    for (const release of changeset.releases ?? []) {
      if (release?.type === 'major') {
        declared.add(release.name);
      }
    }
  }
  return declared;
}

function findBumpedPeers(packageJsonPath, bumpedByName) {
  const peerDependencies = readPackageJson(packageJsonPath)?.peerDependencies;
  return Object.entries(peerDependencies ?? {})
    .filter(([name]) => bumpedByName.has(name))
    .map(([name, range]) => ({
      name,
      range,
      newVersion: bumpedByName.get(name).newVersion,
    }));
}

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

  const declared = majorsDeclaredInChangesets(data.changesets);
  const cascaded = majorReleases.filter((release) =>
    !declared.has(release.name)
  );

  if (cascaded.length > 0) {
    const bumpedByName = new Map(
      releases
        .filter((release) =>
          release?.type === 'minor' || release?.type === 'major'
        )
        .map((release) => [release.name, release]),
    );
    const packageJsonPaths = collectPackageJsonPaths(process.cwd());

    process.stderr.write(
      '\nNo changeset declares a major bump for the packages below. Changesets '
        + 'bumps a package to a major when one of its `peerDependencies` is '
        + 'released outside the declared range.\n',
    );
    for (const release of cascaded) {
      const packageJsonPath = packageJsonPaths.get(release.name);
      process.stderr.write(`\n${release.name}\n`);
      if (!packageJsonPath) {
        continue;
      }
      for (const peer of findBumpedPeers(packageJsonPath, bumpedByName)) {
        process.stderr.write(
          `  "${peer.name}": "${peer.range}" is released as ${peer.newVersion}\n`,
        );
      }
      process.stderr.write(
        `  Widen the range in ${packageJsonPath}, or lower the peer bump to a patch.\n`,
      );
    }
  }

  throw new Error('Major changeset bump detected.');
}

main();
