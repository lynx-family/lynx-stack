#!/usr/bin/env node

// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Fails when a changed, publishable workspace package is not on npm yet. The
// release and canary workflows publish through npm trusted publishing (OIDC),
// which cannot create a package: the first version of both `<name>` and
// `<name>-canary` has to be published by hand before the package lands on main.
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join, relative } = require('node:path');

const REGISTRY = 'https://registry.npmjs.org/';
const TRUSTED_REPO = 'lynx-family/lynx-stack';
const TRUSTED_WORKFLOW = 'deploy-main.yml';
const PLACEHOLDER_VERSION = '0.0.0-rc.0';
const NPM_VERSION = '12';

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

function changedPackageJsons(baseRef, cwd = process.cwd()) {
  return execFileSync('git', ['diff', '--name-only', `${baseRef}...HEAD`], {
    cwd,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((file) =>
      file === 'package.json' || file.endsWith('/package.json')
    );
}

function publishedNames(name) {
  return [name, `${name}-canary`];
}

async function isPublished(name) {
  const response = await fetch(`${REGISTRY}${encodeURIComponent(name)}`, {
    method: 'HEAD',
  });
  if (response.status === 200) return true;
  if (response.status === 404) return false;
  throw new Error(`npm returned ${response.status} for ${name}`);
}

async function findUnpublishedPackages({ changed, packages, isPublished }) {
  const changedSet = new Set(changed);
  const unpublished = [];
  for (const { path, manifest } of packages) {
    if (!changedSet.has(path) || manifest.private === true || !manifest.name) {
      continue;
    }
    const missing = [];
    for (const name of publishedNames(manifest.name)) {
      if (!(await isPublished(name))) missing.push(name);
    }
    if (missing.length > 0) {
      unpublished.push({ path, name: manifest.name, missing });
    }
  }
  return unpublished;
}

async function main() {
  const baseRef = process.argv[2] || 'origin/main';
  const changed = changedPackageJsons(baseRef);
  if (changed.length === 0) {
    process.stdout.write('No package.json changes.\n');
    return;
  }

  const unpublished = await findUnpublishedPackages({
    changed,
    packages: readWorkspacePackages(),
    isPublished,
  });
  if (unpublished.length === 0) {
    process.stdout.write('All changed packages exist on npm.\n');
    return;
  }

  process.stderr.write('Packages that do not exist on npm yet:\n');
  for (const { path, missing } of unpublished) {
    process.stderr.write(`- ${path}: ${missing.join(', ')}\n`);
  }
  process.stderr.write(
    `\n${remediation(unpublished.flatMap(({ missing }) => missing))}`,
  );
  throw new Error('Unpublished packages detected.');
}

// npm trusted publishing (OIDC) cannot create a package, so a maintainer has to
// publish a placeholder by hand and then grant the workflow publish rights.
// `npm trust` exists from npm 12, which needs Node 24; every command takes the
// same npm OTP, which expires after about 30 seconds.
function remediation(names) {
  return [
    'npm trusted publishing cannot create a package, so `canary-publish` and the',
    'release would fail on main. A maintainer has to publish a placeholder for',
    'each missing name and grant the workflow publish rights. Run this with a',
    'fresh npm OTP (it expires after about 30 seconds) on Node 24. The loop',
    'stops at the first failure; on `EOTP`, re-run from the command that failed:',
    '',
    '  REG=https://registry.npmjs.org',
    '  OTP=<otp>',
    '  ROOT=$(mktemp -d)',
    `  for PKG in ${names.join(' ')}; do`,
    '    (',
    '      mkdir -p "$ROOT/$PKG" && cd "$ROOT/$PKG" &&',
    `        printf '{"name":"%s","version":"${PLACEHOLDER_VERSION}"}\\n' "$PKG" > package.json &&`,
    '        npm publish --access public --registry=$REG --otp=$OTP',
    '    ) || break',
    '    npm access set mfa=publish "$PKG" --registry=$REG --otp=$OTP || break',
    `    npx -y npm@${NPM_VERSION} trust github "$PKG" --repo=${TRUSTED_REPO} --file=${TRUSTED_WORKFLOW} \\`,
    '      --allow-publish --allow-stage-publish --yes --registry=$REG --otp=$OTP || break',
    '  done',
    '  rm -rf "$ROOT"',
    '',
    'Then re-run this check.',
    '',
  ].join('\n');
}

module.exports = { findUnpublishedPackages, publishedNames, remediation };

if (require.main === module) {
  main().catch((error) => {
    process.exitCode = 1;
    process.stderr.write(`${error.message}\n`);
  });
}
