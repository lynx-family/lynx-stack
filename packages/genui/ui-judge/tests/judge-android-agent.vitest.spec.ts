// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { Lynx } from '../../../testing-library/kitten-lynx/src/index.js';
import type { KittenLynxView } from '../../../testing-library/kitten-lynx/src/index.js';
import { judgeAndroidAgent } from '../src/index.js';

const TEST_FIXTURE_PORT = 3001;
const TEST_FIXTURE_URL =
  `http://127.0.0.1:${TEST_FIXTURE_PORT}/react-example.lynx.bundle`;
const RUN_ANDROID_INTEGRATION =
  process.env['UI_JUDGE_ANDROID_INTEGRATION'] === '1';
const HELPER_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(HELPER_DIR, '../../../..');
const KITTEN_LYNX_CWD = resolve(
  WORKSPACE_ROOT,
  'packages/testing-library/kitten-lynx',
);
const READY_TIMEOUT_MS = 120_000;
const FETCH_TIMEOUT_MS = 2_500;
const POLL_INTERVAL_MS = 250;
const DISPOSE_TIMEOUT_MS = 5_000;
const LOG_LIMIT = 12_000;

type LynxConnection = Awaited<ReturnType<typeof Lynx.connect>>;

interface FixtureServer {
  dispose(): Promise<void>;
  getLogs(): string;
}

class BoundedLog {
  #value = '';

  append(chunk: unknown): void {
    this.#value += Buffer.isBuffer(chunk)
      ? chunk.toString('utf8')
      : String(chunk);
    if (this.#value.length > LOG_LIMIT) {
      this.#value = this.#value.slice(-LOG_LIMIT);
    }
  }

  toString(): string {
    return this.#value;
  }
}

describe('judgeAndroidAgent validation', () => {
  it('returns a JSON error when a Kitten-Lynx page is missing', async () => {
    const result = await judgeAndroidAgent({
      dimension: 'consistency-standards',
      page: undefined as never,
      task: 'The Lynx app should show a checkout confirmation screen.',
      timeoutMs: 3_000,
    });

    expect(result).toMatchObject({
      dimension: 'consistency-standards',
      score: 0,
      steps: [],
      url: '',
    });
    expect(result.error?.message).toContain('Kitten-Lynx page');
  });
});

describe.skipIf(!RUN_ANDROID_INTEGRATION)(
  'judgeAndroidAgent Android integration',
  () => {
    let fixtureServer: FixtureServer | undefined;
    let lynx: LynxConnection | undefined;
    let page: KittenLynxView | undefined;

    beforeAll(async () => {
      fixtureServer = await startKittenLynxFixtureServer();
      await reverseFixturePort();

      const deviceId = getAndroidDeviceId();
      lynx = await Lynx.connect(deviceId ? { deviceId } : undefined);
      page = await lynx.newPage();
      await page.goto(TEST_FIXTURE_URL, { timeout: 15_000 });
    }, 90_000);

    afterAll(async () => {
      await lynx?.close();
      await fixtureServer?.dispose();
    }, 30_000);

    it('accepts a Kitten-Lynx newPage result as the page option', async () => {
      if (!page) {
        throw new Error('Kitten-Lynx page was not created.');
      }

      const result = await judgeAndroidAgent({
        page,
        task: '',
        timeoutMs: 3_000,
      });

      expect(result).toMatchObject({
        dimension: 'visual-correctness',
        score: 0,
        steps: [],
        url: TEST_FIXTURE_URL,
      });
      expect(result.error?.message).toContain(
        'judgeAndroidAgent requires a non-empty task.',
      );
    });
  },
);

async function startKittenLynxFixtureServer(): Promise<FixtureServer> {
  const stdout = new BoundedLog();
  const stderr = new BoundedLog();
  let spawnError: Error | null = null;
  let exitState: { code: number | null; signal: NodeJS.Signals | null } | null =
    null;

  const detached = process.platform !== 'win32';
  const pnpmCommand = getPnpmCommand();
  const child = spawn(pnpmCommand.command, [...pnpmCommand.args, 'serve'], {
    cwd: KITTEN_LYNX_CWD,
    detached,
    env: {
      ...process.env,
      NODE_ENV: 'development',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => stdout.append(chunk));
  child.stderr.on('data', (chunk) => stderr.append(chunk));
  child.once('error', (error) => {
    spawnError = error;
  });

  const exitPromise = new Promise<void>((resolveExit) => {
    child.once('exit', (code, signal) => {
      exitState = { code, signal };
      resolveExit();
    });
  });

  const getProcessError = () => {
    if (spawnError) {
      return new Error(
        `Failed to start the Kitten-Lynx fixture server: ${spawnError.message}\n\n${
          formatLogs(stdout, stderr)
        }`,
      );
    }
    if (exitState) {
      return new Error(
        `Kitten-Lynx fixture server exited before it became ready. code=${
          String(exitState.code)
        } signal=${String(exitState.signal)}\n\n${formatLogs(stdout, stderr)}`,
      );
    }
    return null;
  };

  try {
    await waitForFixtureReady(getProcessError);
  } catch (error) {
    if (!exitState) {
      await disposeChildProcess(child, detached, exitPromise);
    }
    throw error;
  }

  return {
    async dispose() {
      if (!exitState) {
        await disposeChildProcess(child, detached, exitPromise);
      }
    },
    getLogs() {
      return formatLogs(stdout, stderr);
    },
  };
}

function getPnpmCommand(): { args: string[]; command: string } {
  const npmExecPath = process.env['npm_execpath'];
  if (npmExecPath) {
    return {
      args: [npmExecPath],
      command: process.execPath,
    };
  }

  return {
    args: [],
    command: 'pnpm',
  };
}

async function waitForFixtureReady(
  getProcessError: () => Error | null,
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const processError = getProcessError();
    if (processError) throw processError;

    if (await fetchOk(TEST_FIXTURE_URL)) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const processError = getProcessError();
  if (processError) throw processError;
  throw new Error(
    `Timed out waiting for the Kitten-Lynx fixture server at ${TEST_FIXTURE_URL}.`,
  );
}

async function reverseFixturePort(): Promise<void> {
  const configuredDeviceId = getAndroidDeviceId();
  const deviceIds = configuredDeviceId
    ? [configuredDeviceId]
    : await listAdbDevices();

  for (const deviceId of deviceIds) {
    await runCommand('adb', [
      '-s',
      deviceId,
      'reverse',
      `tcp:${TEST_FIXTURE_PORT}`,
      `tcp:${TEST_FIXTURE_PORT}`,
    ]);
  }
}

async function listAdbDevices(): Promise<string[]> {
  const { stdout } = await runCommand('adb', ['devices']);
  const devices = stdout.split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(([serial, state]) => serial && state === 'device')
    .map(([serial]) => serial);

  if (devices.length === 0) {
    throw new Error('No authorized Android device found through adb.');
  }

  return devices;
}

async function fetchOk(url: string): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function runCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string }> {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = new BoundedLog();
  const stderr = new BoundedLog();

  child.stdout.on('data', (chunk) => stdout.append(chunk));
  child.stderr.on('data', (chunk) => stderr.append(chunk));

  const exitState = await new Promise<
    { code: number | null; signal: NodeJS.Signals | null }
  >((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  if (exitState.code === 0) {
    return { stdout: stdout.toString() };
  }

  throw new Error(
    `Command failed: ${command} ${args.join(' ')}. code=${
      String(exitState.code)
    } signal=${String(exitState.signal)}\n\n${formatLogs(stdout, stderr)}`,
  );
}

async function disposeChildProcess(
  child: ChildProcess,
  detached: boolean,
  exitPromise: Promise<void>,
): Promise<void> {
  if (!child.pid) return;

  if (detached) {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      return;
    }
  } else {
    child.kill('SIGTERM');
  }

  await Promise.race([
    exitPromise,
    sleep(DISPOSE_TIMEOUT_MS).then(() => {
      if (detached) {
        process.kill(-child.pid!, 'SIGKILL');
      } else {
        child.kill('SIGKILL');
      }
    }),
  ]);
}

function getAndroidDeviceId(): string | undefined {
  return process.env['KITTEN_LYNX_DEVICE_ID']
    ?? process.env['ANDROID_SERIAL']
    ?? undefined;
}

function formatLogs(stdout: BoundedLog, stderr: BoundedLog): string {
  return `stdout:\n${stdout.toString()}\n\nstderr:\n${stderr.toString()}`;
}
