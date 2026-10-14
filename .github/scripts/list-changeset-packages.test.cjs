// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '../..');
const script = path.join(__dirname, 'list-changeset-packages.cjs');

function fixture(t, releases) {
  const tmp = path.join(root, '.tmp');
  fs.mkdirSync(tmp, { recursive: true });
  const dir = fs.mkdtempSync(path.join(tmp, 'preview-peer-closure-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const write = (name, value) => {
    const target = path.join(dir, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(value));
  };
  write('package.json', {
    name: 'preview-peer-closure-fixture',
    private: true,
    packageManager: JSON.parse(
      fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
    ).packageManager,
  });
  fs.writeFileSync(
    path.join(dir, 'pnpm-workspace.yaml'),
    'packages:\n  - packages/*\n',
  );
  write('packages/plugin/package.json', {
    name: '@test/plugin',
    version: '0.20.4',
    dependencies: { '@test/helper': 'workspace:*' },
    peerDependencies: { '@test/runtime': '^0.128.0', react: '^19.0.0' },
    peerDependenciesMeta: { '@test/runtime': { optional: true } },
    devDependencies: { '@test/dev-only': 'workspace:*' },
  });
  for (const name of ['helper', 'runtime', 'dev-only']) {
    write(`packages/${name}/package.json`, {
      name: `@test/${name}`,
      version: '0.127.0',
    });
  }
  write('status.json', { releases });
  return { dir, status: path.join(dir, 'status.json') };
}

test('previews include explicit internal peers without their own changeset', t => {
  const { dir, status } = fixture(t, [
    { name: '@test/plugin', type: 'patch' },
    { name: '@test/runtime', type: 'none' },
  ]);
  const output = execFileSync(process.execPath, [script, status], {
    cwd: dir,
    encoding: 'utf8',
  });
  assert.deepEqual(
    output.trim().split(/\r?\n/).map(p => path.relative(dir, p)).sort(),
    ['helper', 'plugin', 'runtime'].map(p => path.join('packages', p)),
  );
});

test('previews publish nothing when no package is bumped', t => {
  const { dir, status } = fixture(t, [
    { name: '@test/plugin', type: 'none' },
  ]);
  assert.equal(
    execFileSync(process.execPath, [script, status], {
      cwd: dir,
      encoding: 'utf8',
    }),
    '',
  );
});
