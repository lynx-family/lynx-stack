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
const entryPointTimeoutMs = 5 * 1000;
const retryDelayMs = 500;
// The genui root's `index.ts` imports from `@lynx-js/genui/<subpackage>`, so
// tsc needs each subpackage's emitted `.d.ts` on disk before it runs. Turbo
// schedules `<subpackage>#build:api` first, but cache restoration on the CI
// runner has been observed to land the `.js` before the `.d.ts`. Wait so the
// follow-up `tsc` does not flake with TS7016.
const subpackageDtsTimeoutMs = 30 * 1000;

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

const collectSubpackageDtsTargets = async () => {
  const rootPkgPath = join(genuiRoot, 'package.json');
  const rootPkg = JSON.parse(await readFile(rootPkgPath, 'utf8'));
  const targets = new Set();
  for (const [key, value] of Object.entries(rootPkg.exports ?? {})) {
    if (key === '.' || key === './package.json') continue;
    const types = typeof value === 'string' ? null : value?.types;
    if (typeof types !== 'string' || !types.endsWith('.d.ts')) continue;
    // Only subpackage paths (`./<sub>/dist/...`) need waiting; in-tree assets
    // (e.g. `./a2ui/styles/theme.css`) are filtered out by the `.d.ts` check.
    targets.add(join(genuiRoot, types));
  }
  return [...targets];
};

const waitForSubpackageDts = async () => {
  if (process.cwd() !== genuiRoot) return;
  const targets = await collectSubpackageDtsTargets();
  const start = Date.now();
  for (const abs of targets) {
    while (!existsSync(abs)) {
      if (Date.now() - start > subpackageDtsTimeoutMs) {
        throw new Error(`Timed out waiting for ${abs}`);
      }
      await sleep(retryDelayMs);
    }
  }
};

await acquireLock();

try {
  await waitForSubpackageDts();
  run('pnpm', ['run', 'build']);
  await ensureMainEntryPoint();
  run('api-extractor', ['run', '--verbose']);
} finally {
  if (existsSync(lockPath)) {
    await rm(lockPath, { force: true });
  }
}
