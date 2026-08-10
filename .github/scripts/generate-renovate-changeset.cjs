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

const { parse: parseYaml } = require('yaml');

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

const WORKSPACE_FILE = 'pnpm-workspace.yaml';

function gitChangedFiles() {
  return execFileSync('git', ['diff', '--name-only', baseRef], {
    encoding: 'utf8',
  }).split('\n');
}

// Every tracked `package.json`, used when the catalog moved: a catalog bump
// changes the resolved version for its consumers without touching any of their
// manifests, so the diff alone would show nothing to bump.
function allPackageJsons() {
  return execFileSync('git', ['ls-files', '*package.json'], {
    encoding: 'utf8',
  }).split('\n');
}

function changedPackageJsons() {
  const changed = gitChangedFiles();
  const files = changed.includes(WORKSPACE_FILE)
    ? [...new Set([...changed, ...allPackageJsons()])]
    : changed;
  return files
    .filter((p) => p === 'package.json' || p.endsWith('/package.json'))
    // Scaffolding templates are not workspace members and their `name` is an
    // unsubstituted placeholder, so a changeset naming one makes
    // `changeset version` fail with "which is not in the workspace".
    .filter((p) => !p.split('/').includes('templates'));
}

// `catalog:` / `catalog:<name>` resolve through `pnpm-workspace.yaml`, so a
// dependency can change version with no edit to the package that declares it.
// Resolve both sides against their own copy of the workspace file and the
// existing comparison then sees the bump.
function readCatalogs(raw) {
  if (raw === null) return null;
  let doc;
  try {
    doc = parseYaml(raw);
  } catch {
    return null;
  }
  return { default: doc?.catalog ?? {}, named: doc?.catalogs ?? {} };
}

function resolveCatalogs(deps, catalogs) {
  const out = {};
  for (const [name, spec] of Object.entries(deps ?? {})) {
    if (!catalogs || typeof spec !== 'string' || !spec.startsWith('catalog:')) {
      out[name] = spec;
      continue;
    }
    const which = spec.slice('catalog:'.length) || 'default';
    const table = which === 'default'
      ? catalogs.default
      : catalogs.named?.[which];
    // An unknown catalog name is left as-is rather than dropped, so a typo
    // shows up as an unchanged spec instead of a phantom bump.
    out[name] = table?.[name] ?? spec;
  }
  return out;
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
  const curCatalogs = readCatalogs(
    existsSync(WORKSPACE_FILE) ? readFileSync(WORKSPACE_FILE, 'utf8') : null,
  );
  const baseCatalogs = readCatalogs(gitShow(baseRef, WORKSPACE_FILE));
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
    const curDeps = resolveCatalogs(cur.dependencies, curCatalogs);
    const baseDeps = resolveCatalogs(base.dependencies, baseCatalogs);
    const curPeer = resolveCatalogs(cur.peerDependencies, curCatalogs);
    const basePeer = resolveCatalogs(base.peerDependencies, baseCatalogs);
    const depsChanged = !isShallowEqual(curDeps, baseDeps);
    const peerChanged = !isShallowEqual(curPeer, basePeer);
    if (!depsChanged && !peerChanged) continue;
    names.add(cur.name);
    const entries = [
      ...changedEntries(curDeps, baseDeps),
      ...changedEntries(curPeer, basePeer),
    ];
    for (const e of entries) deps.set(`${e.name}\0${e.from}\0${e.to}`, e);
  }
  return {
    names: [...names].sort(),
    deps: [...deps.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

// Mirrors `createChangesetBody` in lynx-community/changeset-bot: state only the
// version landed on, never the one left behind. A dependency that moves twice
// before a release then has no intermediate state to reconcile.
function depLine({ name, to }) {
  if (to === undefined) return `Removed dependency \`${name}\`.`;
  return `Updated dependency \`${name}\` to \`${to}\`.`;
}

function describe(deps) {
  return [...new Set(deps.map(depLine))].sort().join('\n');
}

function slugify(deps) {
  return deps
    .map(({ name }) =>
      name.replace(/^@/, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(
        /^-+|-+$/g,
        '',
      )
    )
    .join('_');
}

// One changeset per set of dependencies, so a later bump of the same
// dependency rewrites the file the previous bump wrote instead of stacking a
// second entry into the same release. Keyed by the dependency names rather
// than by the branch slug, which carries the major (`renovate/motion-12.x` vs
// `renovate/motion-13.x`) and so still splits across a major bump.
function changesetPath(deps, disambiguate = false) {
  const slug = slugify(deps);
  const digest = createHash('sha1')
    .update(deps.map((d) => d.name).join('\0'))
    .digest('hex')
    .slice(0, 8);
  // Group updates can name a lot of dependencies; keep the file name bounded
  // while staying stable for the same set.
  const key = disambiguate || slug.length > 64
    ? `${slug.slice(0, 55)}-${digest}`
    : slug;
  return join('.changeset', `renovate-${key}.md`);
}

// True when the changeset already at this path is an earlier run of this same
// update rather than a different set that happens to slugify the same way
// (`@a/b` and `a.b` both give `a-b`); overwriting that would drop its entry.
function tracksSameDeps(content, deps) {
  const found = [...content.matchAll(/`([^`]+)` to `/g)].map((m) => m[1]);
  const removed = [...content.matchAll(/Removed dependency `([^`]+)`/g)]
    .map((m) => m[1]);
  const existing = new Set([...found, ...removed]);
  return existing.size === deps.length
    && deps.every((d) => existing.has(d.name));
}

function render(names, deps) {
  const frontmatter = names.map((n) => `"${n}": patch`).join('\n');
  return `---\n${frontmatter}\n---\n\n${describe(deps)}\n`;
}

function main() {
  const { names, deps } = analyze();
  if (names.length === 0) {
    process.stdout.write(
      'No dependency/peerDependency changes in publishable packages; no changeset needed.\n',
    );
    return;
  }

  let file = changesetPath(deps);
  if (existsSync(file) && !tracksSameDeps(readFileSync(file, 'utf8'), deps)) {
    file = changesetPath(deps, true);
  }

  const content = render(names, deps);
  if (existsSync(file) && readFileSync(file, 'utf8') === content) {
    process.stdout.write(`Changeset ${file} already up to date.\n`);
    return;
  }

  const existed = existsSync(file);
  writeFileSync(file, content);
  process.stdout.write(
    `${existed ? 'Updated' : 'Wrote'} ${file} bumping: ${names.join(', ')}\n`,
  );
}

if (require.main === module) {
  main();
}

module.exports = { analyze, changesetPath, render };
