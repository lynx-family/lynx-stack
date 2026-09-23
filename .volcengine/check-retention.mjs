// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-retention-'));
const script = fileURLToPath(new URL('./publish-image.sh', import.meta.url));
const sha = i => (100 - i).toString(16).padStart(40, '0');
const digest = i => `sha256:${i.toString(16).padStart(64, '0')}`;
const now = Math.floor(Date.now() / 1000);
function add(state, tag, id, created) {
  state.tags[tag] = digest(id);
  state.created[digest(id)] = created;
}

try {
  const bin = path.join(root, 'bin');
  fs.mkdirSync(bin);
  fs.writeFileSync(
    path.join(bin, 'regctl'),
    String.raw`#!/usr/bin/env node
const fs = require('node:fs');
const assert = require('node:assert/strict');
const a = process.argv.slice(2);
const state = JSON.parse(fs.readFileSync(process.env.CHECK_STATE));
const command = a.slice(0, 2).join(' ');
fs.appendFileSync(process.env.CHECK_LOG, a.join(' ') + '\n');
if (command === process.env.CHECK_FAIL) process.exit(42);
const tag = ref => ref.slice(ref.lastIndexOf(':') + 1);
const resolve = ref => ref.includes('@') ? ref.split('@')[1] : state.tags[tag(ref)];
switch (command) {
  case 'registry login':
    assert.equal(fs.readFileSync(0, 'utf8'), 'fixture-password');
    fs.writeFileSync(process.env.CHECK_AUTH, process.env.REGCTL_CONFIG);
    fs.writeFileSync(process.env.REGCTL_CONFIG, '{}');
    break;
  case 'tag ls':
    console.log(Object.keys(state.tags).sort().join('\n'));
    break;
  case 'image digest':
    assert(resolve(a[2]), 'missing image');
    console.log(resolve(a[2]));
    break;
  case 'image inspect':
    assert(a.includes('{{.Created.Unix}}'));
    console.log(state.created[resolve(a[2])] ?? '<no value>');
    break;
  case 'manifest get':
    for (const child of state.children[resolve(a[2])] ?? []) {
      console.log('application/vnd.oci.image.manifest.v1+json ' + child);
    }
    break;
  case 'image copy':
    state.tags[tag(a[3])] = resolve(a[2]);
    break;
  case 'image delete':
    assert(a[2].includes('@sha256:'), 'deletion must use a digest');
    for (const name of Object.keys(state.tags)) {
      if (state.tags[name] === resolve(a[2])) delete state.tags[name];
    }
    break;
  case 'tag delete':
    delete state.tags[tag(a[2])];
    break;
  default: throw new Error('Unexpected regctl command');
}
fs.writeFileSync(process.env.CHECK_STATE, JSON.stringify(state));
`,
    { mode: 0o755 },
  );

  for (
    const mode of [
      'default',
      'success',
      'existing',
      'shared-digest',
      'protected-index',
      'inventory-error',
      'manifest-error',
      'metadata-error',
      'copy-error',
      'delete-error',
    ]
  ) {
    const state = { tags: {}, created: {}, children: {} };
    for (let i = 1; i <= 12; i++) add(state, sha(i), i, now - 10000 + i * 100);
    if (mode !== 'default') state.tags.production = digest(1);
    state.tags.cache = digest(99);
    add(state, 'build-abandoned', 100, now - 100000);
    add(state, 'build-running', 101, now - 2000);
    add(state, 'build-this-run', 102, now);
    if (mode === 'shared-digest') state.tags[sha(3)] = digest(1);
    if (mode === 'protected-index') {
      state.tags['release-index'] = digest(201);
      state.children[digest(201)] = [digest(202)];
      state.children[digest(202)] = [digest(3)];
    }
    if (mode === 'metadata-error') delete state.created[digest(5)];
    const current = mode === 'existing' ? sha(12) : sha(13);
    const expected = mode === 'existing' ? digest(12) : digest(102);
    const stateFile = path.join(root, `${mode}.json`);
    const logFile = path.join(root, `${mode}.log`);
    const authFile = path.join(root, `${mode}.auth`);
    fs.writeFileSync(stateFile, JSON.stringify(state));
    const failures = {
      'inventory-error': 'tag ls',
      'manifest-error': 'manifest get',
      'copy-error': 'image copy',
      'delete-error': 'image delete',
    };
    const result = spawnSync('/bin/sh', [
      script,
      'registry.example.test/team/app',
      'build-this-run',
      current,
    ], {
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        CR_USERNAME: 'fixture-user',
        CR_PASSWORD: 'fixture-password',
        CR_PROTECTED_COMMITS: mode === 'default' ? '' : sha(2),
        CHECK_STATE: stateFile,
        CHECK_LOG: logFile,
        CHECK_AUTH: authFile,
        CHECK_FAIL: failures[mode] ?? '',
      },
    });
    const success = [
      'default',
      'success',
      'existing',
      'shared-digest',
      'protected-index',
    ]
      .includes(mode);
    assert.equal(result.status === 0, success, `${mode}: ${result.stderr}`);
    assert(!`${result.stdout}${result.stderr}`.includes('fixture-password'));
    assert(!fs.existsSync(path.dirname(fs.readFileSync(authFile, 'utf8'))));
    const after = JSON.parse(fs.readFileSync(stateFile));
    const log = fs.readFileSync(logFile, 'utf8');
    if (success) {
      assert.equal(after.tags[current], expected);
      assert.equal(
        after.tags[sha(1)],
        mode === 'default' ? undefined : digest(1),
      );
      assert.equal(
        after.tags[sha(2)],
        mode === 'default' ? undefined : digest(2),
      );
      assert.equal(after.tags.cache, digest(99));
      assert.equal(
        after.tags.production,
        mode === 'default' ? undefined : digest(1),
      );
      assert.equal(after.tags['build-running'], digest(101));
      assert.equal(after.tags['build-abandoned'], undefined);
      assert.equal(after.tags['build-this-run'], undefined);
      for (let i = 4; i <= 12; i++) assert.equal(after.tags[sha(i)], digest(i));
      if (mode === 'success') assert.equal(after.tags[sha(3)], undefined);
      if (mode === 'default') {
        assert.equal(after.tags[sha(3)], undefined);
        assert.equal(
          Object.keys(after.tags).filter(tag => /^[0-9a-f]{40}$/.test(tag))
            .length,
          10,
        );
      }
      if (mode === 'shared-digest') assert.equal(after.tags[sha(3)], digest(1));
      if (mode === 'protected-index') {
        assert.equal(after.tags[sha(3)], digest(3));
      }
      if (mode === 'existing') assert(!log.includes('image copy'));
    } else if (mode !== 'delete-error') {
      assert(!log.includes('image delete'));
      assert(!log.includes('tag delete'));
      for (let i = 1; i <= 12; i++) assert.equal(after.tags[sha(i)], digest(i));
    }
    console.info(`Retention check passed: ${mode}`);
  }
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
