// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

import { afterAll, beforeAll, describe, expect, it } from '@rstest/core';

import { Lynx } from '../../../testing-library/kitten-lynx/src/index.js';
import type {
  KittenLynxView,
} from '../../../testing-library/kitten-lynx/src/index.js';
import { judgeAndroidAgent } from '../src/index.js';
import type { KittenLynxJudgePage } from '../src/index.js';
import {
  ANDROID_PLAYGROUND_DEMO_CASES,
} from './helpers/playground-demo-cases.js';
import type { PlaygroundDemoCase } from './helpers/playground-demo-cases.js';
import {
  startPlaygroundPreviewServer,
} from './helpers/playground-preview-server.js';
import type { PlaygroundPreviewServer } from './helpers/playground-preview-server.js';

const RUN_ANDROID_INTEGRATION =
  process.env['UI_JUDGE_ANDROID_INTEGRATION'] === '1';
const CONTENT_TIMEOUT_MS = 30_000;
const JUDGE_TIMEOUT_MS = 180_000;
const LOG_LIMIT = 12_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;

type LynxConnection = Awaited<ReturnType<typeof Lynx.connect>>;

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

  it('returns a JSON error when the task is empty', async () => {
    const result = await judgeAndroidAgent({
      page: createValidationPage('lynx://empty-task'),
      task: '',
      timeoutMs: 3_000,
    });

    expect(result).toMatchObject({
      dimension: 'visual-correctness',
      score: 0,
      steps: [],
      url: 'lynx://empty-task',
    });
    expect(result.error?.message).toContain(
      'judgeAndroidAgent requires a non-empty task.',
    );
  });
});

describe.skipIf(!RUN_ANDROID_INTEGRATION)(
  'judgeAndroidAgent Android integration',
  () => {
    let previewServer: PlaygroundPreviewServer | undefined;
    let reversedPort: number | undefined;
    let lynx: LynxConnection | undefined;
    let page: KittenLynxView | undefined;

    beforeAll(async () => {
      previewServer = await startPlaygroundPreviewServer();
      reversedPort = previewServer.port;
      await reverseAdbPort(reversedPort);

      const deviceId = getAndroidDeviceId();
      lynx = await Lynx.connect(deviceId ? { deviceId } : undefined);
      page = await lynx.newPage();
    }, 180_000);

    afterAll(async () => {
      await lynx?.close();
      if (reversedPort !== undefined) {
        await removeReversedAdbPort(reversedPort).catch(() => {
          // The emulator can already be gone during teardown.
        });
      }
      await previewServer?.dispose();
    }, 30_000);

    it.each(ANDROID_PLAYGROUND_DEMO_CASES)(
      'renders and judges playground example $demoId',
      async (demo) => {
        if (!previewServer || !page) {
          throw new Error('A2UI Android playground test was not initialized.');
        }

        const demoUrl = previewServer.createAndroidDemoUrl({
          demoId: demo.demoId,
          theme: 'light',
        });

        await page.goto(demoUrl, { timeout: NAVIGATION_TIMEOUT_MS });
        await expectDemoPayloadText(previewServer, demo);
        const content = await waitForAndroidPreviewContent(page, demo);
        expect(content).toContain(demo.readyText);
        expect(content).toContain(demo.expectedText);
        const screenshot = await waitForAndroidPreviewScreenshot(page, demo);
        expect(screenshot.length).toBeGreaterThan(100);

        const result = await judgeAndroidAgent({
          page,
          task: demo.task,
          timeoutMs: JUDGE_TIMEOUT_MS,
        });

        expect(result).toMatchObject({
          dimension: 'visual-correctness',
          steps: [],
          url: demoUrl,
        });
        expect(result.error).toBeUndefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(5);
      },
      240_000,
    );
  },
);

function createValidationPage(url: string): KittenLynxJudgePage {
  return {
    screenshot: () => Promise.resolve(Buffer.from([])),
    url: () => url,
  };
}

async function waitForAndroidPreviewContent(
  page: KittenLynxView,
  demo: PlaygroundDemoCase,
): Promise<string> {
  const deadline = Date.now() + CONTENT_TIMEOUT_MS;
  let latestContent = '';
  let latestError: unknown;

  while (Date.now() < deadline) {
    try {
      const content = await page.content();
      if (
        content.includes(demo.readyText)
        && content.includes(demo.expectedText)
      ) {
        return content;
      }
      latestContent = content.slice(0, 500);
    } catch (error) {
      latestError = error;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const details = latestError instanceof Error
    ? ` Last error: ${latestError.message}`
    : (latestContent
      ? ` Latest content: ${latestContent}`
      : '');
  throw new Error(
    `Timed out waiting for Android playground demo "${demo.demoId}" content to include "${demo.readyText}" and "${demo.expectedText}".${details}`,
  );
}

async function waitForAndroidPreviewScreenshot(
  page: KittenLynxView,
  demo: PlaygroundDemoCase,
): Promise<Buffer> {
  const deadline = Date.now() + CONTENT_TIMEOUT_MS;
  let latestError: unknown;

  while (Date.now() < deadline) {
    try {
      const screenshot = await page.screenshot();
      if (screenshot.length > 100) {
        return screenshot;
      }
    } catch (error) {
      latestError = error;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const details = latestError instanceof Error ? ` ${latestError.message}` : '';
  throw new Error(
    `Timed out waiting for Android playground demo "${demo.demoId}" screenshot.${details}`,
  );
}

async function expectDemoPayloadText(
  previewServer: PlaygroundPreviewServer,
  demo: PlaygroundDemoCase,
): Promise<void> {
  const response = await fetch(
    new URL(`/demos/${demo.demoId}.json`, previewServer.baseUrl),
    { cache: 'no-store' },
  );
  expect(response.ok).toBe(true);

  const payload = JSON.stringify(await response.json());
  expect(payload).toContain(demo.readyText);
  expect(payload).toContain(demo.expectedText);
}

async function reverseAdbPort(port: number): Promise<void> {
  const configuredDeviceId = getAndroidDeviceId();
  const deviceIds = configuredDeviceId
    ? [configuredDeviceId]
    : await listAdbDevices();

  for (const deviceId of deviceIds) {
    await runCommand('adb', [
      '-s',
      deviceId,
      'reverse',
      `tcp:${port}`,
      `tcp:${port}`,
    ]);
  }
}

async function removeReversedAdbPort(port: number): Promise<void> {
  const configuredDeviceId = getAndroidDeviceId();
  const deviceIds = configuredDeviceId
    ? [configuredDeviceId]
    : await listAdbDevices();

  for (const deviceId of deviceIds) {
    await runCommand('adb', [
      '-s',
      deviceId,
      'reverse',
      '--remove',
      `tcp:${port}`,
    ]);
  }
}

async function listAdbDevices(): Promise<string[]> {
  const { stdout } = await runCommand('adb', ['devices']);
  const devices = stdout.split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter((entry): entry is [string, string, ...string[]] =>
      Boolean(entry[0]) && entry[1] === 'device'
    )
    .map(([serial]) => serial);

  if (devices.length === 0) {
    throw new Error('No authorized Android device found through adb.');
  }

  return devices;
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

function getAndroidDeviceId(): string | undefined {
  return process.env['KITTEN_LYNX_DEVICE_ID']
    ?? process.env['ANDROID_SERIAL']
    ?? undefined;
}

function formatLogs(stdout: BoundedLog, stderr: BoundedLog): string {
  return `stdout:\n${stdout.toString()}\n\nstderr:\n${stderr.toString()}`;
}
