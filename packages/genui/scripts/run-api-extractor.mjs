// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { open, readFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const genuiRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = join(genuiRoot, '.api-extractor.lock');
const lockTimeoutMs = 10 * 60 * 1000;
const retryDelayMs = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const isProcessAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

const acquireLock = async () => {
  const start = Date.now();

  while (Date.now() - start < lockTimeoutMs) {
    try {
      const file = await open(lockPath, 'wx');
      await file.writeFile(JSON.stringify({
        cwd: process.cwd(),
        pid: process.pid,
        startedAt: new Date().toISOString(),
      }));
      await file.close();
      return;
    } catch (error) {
      if (error?.code !== 'EEXIST') {
        throw error;
      }

      try {
        const current = JSON.parse(await readFile(lockPath, 'utf8'));
        if (typeof current.pid === 'number' && !isProcessAlive(current.pid)) {
          await rm(lockPath, { force: true });
          continue;
        }
      } catch {
        await rm(lockPath, { force: true });
        continue;
      }

      await sleep(retryDelayMs);
    }
  }

  throw new Error(`Timed out waiting for ${lockPath}`);
};

const run = (command, args) => {
  const result = spawnSync(command, args, {
    shell: process.platform === 'win32',
    stdio: 'inherit',
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(' ')} failed with status ${result.status}`,
    );
  }
};

await acquireLock();

try {
  run('pnpm', ['run', 'build']);
  run('api-extractor', ['run', '--verbose']);
} finally {
  if (existsSync(lockPath)) {
    await rm(lockPath, { force: true });
  }
}
