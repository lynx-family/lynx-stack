#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Renovate `postUpgradeTasks` command. Writes a changeset that `patch`-bumps
// every publishable package whose `dependencies`/`peerDependencies` changed, so
// the bump satisfies `check-dep-changes-have-changeset.cjs`. No-op for
// devDependency-only bumps.
const { execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { readFileSync, writeFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const { isShallowEqual } = require('./check-dep-changes-have-changeset.cjs');

// Two-dot `git diff <ref>` also picks up Renovate's not-yet-committed changes.
const baseRef = process.env.RENOVATE_CHANGESET_BASE || 'origin/main';

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

function changedPackageJsons() {
  const out = execFileSync('git', ['diff', '--name-only', baseRef], {
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .filter((p) => p === 'package.json' || p.endsWith('/package.json'));
}

// Entries added, changed, or removed in `cur` vs `base` (removals have an
// `undefined` `to`, additions an `undefined` `from`).
function changedEntries(cur, base) {
  const out = [];
  const names = new Set([
    ...Object.keys(cur ?? {}),
    ...Object.keys(base ?? {}),
  ]);
  for (const name of names) {
    const from = base?.[name];
    const to = cur?.[name];
    if (from !== to) out.push({ name, from, to });
  }
  return out;
}

// Returns { names: publishable packages to bump, deps: the dep changes driving
// them }. A package is affected iff it is publishable and its `dependencies` or
// `peerDependencies` differ from the base branch.
function analyze() {
  const names = new Set();
  const deps = new Map(); // `${name}\0${from}\0${to}` -> { name, from, to }
  for (const file of changedPackageJsons()) {
    const baseRaw = gitShow(baseRef, file);
    if (baseRaw === null) continue;
    let cur;
    let base;
    try {
      cur = JSON.parse(readFileSync(file, 'utf8'));
      base = JSON.parse(baseRaw);
    } catch {
      continue;
    }
    if (cur.private || !cur.name) continue;
    const depsChanged = !isShallowEqual(cur.dependencies, base.dependencies);
    const peerChanged = !isShallowEqual(
      cur.peerDependencies,
      base.peerDependencies,
    );
    if (!depsChanged && !peerChanged) continue;
    names.add(cur.name);
    const entries = [
      ...changedEntries(cur.dependencies, base.dependencies),
      ...changedEntries(cur.peerDependencies, base.peerDependencies),
    ];
    for (const e of entries) deps.set(`${e.name}\0${e.from}\0${e.to}`, e);
  }
  return {
    names: [...names].sort(),
    deps: [...deps.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function depLine({ name, from, to }) {
  if (from === undefined) return `\`${name}\` to \`${to}\``;
  if (to === undefined) return `\`${name}\` removed (was \`${from}\`)`;
  return `\`${name}\` from \`${from}\` to \`${to}\``;
}

function describe(deps) {
  if (deps.length === 1) return `Update ${depLine(deps[0])}`;
  return `Update dependencies:\n\n${
    deps.map((d) => `- ${depLine(d)}`).join('\n')
  }`;
}

function main() {
  const { names, deps } = analyze();
  if (names.length === 0) {
    process.stdout.write(
      'No dependency/peerDependency changes in publishable packages; no changeset needed.\n',
    );
    return;
  }

  const frontmatter = names.map((n) => `"${n}": patch`).join('\n');
  const content = `---\n${frontmatter}\n---\n\n${describe(deps)}\n`;

  // Name the file by the full content digest so re-running the same update is
  // idempotent (identical file), while a different update to the same packages
  // (e.g. a newer version) gets its own file instead of colliding.
  const hash = createHash('sha1').update(content).digest('hex').slice(0, 8);
  const file = join('.changeset', `renovate-${hash}.md`);
  if (existsSync(file)) {
    // Identical content -> idempotent no-op. Different content at the same path
    // is a true sha1 collision; fail loudly rather than ship the wrong bump.
    if (readFileSync(file, 'utf8') !== content) {
      throw new Error(`Changeset digest collision at ${file}`);
    }
    process.stdout.write(`Changeset ${file} already exists; nothing to do.\n`);
    return;
  }

  writeFileSync(file, content);
  process.stdout.write(`Wrote ${file} bumping: ${names.join(', ')}\n`);
}

if (require.main === module) {
  main();
}

module.exports = { analyze };
