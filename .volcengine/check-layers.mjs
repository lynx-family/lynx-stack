// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-runtime-layers-'));
function write(p, content) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}
function run(cmd, args, opts = {}) {
  const r = cp.spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  assert.equal(r.status, 0, `${cmd} ${args.join(' ')}\n${r.stderr}`);
  return r.stdout.trim();
}
function treeDigest(dir) {
  const hash = crypto.createHash('sha256');
  function walk(p) {
    const stat = fs.lstatSync(p);
    const rel = path.relative(dir, p);
    hash.update(JSON.stringify([rel, stat.mode, stat.mtimeMs]));
    if (stat.isSymbolicLink()) hash.update(fs.readlinkSync(p));
    else if (stat.isDirectory()) {
      fs.readdirSync(p).sort().forEach(n => walk(path.join(p, n)));
    } else hash.update(fs.readFileSync(p));
  }
  walk(dir);
  return hash.digest('hex');
}
try {
  const dockerfile = fs.readFileSync('Dockerfile', 'utf8');
  const partition = dockerfile.match(
    /RUN mkdir -p \/out\/dependencies[\s\S]*?(?=\n\nFROM)/,
  )[0].replace(/^RUN /, '').replaceAll('\\\n', ' ');
  const hashes = [];
  for (let iteration = 0; iteration < 2; iteration++) {
    const base = path.join(root, `partition-${iteration}`);
    const workspace = path.join(base, 'workspace');
    write(
      path.join(
        workspace,
        'node_modules/.pnpm/dep@1/node_modules/dep/index.js',
      ),
      'module.exports=42;',
    );
    write(
      path.join(workspace, 'packages/app/index.js'),
      `module.exports=require('dep')+${iteration};`,
    );
    write(
      path.join(workspace, 'node_modules/.modules.yaml'),
      `prunedAt: ${iteration}`,
    );
    write(
      path.join(workspace, 'node_modules/.pnpm-workspace-state-v1.json'),
      JSON.stringify({ lastValidatedTimestamp: iteration }),
    );
    write(path.join(workspace, 'node_modules/.cache/random'), 'discard');
    write(path.join(workspace, 'node_modules/.pnpm-store/random'), 'discard');
    fs.mkdirSync(path.join(workspace, 'packages/app/node_modules'), {
      recursive: true,
    });
    fs.symlinkSync(
      '.pnpm/dep@1/node_modules/dep',
      path.join(workspace, 'node_modules/dep'),
    );
    fs.symlinkSync(
      '../../../node_modules/.pnpm/dep@1/node_modules/dep',
      path.join(workspace, 'packages/app/node_modules/dep'),
    );
    fs.symlinkSync('../packages/app', path.join(workspace, 'node_modules/app'));
    write(path.join(base, 'out/sdk/lib/lib.so'), 'unchanged SDK');
    write(path.join(base, 'out/native/server'), `native ${iteration}`);
    const command = partition.replaceAll('/out', path.join(base, 'out'))
      .replaceAll('/workspace', workspace).replaceAll(
        '/tmp/runtime-node-modules',
        path.join(base, 'modules.list'),
      );
    run('/bin/bash', ['-o', 'pipefail', '-c', command], { cwd: workspace });
    const deps = path.join(base, 'out/dependencies');
    hashes.push([treeDigest(deps), treeDigest(path.join(base, 'out/sdk'))]);
    assert(!fs.existsSync(path.join(deps, 'node_modules/.modules.yaml')));
    assert(!fs.existsSync(path.join(deps, 'node_modules/.cache')));
    assert(!fs.existsSync(path.join(workspace, 'node_modules')));
    const merged = path.join(base, 'merged');
    fs.cpSync(deps, merged, { recursive: true, verbatimSymlinks: true });
    fs.cpSync(workspace, merged, { recursive: true, verbatimSymlinks: true });
    assert.equal(
      run(process.execPath, ['-e', 'console.log(require(\'app\'))'], {
        cwd: merged,
      }),
      String(42 + iteration),
    );
  }
  assert.deepEqual(hashes[0], hashes[1]);
  console.info(
    'PASS: pnpm/workspace links survive splitting; dependency and SDK trees remain identical across changed app outputs and install timestamps',
  );
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
