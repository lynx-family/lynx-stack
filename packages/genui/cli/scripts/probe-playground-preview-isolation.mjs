#!/usr/bin/env node
// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import { createServer } from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';

import { startPlaygroundHttp } from '../dist/playground/server.js';
import { PlaygroundStore } from '../dist/playground/store.js';

if (process.env.GENUI_RUN_PREVIEW_ISOLATION_PROBE !== '1') {
  throw new Error(
    'Set GENUI_RUN_PREVIEW_ISOLATION_PROBE=1 to validate the localhost Preview topology.',
  );
}

const root = fs.mkdtempSync(
  path.join(fs.realpathSync(os.tmpdir()), 'genui-preview-isolation-'),
);
const assetsRoot = path.join(root, 'assets');
fs.mkdirSync(assetsRoot);
fs.writeFileSync(path.join(assetsRoot, 'index.html'), '<!doctype html>');
fs.writeFileSync(path.join(assetsRoot, 'preview.html'), '<!doctype html>');
let server;
try {
  const port = await availablePort();
  server = await startPlaygroundHttp({
    port,
    assetsRoot,
    store: new PlaygroundStore(path.join(root, 'data')),
    engine: { descriptors: () => [] },
    requireIsolatedPreview: true,
  });
  assert.equal(server.controlOrigin.replace(/:\d+$/u, ''), 'http://127.0.0.1');
  assert.equal(server.previewOrigin.replace(/:\d+$/u, ''), 'http://localhost');
  assert.notEqual(
    new URL(server.controlOrigin).port,
    new URL(server.previewOrigin).port,
  );
  assert.deepEqual(server.previewIsolation, {
    status: 'isolated',
    isolationCompliant: true,
    controlHost: '127.0.0.1',
    previewHost: 'localhost',
    controlBoundHost: '127.0.0.1',
    previewBoundHost: '127.0.0.1',
    controlOrigin: server.controlOrigin,
    previewOrigin: server.previewOrigin,
    distinctPort: true,
  });
  console.info(JSON.stringify(server.previewIsolation, null, 2));
} finally {
  await server?.close();
  fs.rmSync(root, { recursive: true, force: true });
}

async function availablePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve) => probe.close(resolve));
  return address.port;
}
