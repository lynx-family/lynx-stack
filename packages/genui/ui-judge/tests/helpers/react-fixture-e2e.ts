// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { inspect } from 'node:util';

import sharp from 'sharp';

import type {
  KittenLynxView,
} from '../../../../testing-library/kitten-lynx/src/index.js';

const HELPER_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HELPER_DIR, '../../../../..');
const UI_JUDGE_TEMP_DIR = resolve(REPO_ROOT, 'packages/genui/ui-judge/temp');
const KITTEN_LYNX_DIR = resolve(
  REPO_ROOT,
  'packages/testing-library/kitten-lynx',
);

export const REACT_FIXTURE_DIR = resolve(HELPER_DIR, '../fixtures/react');
export const REACT_BUNDLE_NAME = 'main.lynx.bundle';
const REACT_WEB_BUNDLE_NAME = 'main.web.bundle';
const REACT_BUNDLE_NAMES = [
  REACT_BUNDLE_NAME,
  REACT_WEB_BUNDLE_NAME,
] as const;
export const REACT_REFERENCE_SNAPSHOT_PATH = resolve(
  REACT_FIXTURE_DIR,
  'main.lynx.snapshot.png',
);

const CONTENT_TIMEOUT_MS = 30_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const REACT_FIXTURE_BUILD_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;
const LOG_LIMIT = 12_000;

export interface FixtureServer {
  readonly baseUrl: string;
  readonly port: number;
  createUrl(pathname: string): string;
  dispose(): Promise<void>;
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

export async function captureReactFixtureScreenshot(
  page: KittenLynxView,
  templateUrl: string,
): Promise<Buffer> {
  await page.goto(templateUrl, { timeout: NAVIGATION_TIMEOUT_MS });
  const content = await waitForReactFixtureContent(page);
  if (!content.includes('React') || !content.includes('have fun')) {
    throw new Error('React fixture rendered unexpected content.');
  }

  const screenshot = await waitForReactFixtureScreenshot(page);
  return await sharp(screenshot, { failOn: 'none' }).png().toBuffer();
}

export async function startReactFixtureServer(): Promise<FixtureServer> {
  const fixtureBuild = await prepareReactFixtureBundles();
  const server = createServer((request, response) => {
    void handleFixtureRequest(request, response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    baseUrl,
    port: address.port,
    createUrl(pathname) {
      return new URL(pathname, `${baseUrl}/`).toString();
    },
    async dispose() {
      try {
        server.closeAllConnections();
        await new Promise<void>((resolveClose, rejectClose) => {
          server.close((error) => {
            if (error) {
              rejectClose(error);
              return;
            }
            resolveClose();
          });
        });
      } finally {
        await fixtureBuild.dispose();
      }
    },
  };
}

export async function reverseAdbPort(port: number): Promise<void> {
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

export async function removeReversedAdbPort(port: number): Promise<void> {
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

export function getAndroidDeviceId(): string | undefined {
  return [
    process.env['KITTEN_LYNX_DEVICE_ID'],
    process.env['ANDROID_SERIAL'],
  ].map((value) => value?.trim()).find((value): value is string =>
    Boolean(value)
  );
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

interface ReactFixtureBuild {
  dispose(): Promise<void>;
}

async function prepareReactFixtureBundles(): Promise<ReactFixtureBuild> {
  await mkdir(REACT_FIXTURE_DIR, { recursive: true });
  await mkdir(UI_JUDGE_TEMP_DIR, { recursive: true });
  await cleanupReactFixtureBundles();

  const buildRoot = await mkdtemp(join(UI_JUDGE_TEMP_DIR, 'react-fixture-'));
  const outputDir = resolve(buildRoot, 'dist');
  const configPath = resolve(buildRoot, 'lynx.config.mjs');

  try {
    await writeFile(configPath, createReactFixtureConfig(outputDir));
    await runCommand(
      'pnpm',
      [
        '--filter',
        '@lynx-js/kitten-lynx-test-infra',
        'exec',
        'rspeedy',
        'build',
        '--config',
        configPath,
        '--root',
        KITTEN_LYNX_DIR,
      ],
      { cwd: REPO_ROOT, timeoutMs: REACT_FIXTURE_BUILD_TIMEOUT_MS },
    );

    for (const bundleName of REACT_BUNDLE_NAMES) {
      await copyFile(
        resolve(outputDir, bundleName),
        resolve(REACT_FIXTURE_DIR, bundleName),
      );
    }

    return {
      async dispose() {
        await cleanupReactFixtureBundles();
        await rm(buildRoot, { force: true, recursive: true });
      },
    };
  } catch (error) {
    await cleanupReactFixtureBundles().catch(() => {
      // Preserve the original build error; cleanup is best-effort here.
    });
    await rm(buildRoot, { force: true, recursive: true }).catch(() => {
      // Preserve the original build error; cleanup is best-effort here.
    });
    throw new Error(
      `Failed to build React fixture bundles: ${formatError(error)}`,
    );
  }
}

async function cleanupReactFixtureBundles(): Promise<void> {
  await Promise.all(
    REACT_BUNDLE_NAMES.map((bundleName) =>
      rm(resolve(REACT_FIXTURE_DIR, bundleName), { force: true })
    ),
  );
}

function createReactFixtureConfig(outputDir: string): string {
  return `import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { defineConfig } from '@lynx-js/rspeedy';

export default defineConfig({
  source: {
    entry: {
      main: './test-fixture/cases/react-example/index.tsx',
    },
  },
  output: {
    cleanDistPath: true,
    dataUriLimit: 512000,
    distPath: {
      root: ${JSON.stringify(outputDir)},
    },
    filename: {
      bundle: '[name].[platform].bundle',
    },
    sourceMap: false,
  },
  plugins: [
    pluginReactLynx(),
  ],
  environments: {
    lynx: {},
    web: {},
  },
});
`;
}

async function waitForReactFixtureContent(
  page: KittenLynxView,
): Promise<string> {
  const deadline = Date.now() + CONTENT_TIMEOUT_MS;
  let latestContent = '';
  let latestError: unknown;

  while (Date.now() < deadline) {
    try {
      const content = await page.content();
      if (content.includes('React') && content.includes('have fun')) {
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
    `Timed out waiting for React fixture content.${details}`,
  );
}

async function handleFixtureRequest(
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requestedFile = pathname === '/'
      ? REACT_BUNDLE_NAME
      : pathname.replace(/^\/+/, '');
    const filePath = resolve(REACT_FIXTURE_DIR, requestedFile);
    const relativePath = relative(REACT_FIXTURE_DIR, filePath);
    if (
      relativePath.startsWith('..')
      || relativePath === ''
      || relativePath.split(sep).includes('..')
    ) {
      response.writeHead(403).end();
      return;
    }

    const body = await readFile(filePath);
    response.writeHead(200, {
      'Content-Length': String(body.length),
      'Content-Type': getFixtureContentType(filePath),
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}

async function waitForReactFixtureScreenshot(
  page: KittenLynxView,
): Promise<Buffer> {
  const deadline = Date.now() + CONTENT_TIMEOUT_MS;
  let latestError: unknown;

  while (Date.now() < deadline) {
    try {
      const screenshot = await page.screenshot();
      if (screenshot.length > 100 && await hasVisiblePixels(screenshot)) {
        return screenshot;
      }
      latestError = new Error('Latest screenshot did not contain visible UI.');
    } catch (error) {
      latestError = error;
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const details = latestError instanceof Error ? ` ${latestError.message}` : '';
  throw new Error(`Timed out waiting for React fixture screenshot.${details}`);
}

async function hasVisiblePixels(screenshot: Buffer): Promise<boolean> {
  const stats = await sharp(screenshot, { failOn: 'none' }).stats();
  return stats.channels.slice(0, 3).some((channel) =>
    channel.max - channel.min > 8 || channel.stdev > 2
  );
}

function getFixtureContentType(filePath: string): string {
  if (filePath.endsWith('.js') || filePath.endsWith('.bundle')) {
    return 'application/javascript; charset=utf-8';
  }
  if (filePath.endsWith('.png')) {
    return 'image/png';
  }
  return 'application/octet-stream';
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
  options: { cwd?: string; timeoutMs?: number } = {},
): Promise<{ stdout: string }> {
  const child = spawn(command, args, {
    cwd: options.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = new BoundedLog();
  const stderr = new BoundedLog();
  let didTimeout = false;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let forceKillTimeout: ReturnType<typeof setTimeout> | undefined;

  child.stdout.on('data', (chunk) => stdout.append(chunk));
  child.stderr.on('data', (chunk) => stderr.append(chunk));

  if (options.timeoutMs !== undefined) {
    timeout = setTimeout(() => {
      didTimeout = true;
      child.kill('SIGTERM');
      forceKillTimeout = setTimeout(() => child.kill('SIGKILL'), 5000);
    }, options.timeoutMs);
  }

  const exitState = await new Promise<
    { code: number | null; error?: Error; signal: NodeJS.Signals | null }
  >((resolveExit) => {
    child.once(
      'error',
      (error) => resolveExit({ code: null, error, signal: null }),
    );
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });
  if (timeout) {
    clearTimeout(timeout);
  }
  if (forceKillTimeout) {
    clearTimeout(forceKillTimeout);
  }

  if (exitState.error) {
    throw new Error(
      `Command failed to start: ${command} ${
        args.join(' ')
      }. ${exitState.error.message}`,
    );
  }

  if (didTimeout) {
    throw new Error(
      `Command timed out after ${String(options.timeoutMs)}ms: ${command} ${
        args.join(' ')
      }.\n\n${formatLogs(stdout, stderr)}`,
    );
  }

  if (exitState.code === 0) {
    return { stdout: stdout.toString() };
  }

  throw new Error(
    `Command failed: ${command} ${args.join(' ')}. code=${
      String(exitState.code)
    } signal=${String(exitState.signal)}\n\n${formatLogs(stdout, stderr)}`,
  );
}

function formatLogs(stdout: BoundedLog, stderr: BoundedLog): string {
  return `stdout:\n${stdout.toString()}\n\nstderr:\n${stderr.toString()}`;
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : inspect(error);
}
