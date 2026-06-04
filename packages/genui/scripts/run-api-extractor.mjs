// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { link, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const genuiRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const lockPath = join(genuiRoot, '.api-extractor.lock');
const lockTimeoutMs = 10 * 60 * 1000;
const entryPointTimeoutMs = 5 * 1000;
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
  // Stage the fully-written lock in a per-process temp file, then publish it
  // with `link()`: linking is atomic and fails with `EEXIST` when the lock
  // already exists, so the lock file always has complete contents the moment
  // it appears. There is no empty/partial window for another process to
  // observe, which means an unparsable lock can only be a corrupt file.
  const tmpPath = `${lockPath}.${process.pid}`;
  await writeFile(
    tmpPath,
    JSON.stringify({
      cwd: process.cwd(),
      pid: process.pid,
      startedAt: new Date().toISOString(),
    }),
  );

  try {
    const start = Date.now();

    while (Date.now() - start < lockTimeoutMs) {
      try {
        await link(tmpPath, lockPath);
        return;
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          throw error;
        }

        // Someone else holds the lock. Reap it only when we can prove the
        // holder is gone: a dead pid, or a corrupt (unparsable) lock that no
        // healthy holder could have produced.
        let staleHolder = false;
        try {
          const current = JSON.parse(await readFile(lockPath, 'utf8'));
          if (typeof current.pid === 'number' && !isProcessAlive(current.pid)) {
            staleHolder = true;
          }
        } catch {
          staleHolder = true;
        }
        if (staleHolder) {
          await rm(lockPath, { force: true });
          continue;
        }
        await sleep(retryDelayMs);
      }
    }

    throw new Error(`Timed out waiting for ${lockPath}`);
  } finally {
    await rm(tmpPath, { force: true });
  }
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

const getMainEntryPointFilePath = async () => {
  const configPath = join(process.cwd(), 'api-extractor.json');
  const config = await readFile(configPath, 'utf8');
  const match = /"mainEntryPointFilePath"\s*:\s*"([^"]+)"/.exec(config);

  if (!match) {
    return null;
  }

  return match[1].replace('<projectFolder>', process.cwd());
};

const waitForMainEntryPoint = async () => {
  const mainEntryPointFilePath = await getMainEntryPointFilePath();

  if (!mainEntryPointFilePath) {
    return true;
  }

  const start = Date.now();

  while (Date.now() - start < entryPointTimeoutMs) {
    if (existsSync(mainEntryPointFilePath)) {
      return true;
    }

    await sleep(retryDelayMs);
  }

  return false;
};

const ensureMainEntryPoint = async () => {
  if (await waitForMainEntryPoint()) {
    return;
  }

  run('pnpm', ['run', 'build']);

  if (await waitForMainEntryPoint()) {
    return;
  }

  const mainEntryPointFilePath = await getMainEntryPointFilePath();

  throw new Error(
    `API Extractor entry point does not exist after build: ${mainEntryPointFilePath}`,
  );
};

await acquireLock();

try {
  // Do NOT build here. Turbo's task graph already builds this package (the
  // `api-extractor` task depends on `build`), and rebuilding in-script would
  // re-clean and rewrite `dist/` while turbo-scheduled consumer builds (e.g.
  // `genui-cli#build`) read the same `dist/`, transiently removing the
  // `.d.ts` and breaking their `tsc` with TS2307/TS7016. `ensureMainEntryPoint`
  // stays only as a last-resort build if the entry point is somehow missing.
  await ensureMainEntryPoint();
  run('api-extractor', ['run', '--verbose']);
} finally {
  if (existsSync(lockPath)) {
    await rm(lockPath, { force: true });
  }
}
