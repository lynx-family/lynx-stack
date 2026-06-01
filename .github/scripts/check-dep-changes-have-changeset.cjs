#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');

function gitShow(ref, path) {
  try {
    return execFileSync('git', ['show', `${ref}:${path}`], {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

function changedPackageJsons(baseRef) {
  const out = execFileSync(
    'git',
    ['diff', '--name-only', `${baseRef}...HEAD`],
    { encoding: 'utf8' },
  );
  return out
    .split('\n')
    .filter((p) => p === 'package.json' || p.endsWith('/package.json'));
}

function isShallowEqual(a, b) {
  const ka = Object.keys(a ?? {});
  const kb = Object.keys(b ?? {});
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a?.[k] !== b?.[k]) return false;
  }
  return true;
}

function findMissingChangesets({
  releases,
  changedFiles,
  readCurrent,
  readBase,
}) {
  // `changeset status` lists every package in `releases`, including the ones
  // that are not bumped (`type: 'none'`). Only the packages that are actually
  // bumped ship their `package.json` change, so the rest must not be treated as
  // covered by a changeset.
  const willBump = new Set(
    releases
      .filter((r) => r.type && r.type !== 'none')
      .map((r) => r.name),
  );
  const missing = [];
  for (const file of changedFiles) {
    const cur = readCurrent(file);
    const base = readBase(file);
    if (cur === null || base === null) continue;
    let curPkg;
    let basePkg;
    try {
      curPkg = JSON.parse(cur);
      basePkg = JSON.parse(base);
    } catch {
      continue;
    }
    if (curPkg.private) continue;
    if (!curPkg.name) continue;
    const depsChanged = !isShallowEqual(
      curPkg.dependencies,
      basePkg.dependencies,
    );
    const peerChanged = !isShallowEqual(
      curPkg.peerDependencies,
      basePkg.peerDependencies,
    );
    if ((depsChanged || peerChanged) && !willBump.has(curPkg.name)) {
      missing.push({
        name: curPkg.name,
        path: file,
        deps: depsChanged,
        peer: peerChanged,
      });
    }
  }
  return missing;
}

module.exports = { findMissingChangesets, isShallowEqual };

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const baseRef = process.argv[3] || process.env.BASE_REF || 'origin/main';

  const status = JSON.parse(readFileSync(statusFile, 'utf8'));
  const releases = Array.isArray(status.releases) ? status.releases : [];

  const missing = findMissingChangesets({
    releases,
    changedFiles: changedPackageJsons(baseRef),
    readCurrent: (f) => {
      try {
        return readFileSync(f, 'utf8');
      } catch {
        return null;
      }
    },
    readBase: (f) => gitShow(baseRef, f),
  });

  if (missing.length === 0) {
    process.stdout.write(
      'All package.json dependency/peerDependency changes have a matching changeset.\n',
    );
    return;
  }

  process.stderr.write(
    '\nThe following packages changed `dependencies` or `peerDependencies` but no changeset bumps them:\n\n',
  );
  for (const m of missing) {
    const what = [m.deps && 'dependencies', m.peer && 'peerDependencies']
      .filter(Boolean)
      .join(' + ');
    process.stderr.write(`  - ${m.name}  [${what}]\n    ${m.path}\n`);
  }
  process.stderr.write(
    '\nAdd a changeset (e.g. `pnpm changeset add`) bumping each affected package so the dependency change actually ships in the next release.\n',
  );

  throw new Error(
    `${missing.length} package(s) with dep changes lack a changeset.`,
  );
}

if (require.main === module) {
  main();
}
