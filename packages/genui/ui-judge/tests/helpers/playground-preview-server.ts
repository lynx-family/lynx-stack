// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PlaygroundDemoPreviewOptions {
  demoId: string;
  demoUrl?: string;
  protocol?: 'a2ui' | 'openui';
  speed?: number;
  theme?: 'light' | 'dark';
}

interface PlaygroundAndroidDemoOptions {
  demoId: string;
  theme?: 'light' | 'dark';
}

export interface PlaygroundPreviewServer {
  readonly baseUrl: string;
  readonly port: number;
  createAndroidDemoUrl(options: PlaygroundAndroidDemoOptions): string;
  createDemoPreviewUrl(options: PlaygroundDemoPreviewOptions): string;
  dispose(): Promise<void>;
  getLogs(): string;
}

const HELPER_DIR = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_ROOT = resolve(HELPER_DIR, '../../../../..');
const PLAYGROUND_CWD = resolve(
  WORKSPACE_ROOT,
  'packages/genui/playground',
);
const REQUIRED_CATALOG_ARTIFACTS = [
  'packages/genui/a2ui/dist/catalog/Button/catalog.json',
  'packages/genui/a2ui/dist/catalog/Text/catalog.json',
];

const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 250;
const FETCH_TIMEOUT_MS = 2_500;
const DISPOSE_TIMEOUT_MS = 5_000;
const LOG_LIMIT = 12_000;

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

export async function startPlaygroundPreviewServer(): Promise<
  PlaygroundPreviewServer
> {
  assertPlaygroundPrerequisites();

  const port = await findFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stdout = new BoundedLog();
  const stderr = new BoundedLog();
  let spawnError: Error | null = null;
  let exitState: { code: number | null; signal: NodeJS.Signals | null } | null =
    null;

  const detached = process.platform !== 'win32';
  const child = spawn('pnpm', ['dev'], {
    cwd: PLAYGROUND_CWD,
    detached,
    env: {
      ...process.env,
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (chunk) => stdout.append(chunk));
  child.stderr?.on('data', (chunk) => stderr.append(chunk));
  child.once('error', (error) => {
    spawnError = error;
  });

  const exitPromise = new Promise<void>((resolveExit) => {
    child.once('exit', (code, signal) => {
      exitState = { code, signal };
      resolveExit();
    });
  });

  const processStateError = () => {
    if (spawnError) {
      return new Error(
        `Failed to start the A2UI playground dev server: ${spawnError.message}\n\n${
          formatLogs(stdout, stderr)
        }`,
      );
    }
    if (exitState) {
      return new Error(
        `A2UI playground dev server exited before it became ready. code=${
          String(exitState.code)
        } signal=${String(exitState.signal)}\n\n${formatLogs(stdout, stderr)}`,
      );
    }
    return null;
  };

  try {
    await waitForPlaygroundReady(baseUrl, processStateError);
  } catch (error) {
    if (!exitState) {
      await disposeChildProcess(child.pid, detached, exitPromise);
    }
    throw error;
  }

  return {
    baseUrl,
    port,
    createAndroidDemoUrl(options) {
      const bundleUrl = new URL('/a2ui.lynx.js', baseUrl);
      bundleUrl.searchParams.set(
        'messagesUrl',
        new URL(`/demos/${options.demoId}.json`, baseUrl).toString(),
      );
      bundleUrl.searchParams.set('instant', '1');
      bundleUrl.searchParams.set('theme', options.theme ?? 'light');
      bundleUrl.searchParams.set('fullscreen', 'true');
      return bundleUrl.toString();
    },
    createDemoPreviewUrl(options) {
      const renderUrl = new URL('/render.html', baseUrl);
      renderUrl.searchParams.set('protocol', options.protocol ?? 'a2ui');
      renderUrl.searchParams.set('demoUrl', options.demoUrl ?? './a2ui.web.js');
      renderUrl.searchParams.set('theme', options.theme ?? 'light');
      renderUrl.searchParams.set('demo', options.demoId);
      if (options.speed !== undefined) {
        renderUrl.searchParams.set('speed', String(options.speed));
      }
      return renderUrl.toString();
    },
    async dispose() {
      if (!exitState) {
        await disposeChildProcess(child.pid, detached, exitPromise);
      }
    },
    getLogs() {
      return formatLogs(stdout, stderr);
    },
  };
}

function assertPlaygroundPrerequisites(): void {
  const missing = REQUIRED_CATALOG_ARTIFACTS.filter((artifact) =>
    !existsSync(resolve(WORKSPACE_ROOT, artifact))
  );
  if (missing.length === 0) return;

  const formatted = missing.map((artifact) => `- ${artifact}`).join('\n');
  throw new Error(
    `Missing A2UI catalog artifacts required by the playground preview server:\n${formatted}\n\nRun \`pnpm -C packages/genui/a2ui build\` before starting @lynx-js/ui-judge model-backed tests.`,
  );
}

async function findFreePort(): Promise<number> {
  return await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close(() => reject(new Error('Failed to allocate a TCP port.')));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolvePort(port);
      });
    });
  });
}

async function waitForPlaygroundReady(
  baseUrl: string,
  getProcessError: () => Error | null,
): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  const renderUrl = new URL('/render.html', baseUrl).toString();
  const webBundleUrl = new URL('/a2ui.web.js', baseUrl).toString();
  const lynxBundleUrl = new URL('/a2ui.lynx.js', baseUrl).toString();

  while (Date.now() < deadline) {
    const processError = getProcessError();
    if (processError) throw processError;

    if (
      await fetchOk(renderUrl)
      && await fetchOk(webBundleUrl)
      && await fetchOk(lynxBundleUrl)
    ) {
      return;
    }

    await sleep(POLL_INTERVAL_MS);
  }

  const processError = getProcessError();
  if (processError) throw processError;
  throw new Error(
    `Timed out waiting for the A2UI playground preview server at ${baseUrl}.`,
  );
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

async function disposeChildProcess(
  pid: number | undefined,
  detached: boolean,
  exitPromise: Promise<void>,
): Promise<void> {
  if (!pid) return;

  tryKill(pid, detached, 'SIGTERM');
  const didExit = await Promise.race([
    exitPromise.then(() => true),
    sleep(DISPOSE_TIMEOUT_MS).then(() => false),
  ]);
  if (didExit) return;

  tryKill(pid, detached, 'SIGKILL');
  await Promise.race([exitPromise, sleep(1_000)]);
}

function tryKill(
  pid: number,
  detached: boolean,
  signal: NodeJS.Signals,
): void {
  try {
    process.kill(detached ? -pid : pid, signal);
  } catch {
    try {
      process.kill(pid, signal);
    } catch {
      // The process is already gone.
    }
  }
}

function formatLogs(stdout: BoundedLog, stderr: BoundedLog): string {
  const out = stdout.toString().trim();
  const err = stderr.toString().trim();
  const cwd = relative(WORKSPACE_ROOT, PLAYGROUND_CWD);
  return [
    `command: pnpm dev`,
    `cwd: ${cwd}`,
    `stdout:\n${out || '(empty)'}`,
    `stderr:\n${err || '(empty)'}`,
  ].join('\n\n');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}
