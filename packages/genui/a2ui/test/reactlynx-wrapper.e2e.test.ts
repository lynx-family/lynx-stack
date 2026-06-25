// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { dirname, relative, resolve, sep } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { afterAll, beforeAll, expect, test } from '@rstest/core';

import { generateReactLynxA2UIWrapperSource } from '../src/snapshot/index.js';
import type { ServerToClientMessage } from '../src/store/types.js';

const RUN_REACTLYNX_CODEGEN_E2E =
  process.env['A2UI_REACTLYNX_CODEGEN_E2E'] === '1';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, '../../../..');
const FIXTURE_PARENT_DIR = resolve(TEST_DIR, '../../.tmp');
const KITTEN_LYNX_IMPORT_SOURCE = pathToFileURL(
  resolve(REPO_ROOT, 'packages/testing-library/kitten-lynx/dist/index.js'),
).href;
const RSPEEDY_CLI_PATH = resolve(
  REPO_ROOT,
  'packages/rspeedy/core/bin/rspeedy.js',
);
const BUNDLE_NAME = 'main.lynx.bundle';
const CONTENT_TIMEOUT_MS = 30_000;
const NAVIGATION_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 500;
const LOG_LIMIT = 12_000;

interface KittenLynxView {
  goto(url: string, options?: { timeout?: number }): Promise<void>;
  content(): Promise<string>;
}

interface LynxConnection {
  newPage(): Promise<KittenLynxView>;
  close(): Promise<void>;
}

interface LynxModule {
  Lynx: {
    connect(options?: { deviceId?: string }): Promise<LynxConnection>;
  };
}

interface FixtureServer {
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

let projectDir: string | undefined;
let fixtureServer: FixtureServer | undefined;
let reversedPort: number | undefined;
let lynx: LynxConnection | undefined;
let page: KittenLynxView | undefined;

beforeAll(async () => {
  if (!RUN_REACTLYNX_CODEGEN_E2E) return;

  projectDir = await createReactLynxFixture();
  await buildReactLynxFixture(projectDir);
  fixtureServer = await startFixtureServer(resolve(projectDir, '.generated'));
  reversedPort = fixtureServer.port;
  await reverseAdbPort(reversedPort);

  const deviceId = getAndroidDeviceId();
  const { Lynx } = await import(KITTEN_LYNX_IMPORT_SOURCE) as LynxModule;
  lynx = await withTimeout(
    Lynx.connect(deviceId ? { deviceId } : undefined),
    120_000,
    'Timed out connecting to Kitten-Lynx.',
  );
  page = await lynx.newPage();
});

afterAll(async () => {
  await withTimeout(
    lynx?.close() ?? Promise.resolve(),
    10_000,
    'Timed out closing Kitten-Lynx.',
  ).catch(() => {
    // Keep teardown best-effort when the Kitten-Lynx bridge is already gone.
  });
  if (reversedPort !== undefined) {
    await withTimeout(
      removeReversedAdbPort(reversedPort),
      10_000,
      'Timed out removing adb port reverse.',
    ).catch(() => {
      // The emulator can already be gone during teardown.
    });
  }
  await withTimeout(
    fixtureServer?.dispose() ?? Promise.resolve(),
    10_000,
    'Timed out disposing fixture server.',
  ).catch(() => {
    // The server may already be closed after a failed setup.
  });
  if (projectDir) {
    await rm(projectDir, { force: true, recursive: true });
  }
});

const reactLynxCodegenE2ETest = RUN_REACTLYNX_CODEGEN_E2E
  ? test
  : test.skip;

reactLynxCodegenE2ETest(
  'compiles generated ReactLynx TSX and renders it with Kitten Lynx',
  async () => {
    if (!fixtureServer || !page) {
      throw new Error('ReactLynx codegen E2E test was not initialized.');
    }

    await page.goto(fixtureServer.createUrl(BUNDLE_NAME), {
      timeout: NAVIGATION_TIMEOUT_MS,
    });
    const content = await waitForContent(page, [
      'Generated ReactLynx wrapper',
      'Rendered by Kitten Lynx',
    ]);

    expect(content).toContain('Generated ReactLynx wrapper');
    expect(content).toContain('Rendered by Kitten Lynx');
  },
);

async function createReactLynxFixture(): Promise<string> {
  await mkdir(FIXTURE_PARENT_DIR, { recursive: true });
  const fixtureDir = await mkdtemp(
    resolve(FIXTURE_PARENT_DIR, 'reactlynx-wrapper-'),
  );
  const srcDir = resolve(fixtureDir, 'src');
  await mkdir(srcDir, { recursive: true });

  const messages: ServerToClientMessage[] = [
    {
      version: 'v0.9',
      createSurface: { surfaceId: 'main', catalogId: 'builtin' },
    },
    {
      version: 'v0.9',
      updateDataModel: {
        surfaceId: 'main',
        path: '/',
        value: {
          subtitle: 'Rendered by Kitten Lynx',
          title: 'Generated ReactLynx wrapper',
        },
      },
    },
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: 'main',
        components: [
          {
            id: 'root',
            component: 'Column',
            children: ['title', 'subtitle'],
          },
          {
            id: 'title',
            component: 'Text',
            text: { path: '/title' },
            variant: 'h2',
          },
          {
            id: 'subtitle',
            component: 'Text',
            text: { path: '/subtitle' },
          },
        ],
      },
    },
  ];

  const appSource = generateReactLynxA2UIWrapperSource(messages, {
    componentName: 'App',
    rootClassName: 'a2ui-light generated-codegen-e2e-app',
    surfaceClassName: 'generated-codegen-e2e-surface',
    surfaceWrapperClassName: 'generated-codegen-e2e-shell',
  });

  await writeFile(resolve(srcDir, 'App.tsx'), appSource);
  await writeFile(
    resolve(srcDir, 'index.tsx'),
    [
      'import \'@lynx-js/react/debug\';',
      'import { root } from \'@lynx-js/react\';',
      'import { App } from \'./App.js\';',
      '',
      'root.render(<App />);',
      '',
      'if (import.meta.webpackHot) {',
      '  import.meta.webpackHot.accept();',
      '}',
      '',
    ].join('\n'),
  );
  await writeFile(
    resolve(fixtureDir, 'tsconfig.json'),
    JSON.stringify(
      {
        compilerOptions: {
          jsx: 'preserve',
          jsxImportSource: '@lynx-js/react',
          types: ['@lynx-js/types'],
        },
        include: ['src'],
      },
      null,
      2,
    ),
  );
  await writeFile(
    resolve(fixtureDir, 'lynx.config.ts'),
    [
      'import { pluginReactLynx } from \'@lynx-js/react-rsbuild-plugin\';',
      'import { defineConfig } from \'@lynx-js/rspeedy\';',
      '',
      'export default defineConfig({',
      '  source: { entry: "./src/index.tsx" },',
      '  output: { distPath: { root: ".generated" } },',
      '  environments: { lynx: {} },',
      '  plugins: [pluginReactLynx()],',
      '});',
      '',
    ].join('\n'),
  );

  return fixtureDir;
}

async function buildReactLynxFixture(fixtureDir: string): Promise<void> {
  await runCommand(process.execPath, [
    RSPEEDY_CLI_PATH,
    'build',
    '--root',
    fixtureDir,
  ], {
    cwd: REPO_ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
    },
  });
}

async function startFixtureServer(distDir: string): Promise<FixtureServer> {
  const server = createServer((request, response) => {
    void handleFixtureRequest(distDir, request, response);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    port: address.port,
    createUrl(pathname) {
      return new URL(pathname, `${baseUrl}/`).toString();
    },
    async dispose() {
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
    },
  };
}

async function handleFixtureRequest(
  distDir: string,
  request: IncomingMessage,
  response: ServerResponse,
): Promise<void> {
  try {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1');
    const pathname = decodeURIComponent(requestUrl.pathname);
    const requestedFile = pathname === '/'
      ? BUNDLE_NAME
      : pathname.replace(/^\/+/, '');
    const filePath = resolve(distDir, requestedFile);
    const relativePath = relative(distDir, filePath);
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
      'Content-Type': getContentType(filePath),
    });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
}

async function waitForContent(
  lynxPage: KittenLynxView,
  expectedTexts: readonly string[],
): Promise<string> {
  const deadline = Date.now() + CONTENT_TIMEOUT_MS;
  let latestContent = '';
  let latestError: unknown;

  while (Date.now() < deadline) {
    try {
      const content = await lynxPage.content();
      if (expectedTexts.every(text => content.includes(text))) {
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
    : (latestContent ? ` Latest content: ${latestContent}` : '');
  throw new Error(`Timed out waiting for generated A2UI content.${details}`);
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

function getAndroidDeviceId(): string | undefined {
  return [
    process.env['KITTEN_LYNX_DEVICE_ID'],
    process.env['ANDROID_SERIAL'],
  ].map((value) => value?.trim()).find((value): value is string =>
    Boolean(value)
  );
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

function getContentType(filePath: string): string {
  if (filePath.endsWith('.js') || filePath.endsWith('.bundle')) {
    return 'application/javascript; charset=utf-8';
  }
  return 'application/octet-stream';
}

async function withTimeout<T>(
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

async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<{ stdout: string }> {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: options.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdout = new BoundedLog();
  const stderr = new BoundedLog();

  child.stdout.on('data', (chunk) => stdout.append(chunk));
  child.stderr.on('data', (chunk) => stderr.append(chunk));

  const exitState = await new Promise<
    { code: number | null; error?: Error; signal: NodeJS.Signals | null }
  >((resolveExit) => {
    child.once(
      'error',
      (error) => resolveExit({ code: null, error, signal: null }),
    );
    child.once('exit', (code, signal) => resolveExit({ code, signal }));
  });

  if (exitState.error) {
    throw new Error(
      `Command failed to start: ${command} ${
        args.join(' ')
      }. ${exitState.error.message}`,
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
