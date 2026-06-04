// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const entryPointTimeoutMs = 5 * 1000;
const retryDelayMs = 500;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

// No lock is needed: turbo's task graph builds each package before its
// `api-extractor` task (which depends on `build`) and before every consumer
// build, so api-extractor only ever reads a finished `dist/`. Do NOT build
// here — a rebuild would re-clean and rewrite `dist/` while turbo-scheduled
// consumer builds (e.g. `genui-cli#build`) read the same `dist/`, transiently
// removing the `.d.ts` and breaking their `tsc` (TS2307/TS7016).
// `ensureMainEntryPoint` stays only as a last-resort build if the entry point
// is somehow missing. Concurrent api-extractor runs across packages touch only
// their own per-package outputs, so they need no mutual exclusion.
await ensureMainEntryPoint();
run('api-extractor', ['run', '--verbose']);
