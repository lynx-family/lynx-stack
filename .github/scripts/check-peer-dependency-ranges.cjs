#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const semver = require('semver');

function readWorkspacePackages(cwd = process.cwd()) {
  const raw = execFileSync(
    'pnpm',
    ['list', '--recursive', '--depth', '-1', '--json'],
    {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  const projects = JSON.parse(raw);
  if (!Array.isArray(projects)) {
    throw new TypeError('`pnpm list` output is not an array.');
  }

  return projects.map((project) => {
    const packageJsonPath = join(project.path, 'package.json');
    return {
      path: relative(cwd, packageJsonPath) || 'package.json',
      manifest: JSON.parse(readFileSync(packageJsonPath, 'utf8')),
    };
  });
}

function findOutOfRangePeerDependencies({ releases, packages }) {
  const plannedVersions = new Map(
    releases
      .filter((release) => release?.type && release.type !== 'none')
      .map((release) => [release.name, release.newVersion]),
  );
  const violations = [];

  for (const { path, manifest } of packages) {
    if (manifest.private || !manifest.name || manifest.name.includes('{{')) {
      continue;
    }

    for (
      const [dependencyName, range] of Object.entries(
        manifest.peerDependencies ?? {},
      )
    ) {
      const newVersion = plannedVersions.get(dependencyName);
      if (!newVersion) continue;

      // A workspace protocol is an explicit opt-in to pnpm-managed published
      // ranges. For example, pnpm pack turns `workspace:^` into a caret range
      // for the current workspace version, so there is no source semver range
      // for this check to widen or validate.
      if (typeof range === 'string' && range.startsWith('workspace:')) {
        continue;
      }

      const validRange = typeof range === 'string'
        ? semver.validRange(range)
        : null;
      if (
        !validRange
        || !semver.satisfies(newVersion, validRange, {
          includePrerelease: true,
        })
      ) {
        violations.push({
          dependentName: manifest.name,
          dependencyName,
          range,
          newVersion,
          path,
          invalidRange: !validRange,
        });
      }
    }
  }

  return violations;
}

module.exports = {
  findOutOfRangePeerDependencies,
  readWorkspacePackages,
};

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const status = JSON.parse(readFileSync(statusFile, 'utf8'));
  const releases = Array.isArray(status.releases) ? status.releases : [];
  const violations = findOutOfRangePeerDependencies({
    releases,
    packages: readWorkspacePackages(),
  });

  if (violations.length === 0) {
    process.stdout.write(
      'All internal peer dependency ranges cover their planned releases.\n',
    );
    return;
  }

  process.stderr.write(
    '\nThe following internal peer dependency ranges do not cover their planned releases:\n\n',
  );
  for (const violation of violations) {
    const detail = violation.invalidRange
      ? `is not a valid semver range for planned version ${violation.newVersion}`
      : `does not include planned version ${violation.newVersion}`;
    process.stderr.write(
      `  - ${violation.dependentName}: ${violation.dependencyName} ${
        JSON.stringify(violation.range)
      } ${detail}\n`
        + `    ${violation.path}\n`,
    );
  }
  process.stderr.write(
    '\nWiden the peer range to preserve compatibility, or replace it if the old range is intentionally unsupported. Add a changeset for each affected dependent package so the peer dependency change is published.\n',
  );

  throw new Error(
    `${violations.length} internal peer dependency range(s) need an explicit compatibility decision.`,
  );
}

if (require.main === module) {
  main();
}
