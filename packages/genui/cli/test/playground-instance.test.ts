// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { claimInstance } from '../src/playground/instance.js';

describe('playground single instance', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(
      path.join(fs.realpathSync(os.tmpdir()), 'genui-instance-'),
    );
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  test('creates private metadata/socket and lets a second CLI request a fresh URL', async () => {
    let sequence = 0;
    const first = await claimInstance(
      root,
      58_321,
      () => `http://127.0.0.1:58321/#bootstrap=token-${++sequence}`,
    );
    expect(first.owner).toBeDefined();
    expect(fs.statSync(first.owner!.lockPath).mode & 0o777).toBe(0o600);
    expect(fs.statSync(first.owner!.socketPath).mode & 0o777).toBe(0o600);
    const lock = fs.readFileSync(first.owner!.lockPath, 'utf8');
    expect(lock).not.toContain('bootstrap');

    const second = await claimInstance(root, 58_321, () => 'unexpected');
    expect(second.owner).toBeUndefined();
    expect(second.existingUrl).toBe(
      'http://127.0.0.1:58321/#bootstrap=token-1',
    );
    await first.owner!.close();
  });

  test('recovers stale lock and socket files', async () => {
    fs.writeFileSync(
      path.join(root, 'daemon.lock'),
      JSON.stringify({ pid: 999_999, port: 58_321 }),
    );
    fs.writeFileSync(path.join(root, 'control.sock'), 'stale');
    const claim = await claimInstance(
      root,
      58_321,
      () => 'http://127.0.0.1:58321/#bootstrap=fresh',
    );
    expect(claim.owner).toBeDefined();
    await claim.owner!.close();
  });
});
