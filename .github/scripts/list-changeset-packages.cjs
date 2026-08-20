#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Print the directories of publishable workspace packages that appear in the
// `releases` array of a `changeset status --output` JSON file, plus every
// workspace package they depend on. One path per line, relative to the
// repository root. Used by the pkg.pr.new workflow.
//
// A `workspace:` dependency that is not published alongside its dependent
// resolves to the dependent's local version, which may never have been
// released — `@lynx-js/genui` depending on `@lynx-js/react-signals@0.0.1`
// made every preview 404 on install. Publishing the closure keeps the
// preview self-consistent: those deps become pkg.pr.new URLs pinned to the
// same commit.
const { execSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const RUNTIME_DEPENDENCY_FIELDS = [
  'dependencies',
  'peerDependencies',
  'optionalDependencies',
];

function readWorkspace() {
  const packages = JSON.parse(
    execSync('pnpm m ls --json --depth=-1', { encoding: 'utf8' }),
  );

  const byName = new Map();
  for (const pkg of packages) {
    if (!pkg.name) continue;
    const manifest = JSON.parse(
      readFileSync(path.join(pkg.path, 'package.json'), 'utf8'),
    );
    byName.set(pkg.name, {
      path: pkg.path,
      private: pkg.private === true || manifest.private === true,
      manifest,
    });
  }
  return byName;
}

function workspaceDependenciesOf(pkg, workspace) {
  const names = [];
  for (const field of RUNTIME_DEPENDENCY_FIELDS) {
    const deps = pkg.manifest[field];
    if (!deps) continue;
    for (const [name, spec] of Object.entries(deps)) {
      if (
        typeof spec === 'string' && spec.startsWith('workspace:')
        && workspace.has(name)
      ) names.push(name);
    }
  }
  return names;
}

function expandToDependencyClosure(seed, workspace) {
  const closure = new Set();
  const queue = [...seed];

  while (queue.length > 0) {
    const name = queue.pop();
    if (closure.has(name)) continue;
    closure.add(name);

    const pkg = workspace.get(name);
    if (!pkg) continue;

    for (const dependency of workspaceDependenciesOf(pkg, workspace)) {
      if (!closure.has(dependency)) queue.push(dependency);
    }
  }

  return closure;
}

function main() {
  const statusFile = process.argv[2] || '.changeset-status.json';
  const raw = readFileSync(statusFile, 'utf8');
  const data = JSON.parse(raw);
  const releases = Array.isArray(data.releases) ? data.releases : [];
  // `releases` includes packages reached via the dependency graph with
  // `type: "none"` — those don't actually get a version bump, so skip them.
  const affected = new Set(
    releases
      .filter((r) => r?.type && r.type !== 'none')
      .map((r) => r.name)
      .filter(Boolean),
  );

  if (affected.size === 0) {
    return;
  }

  const workspace = readWorkspace();
  const closure = expandToDependencyClosure(affected, workspace);

  for (const name of closure) {
    const pkg = workspace.get(name);
    if (pkg?.private && !affected.has(name)) {
      process.stderr.write(
        `warning: ${name} is a workspace dependency of a published package but is private; `
          + `previews will resolve it from the registry.\n`,
      );
    }
  }

  for (const [name, pkg] of workspace) {
    if (pkg.private) continue;
    if (!closure.has(name)) continue;
    process.stdout.write(`${pkg.path}\n`);
  }
}

main();
