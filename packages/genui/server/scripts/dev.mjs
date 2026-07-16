// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

import { createRslib, loadConfig } from '@rslib/core';

let buildResult;
let closing = false;
let restartQueue = Promise.resolve();
let serverProcess;

async function stopServer() {
  const child = serverProcess;
  serverProcess = undefined;
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  const exited = once(child, 'exit');
  child.kill('SIGTERM');
  const stopped = await Promise.race([
    exited.then(() => true),
    delay(2_000).then(() => false),
  ]);
  if (!stopped) {
    child.kill('SIGKILL');
    await exited;
  }
}

function restartServer() {
  restartQueue = restartQueue.then(async () => {
    await stopServer();
    if (closing) return;

    const child = spawn(process.execPath, ['dist/index.js'], {
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'inherit',
    });
    serverProcess = child;
    child.once('exit', (code, signal) => {
      if (serverProcess === child) serverProcess = undefined;
      if (!closing && code !== 0) {
        console.error(
          `[a2ui-server] development server exited (${code ?? signal})`,
        );
      }
    });
  });
  return restartQueue;
}

async function shutdown() {
  if (closing) return;
  closing = true;
  await buildResult?.close();
  await stopServer();
}

async function main() {
  const cwd = process.cwd();
  const loaded = await loadConfig({ cwd });
  if (!loaded.filePath) {
    throw new Error('rslib.config.ts was not found');
  }
  const config = typeof loaded.content === 'function'
    ? await loaded.content({ command: 'build', env: 'development' })
    : loaded.content;
  const rslib = await createRslib({ cwd, config });
  rslib.onAfterCreateRsbuild(({ rsbuild }) => {
    rsbuild.onAfterBuild(({ stats }) => {
      if (stats?.hasErrors()) return;
      return restartServer();
    });
    rsbuild.onCloseBuild(stopServer);
  });

  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());
  buildResult = await rslib.build({ watch: true });
}

void main().catch(async (error) => {
  console.error('[a2ui-server] development build failed', error);
  process.exitCode = 1;
  await shutdown();
});
