// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The test page and the kit's Worker, served from a fake origin with COOP and
// COEP headers by `page.route`: requests never leave Playwright.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { test as base } from '@playwright/test';
import type { Page, Route, TestInfo } from '@playwright/test';

import type {
  BuildEvent,
  BuildResult,
  BuiltinPackages,
  FileChange,
  FileMap,
  WebBundlerOptions,
} from '../src/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const require = createRequire(path.join(root, 'package.json'));
const webCoreClient = path.join(
  path.dirname(require.resolve('@lynx-js/web-core/package.json')),
  'dist/client_prod',
);

/** The fixture project, a ReactLynx project with two cards. */
export const fixtureDir = path.join(here, 'fixture');

/** The cards of the fixture. */
export const entries = {
  main: 'src/main/index.tsx',
  detail: 'src/detail/index.tsx',
};

// localhost is a trustworthy origin, so COOP applies.
export const ORIGIN = 'http://localhost:4100';
export const PUBLIC_PATH = `${ORIGIN}/out/`;

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.html': 'text/html',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
};

const HEADERS = {
  'cross-origin-opener-policy': 'same-origin',
  'cross-origin-embedder-policy': 'require-corp',
  'cross-origin-resource-policy': 'cross-origin',
};

const contentType = (file: string) =>
  TYPES[path.extname(file)] ?? 'application/octet-stream';

/** Reads the fixture project: text files as strings, images as bytes. */
export function readFixture(): FileMap {
  const files: FileMap = {};
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const file = path.join(dir, name);
      if (statSync(file).isDirectory()) {
        walk(file);
        continue;
      }
      const key = path.relative(fixtureDir, file).split(path.sep).join('/');
      files[key] = name.endsWith('.png')
        ? readFileSync(file)
        : readFileSync(file, 'utf-8');
    }
  };
  walk(fixtureDir);
  return files;
}

/** The text of a file of the fixture project. */
export const fixtureSource = (name: string): string =>
  readFileSync(path.join(fixtureDir, name), 'utf-8');

/**
 * A value as it crosses `page.evaluate`: bytes travel as base64 in both
 * directions.
 */
export type Wire<T> = T extends Uint8Array ? { base64: string }
  : T extends (infer U)[] ? Wire<U>[]
  : T extends object ? { [K in keyof T]: Wire<T[K]> }
  : T;

/** The methods of `e2e/page/worker.js`. */
interface KitMethods {
  create: {
    args: [WebBundlerOptions];
    result: { builtinPackages: BuiltinPackages };
  };
  build: { args: []; result: BuildResult };
  watch: { args: []; result: null };
  applyChanges: { args: [FileChange[]]; result: undefined };
  listFiles: { args: []; result: string[] };
  events: { args: []; result: BuildEvent[] };
  close: { args: []; result: null };
}

export type WireResult = Wire<BuildResult>;
export type WireAsset = WireResult['emitted'][number];

export const bytes = (value: { base64: string }): Buffer =>
  Buffer.from(value.base64, 'base64');

/** The contents of the emitted assets whose names `predicate` accepts. */
export const text = (
  result: WireResult,
  predicate: (name: string) => boolean,
): string =>
  result.emitted.filter(a => predicate(a.name)).map(a =>
    bytes(a.content).toString('utf-8')
  ).join('\n');

function toWire(value: unknown): unknown {
  if (value instanceof Uint8Array) {
    return { base64: Buffer.from(value).toString('base64') };
  }
  if (Array.isArray(value)) return value.map(toWire);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, toWire(v)]),
    );
  }
  return value;
}

export interface KitPage {
  page: Page;
  /** Calls the kit in the Worker. */
  kit<M extends keyof KitMethods>(
    method: M,
    ...args: KitMethods[M]['args']
  ): Promise<Wire<KitMethods[M]['result']>>;
  /** Serves the emitted assets of a build under `PUBLIC_PATH`. */
  serve(result: WireResult): void;
  /** The browser console of the page and its workers. */
  consoleLines: string[];
  /** Requests for built assets, relative to `PUBLIC_PATH`. */
  requested: string[];
  /** Records a timing as an annotation of the test. */
  timing(name: string, ms: number): void;
}

async function serveFile(route: Route, file: string) {
  if (!existsSync(file) || statSync(file).isDirectory()) {
    return route.fulfill({ status: 404, headers: HEADERS, body: 'not found' });
  }
  return route.fulfill({
    status: 200,
    headers: { ...HEADERS, 'content-type': contentType(file) },
    body: readFileSync(file),
  });
}

async function openKitPage(page: Page, testInfo: TestInfo): Promise<KitPage> {
  /** Assets of the latest builds, served under /out/. */
  const served = new Map<string, Buffer>();
  await page.route(`${ORIGIN}/**`, route => {
    const pathname = decodeURIComponent(
      new URL(route.request().url()).pathname,
    );
    if (pathname === '/' || pathname === '/index.html') {
      return serveFile(route, path.join(here, 'page/index.html'));
    }
    if (pathname.startsWith('/e2e/')) {
      return serveFile(route, path.join(here, 'page', pathname.slice(5)));
    }
    if (pathname.startsWith('/dist/')) {
      return serveFile(route, path.join(root, 'dist', pathname.slice(6)));
    }
    if (pathname.startsWith('/web-core/')) {
      return serveFile(route, path.join(webCoreClient, pathname.slice(10)));
    }
    if (pathname.startsWith('/out/')) {
      const content = served.get(pathname.slice(5));
      if (!content) {
        return route.fulfill({
          status: 404,
          headers: HEADERS,
          body: 'not built',
        });
      }
      return route.fulfill({
        status: 200,
        headers: { ...HEADERS, 'content-type': contentType(pathname) },
        body: content,
      });
    }
    return route.fulfill({ status: 404, headers: HEADERS, body: 'not found' });
  });

  const consoleLines: string[] = [];
  const requested: string[] = [];
  page.on('request', request => {
    if (request.url().startsWith(PUBLIC_PATH)) {
      requested.push(request.url().slice(PUBLIC_PATH.length));
    }
  });
  page.on(
    'console',
    message => consoleLines.push(`[${message.type()}] ${message.text()}`),
  );
  page.on(
    'pageerror',
    error => consoleLines.push(`[pageerror] ${error.message}`),
  );
  page.on('worker', worker => {
    worker.on(
      'console',
      message =>
        consoleLines.push(`[worker ${message.type()}] ${message.text()}`),
    );
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => window.ready === true);

  return {
    page,
    consoleLines,
    requested,
    async kit(method, ...args) {
      // The function runs in the page.
      return page.evaluate(async ({ method, args }) => {
        const revive = (value: unknown): unknown => {
          if (Array.isArray(value)) return value.map(revive);
          if (value && typeof value === 'object') {
            if ('base64' in value && typeof value.base64 === 'string') {
              return Uint8Array.from(atob(value.base64), c => c.charCodeAt(0));
            }
            return Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, revive(v)]),
            );
          }
          return value;
        };
        const plain = (value: unknown): unknown => {
          if (value instanceof Uint8Array) {
            return {
              base64: btoa(
                Array.from(value, b => String.fromCharCode(b)).join(''),
              ),
            };
          }
          if (Array.isArray(value)) return value.map(plain);
          if (value && typeof value === 'object') {
            return Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, plain(v)]),
            );
          }
          return value;
        };
        return plain(await window.kit(method, ...(revive(args) as unknown[])));
      }, { method, args: toWire(args) }) as never;
    },
    serve(result) {
      for (const asset of result.emitted) {
        served.set(asset.name, bytes(asset.content));
      }
    },
    timing(name, ms) {
      testInfo.annotations.push({
        type: 'timing',
        description: `${name}: ${ms} ms`,
      });
    },
  };
}

/**
 * `kitPage` is the test page with the kit's Worker started. When a test
 * fails, the browser console is attached to its result.
 */
export const test = base.extend<{ kitPage: KitPage }>({
  kitPage: async ({ page }, use, testInfo) => {
    const kitPage = await openKitPage(page, testInfo);
    await use(kitPage);
    if (testInfo.status !== testInfo.expectedStatus) {
      await testInfo.attach('browser console', {
        body: kitPage.consoleLines.slice(-60).join('\n'),
        contentType: 'text/plain',
      });
    }
  },
});

export { expect } from '@playwright/test';
