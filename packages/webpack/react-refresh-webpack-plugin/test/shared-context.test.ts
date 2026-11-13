// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';

import { rspack } from '@rspack/core';
import type { Configuration, Stats } from '@rspack/core';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  rstest,
} from '@rstest/core';

import { ReactRefreshRspackPlugin } from '../src/ReactRefreshRspackPlugin.js';

const require = createRequire(import.meta.url);
const refreshPackageEntry = require.resolve('@lynx-js/react/refresh');
const preactAliases = {
  'preact': require.resolve('preact'),
  'preact/hooks': require.resolve('preact/hooks'),
  'preact/jsx-runtime': require.resolve('preact/jsx-runtime'),
  'preact/jsx-dev-runtime': require.resolve('preact/jsx-dev-runtime'),
};

interface FakeNode {
  nodeType: number;
  nodeName?: string;
  data?: string;
  style?: Record<string, string>;
  parentNode: FakeElement | null;
  childNodes?: FakeNode[];
  firstChild?: FakeNode | null;
  remove(): void;
  readonly textContent: string;
}

interface FakeElement extends FakeNode {
  childNodes: FakeNode[];
  firstChild: FakeNode | null;
  appendChild(child: FakeNode): FakeNode;
  insertBefore(child: FakeNode, ref: FakeNode | null): FakeNode;
  removeChild(child: FakeNode): FakeNode;
  setAttribute(): void;
  removeAttribute(): void;
  addEventListener(): void;
  removeEventListener(): void;
}

interface SharedPreactModules {
  preact: {
    h: (...args: unknown[]) => unknown;
    render: (vnode: unknown, container: FakeElement) => void;
    options: {
      document?: unknown;
      [key: string]: unknown;
    };
    Component: unknown;
    Fragment: unknown;
  };
  hooks: Record<string, unknown>;
  jsxDevRuntime: Record<string, unknown>;
  jsxRuntime: Record<string, unknown>;
}

interface SharedRefreshModule {
  createRefreshRuntime: () => {
    sign: (
      type: unknown,
      key: string | undefined,
      forceReset?: boolean,
      getCustomHooks?: () => unknown[],
      status?: string,
    ) => string | undefined;
    register: (type: unknown, id: string) => void;
    flush: () => void;
  };
  flush: () => void;
  isComponent: (exportValue: unknown) => boolean;
}

let preactHostBundleCode = '';
let refreshHostBundleCode = '';
let bundleCounter = 0;
const cleanupDirs: string[] = [];

async function compileRspackOnce(config: Configuration): Promise<void> {
  const compiler = rspack(config);
  try {
    await new Promise<void>((resolve, reject) => {
      compiler.run((err, stats) => {
        if (err) {
          reject(err);
          return;
        }
        if (stats?.hasErrors()) {
          reject(new Error(stats.toString({ errors: true })));
          return;
        }
        resolve();
      });
    });
  } finally {
    await new Promise<void>((resolve) => {
      compiler.close(() => resolve());
    });
  }
}

function detachFromParent(node: FakeNode) {
  if (node.parentNode) {
    node.parentNode.removeChild(node);
  }
}

function createContainer(nodeName = 'ROOT'): FakeElement {
  const el: FakeElement = {
    nodeType: 1,
    nodeName,
    style: {},
    parentNode: null,
    childNodes: [],
    firstChild: null,
    appendChild(child) {
      detachFromParent(child);
      child.parentNode = el;
      el.childNodes.push(child);
      el.firstChild = el.childNodes[0] ?? null;
      return child;
    },
    insertBefore(child, ref) {
      detachFromParent(child);
      child.parentNode = el;
      const idx = ref ? el.childNodes.indexOf(ref) : -1;
      if (idx === -1) {
        el.childNodes.push(child);
      } else {
        el.childNodes.splice(idx, 0, child);
      }
      el.firstChild = el.childNodes[0] ?? null;
      return child;
    },
    removeChild(child) {
      const idx = el.childNodes.indexOf(child);
      if (idx !== -1) {
        el.childNodes.splice(idx, 1);
      }
      child.parentNode = null;
      el.firstChild = el.childNodes[0] ?? null;
      return child;
    },
    remove() {
      detachFromParent(el);
    },
    setAttribute() {/* noop */},
    removeAttribute() {/* noop */},
    addEventListener() {/* noop */},
    removeEventListener() {/* noop */},
    get textContent() {
      return el.childNodes.map((child) => child.textContent).join('');
    },
  };
  return el;
}

function createFakeDomFactory() {
  const fakeDocument = {
    createElement(tag: string) {
      return createContainer(tag.toUpperCase());
    },
    createElementNS(_ns: string, tag: string) {
      return createContainer(tag.toUpperCase());
    },
    createTextNode(data: unknown): FakeNode {
      const node: FakeNode = {
        nodeType: 3,
        data: String(data),
        parentNode: null,
        remove() {
          detachFromParent(node);
        },
        get textContent() {
          return node.data ?? '';
        },
      };
      return node;
    },
  };

  return { createContainer, fakeDocument };
}

interface SandboxRuntime {
  context: vm.Context;
  sandbox: Record<string, unknown>;
  p: SharedPreactModules;
  refresh: SharedRefreshModule;
  createContainer: (nodeName?: string) => FakeElement;
  evalCjsFile: (
    filePath: string,
    extraExternals?: Record<string, unknown>,
  ) => Record<string, unknown>;
}

function createSharedContext(): SandboxRuntime {
  const { createContainer, fakeDocument } = createFakeDomFactory();
  const sandbox: Record<string, unknown> = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Symbol,
    WeakMap,
    WeakSet,
    Map,
    Set,
    Error,
    Object,
    Array,
    URL,
    Buffer,
    process,
  };
  sandbox['globalThis'] = sandbox;
  sandbox['global'] = sandbox;
  sandbox['self'] = sandbox;
  const context = vm.createContext(sandbox);

  function evalCjsCode(
    code: string,
    filename: string,
    externalModules: Record<string, unknown>,
  ): Record<string, unknown> {
    const dirname = path.dirname(filename);
    const baseRequire = createRequire(filename) as unknown as (
      id: string,
    ) => unknown;
    const localRequire = (id: string) => {
      if (Object.hasOwn(externalModules, id)) {
        return externalModules[id];
      }
      if (id.startsWith('./') || id.startsWith('../')) {
        const target = path.resolve(dirname, id);
        if (fs.existsSync(target) && fs.statSync(target).isFile()) {
          return evalCjsCode(
            fs.readFileSync(target, 'utf-8'),
            target,
            externalModules,
          );
        }
      }
      return baseRequire(id);
    };
    const mod: { exports: Record<string, unknown> } = { exports: {} };
    const wrapped =
      `(function(require, module, exports, __filename, __dirname) {\n${code}\n})`;
    const fn = vm.runInContext(wrapped, context, { filename }) as (
      req: (id: string) => unknown,
      m: { exports: Record<string, unknown> },
      exp: Record<string, unknown>,
      file: string,
      dir: string,
    ) => void;
    fn(localRequire, mod, mod.exports, filename, dirname);
    return mod.exports;
  }

  const sharedPreact = evalCjsCode(
    preactHostBundleCode,
    path.join(os.tmpdir(), 'shared-preact.cjs'),
    {},
  ) as unknown as SharedPreactModules;
  sharedPreact.preact.options.document = fakeDocument;

  const baseExternals: Record<string, unknown> = {
    '__host_preact__': sharedPreact.preact,
    '__host_hooks__': {
      ...sharedPreact.preact,
      ...sharedPreact.hooks,
    },
    '__host_jsx__': sharedPreact.jsxRuntime,
    '__host_jsx_dev__': sharedPreact.jsxDevRuntime,
  };

  const sharedRefresh = evalCjsCode(
    refreshHostBundleCode,
    path.join(os.tmpdir(), 'shared-refresh.cjs'),
    baseExternals,
  ) as unknown as SharedRefreshModule;

  const evalCjsFile = (
    filePath: string,
    extraExternals: Record<string, unknown> = {},
  ) =>
    evalCjsCode(fs.readFileSync(filePath, 'utf-8'), filePath, {
      ...baseExternals,
      ...extraExternals,
    });

  return {
    context,
    sandbox,
    p: sharedPreact,
    refresh: sharedRefresh,
    createContainer,
    evalCjsFile,
  };
}

async function flushPreact() {
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 20));
}

interface HmrBundleHarness {
  srcDir: string;
  distDir: string;
  evaluate: () => Record<string, unknown>;
  writeFile: (relPath: string, content: string) => Promise<void>;
  exports: Record<string, unknown>;
  close: () => Promise<void>;
}

async function startHmrBundle(options: {
  sandboxRuntime: SandboxRuntime;
  files: Record<string, string>;
  entry: string;
  refreshMode:
    | 'bundled'
    | 'shared-external'
    | { asyncExternalGlobal: string }
    | { legacyExternal: SharedRefreshModule };
  evaluateImmediately?: boolean;
}): Promise<HmrBundleHarness> {
  const rootDir = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'lynx-refresh-shared-')),
  );
  cleanupDirs.push(rootDir);
  const srcDir = path.join(rootDir, 'src');
  const distDir = path.join(rootDir, 'dist');
  fs.mkdirSync(srcDir, { recursive: true });

  for (const [relPath, content] of Object.entries(options.files)) {
    const abs = path.join(srcDir, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }

  const externals: Record<string, string> = {
    'preact': 'commonjs __host_preact__',
    'preact/hooks': 'commonjs __host_hooks__',
    'preact/jsx-runtime': 'commonjs __host_jsx__',
    'preact/jsx-dev-runtime': 'commonjs __host_jsx_dev__',
    '@lynx-js/react': 'commonjs __host_hooks__',
    '@lynx-js/react/internal': 'commonjs __host_preact__',
  };
  let externalsType: Configuration['externalsType'];
  const extraExternals: Record<string, unknown> = {};

  if (options.refreshMode === 'shared-external') {
    externals['@lynx-js/react/refresh'] = 'commonjs __host_refresh__';
    extraExternals['__host_refresh__'] = options.sandboxRuntime.refresh;
  } else if (
    typeof options.refreshMode === 'object'
    && 'legacyExternal' in options.refreshMode
  ) {
    externals['@lynx-js/react/refresh'] = 'commonjs __host_refresh_legacy__';
    extraExternals['__host_refresh_legacy__'] =
      options.refreshMode.legacyExternal;
  } else if (
    typeof options.refreshMode === 'object'
    && 'asyncExternalGlobal' in options.refreshMode
  ) {
    externalsType = 'promise';
    externals['@lynx-js/react/refresh'] =
      options.refreshMode.asyncExternalGlobal;
  }

  const config: Configuration = {
    context: srcDir,
    mode: 'development',
    target: 'async-node',
    entry: options.entry,
    output: {
      path: distDir,
      filename: 'main.cjs',
      uniqueName: `shared_context_test_${++bundleCounter}`,
      library: { type: 'commonjs2' },
    },
    ...(externalsType ? { externalsType } : {}),
    externals,
    resolve: {
      extensions: ['.jsx', '.js'],
      alias: options.refreshMode === 'bundled'
        ? {
          '@lynx-js/react/refresh': refreshPackageEntry,
        }
        : undefined,
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          exclude: [
            /node_modules/,
            /packages\/react\/refresh/,
            /runtime\/refresh\.mjs/,
            /runtime\/refreshRuntime\.cjs/,
            ReactRefreshRspackPlugin.loader,
          ],
          use: [ReactRefreshRspackPlugin.loader],
        },
        {
          test: /\.jsx?$/,
          exclude: [
            /node_modules/,
            /packages\/react\/refresh/,
            /runtime\/refresh\.mjs/,
            /runtime\/refreshRuntime\.cjs/,
            ReactRefreshRspackPlugin.loader,
          ],
          use: [
            {
              loader: 'builtin:swc-loader',
              options: {
                jsc: {
                  target: 'es2019',
                  parser: { syntax: 'ecmascript', jsx: true },
                  transform: {
                    react: {
                      runtime: 'automatic',
                      importSource: 'preact',
                      development: true,
                      refresh: true,
                    },
                  },
                },
              },
            },
          ],
        },
      ],
    },
    plugins: [
      new rspack.HotModuleReplacementPlugin(),
      new ReactRefreshRspackPlugin(),
    ],
  };

  let pendingBuildResolve:
    | ((res: { err?: Error | null; stats?: Stats }) => void)
    | null = null;
  let pendingChanges = new Set<string>();
  const compiler = rspack(config);
  (compiler as unknown as { watchFileSystem: unknown }).watchFileSystem = {
    watch() {
      return {
        close() {/* noop */},
        pause() {/* noop */},
        getInfo() {
          const changes = pendingChanges;
          pendingChanges = new Set();
          return {
            changes,
            removals: new Set<string>(),
            fileTimeInfoEntries: new Map(),
            contextTimeInfoEntries: new Map(),
          };
        },
      };
    },
  };
  const initialBuildPromise = new Promise<
    { err?: Error | null; stats?: Stats }
  >(
    (resolve) => {
      pendingBuildResolve = resolve;
    },
  );
  const watching = compiler.watch(
    {},
    (err, stats) => {
      if (pendingBuildResolve) {
        const res = pendingBuildResolve;
        pendingBuildResolve = null;
        res({ err, stats });
      }
    },
  );

  const initialBuild = await initialBuildPromise;
  if (initialBuild.err || initialBuild.stats?.hasErrors()) {
    throw new Error(
      initialBuild.err?.message
        ?? initialBuild.stats?.toString({ errors: true }),
    );
  }

  let bundleExports: Record<string, unknown> = {};
  const evaluate = () => {
    bundleExports = options.sandboxRuntime.evalCjsFile(
      path.join(distDir, 'main.cjs'),
      extraExternals,
    );
    return bundleExports;
  };
  if (options.evaluateImmediately !== false) {
    evaluate();
  }

  return {
    srcDir,
    distDir,
    evaluate,
    get exports() {
      return bundleExports;
    },
    async writeFile(relPath: string, content: string) {
      const absPath = path.join(srcDir, relPath);
      const nextBuildPromise = new Promise<{
        err?: Error | null;
        stats?: Stats;
      }>((resolve) => {
        pendingBuildResolve = resolve;
      });
      fs.writeFileSync(absPath, content);
      pendingChanges = new Set([absPath]);
      watching.invalidate();
      const res = await nextBuildPromise;
      if (res.err || res.stats?.hasErrors()) {
        throw new Error(
          res.err?.message ?? res.stats?.toString({ errors: true }),
        );
      }
    },
    async close() {
      await new Promise<void>((resolve) => watching.close(() => resolve()));
    },
  };
}

function makeCounterEntryCode() {
  return `
import { render } from 'preact';
import { App } from './app.jsx';

export function mount(container) {
  render(<App />, container);
}

export function unmount(container) {
  render(null, container);
}

export async function checkHmr() {
  return module.hot.check(true);
}
`;
}

function makeCleanApp(label: string, version: string, init: number) {
  return `
import { useState } from 'preact/hooks';
import { Card } from './card.jsx';
export function App() {
  const [n, setN] = useState(${init});
  globalThis.__SET_STATE_${label}__ = () => setN(v => v + 1);
  globalThis.__RENDERS_${label}__ = (globalThis.__RENDERS_${label}__ || 0) + 1;
  return <div>{${JSON.stringify(`${label}-${version}:`)}}{n}|<Card /></div>;
}
`;
}

function makeCard(label: string, tag: string) {
  return `
export function Card() {
  return <span>{${JSON.stringify(`${label}-card-${tag}`)}}</span>;
}
`;
}

function makeSharedApp(label: string, version: string) {
  return `
import { useState } from 'preact/hooks';
export function App() {
  const [count, setCount] = useState(1);
  globalThis.__SET_SHARED_${label}__ = () => setCount(v => v + 1);
  return <div>{${JSON.stringify(`${label}-${version}:`)}}{count}</div>;
}
`;
}

function makeAsyncApp(label: string, version: string, extraHook = false) {
  return `
import { useState } from 'preact/hooks';
export function App() {
  const [count, setCount] = useState(10);
  ${extraHook ? `const [tag] = useState('reset');` : ''}
  globalThis.__SET_ASYNC_${label}__ = () => setCount(v => v + 1);
  return <div>{${JSON.stringify(`${label}-${version}:`)}}{count}${
    extraHook ? `:{tag}` : ''
  }</div>;
}
`;
}

describe('Fast Refresh shared JS context isolation', () => {
  beforeAll(async () => {
    const hostDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'lynx-refresh-host-'),
    );
    cleanupDirs.push(hostDir);
    const hostSrc = path.join(hostDir, 'src');
    const hostDist = path.join(hostDir, 'dist');
    fs.mkdirSync(hostSrc, { recursive: true });

    fs.writeFileSync(
      path.join(hostSrc, 'preact-host.js'),
      `
export * as preact from 'preact';
export * as hooks from 'preact/hooks';
export * as jsxRuntime from 'preact/jsx-runtime';
export * as jsxDevRuntime from 'preact/jsx-dev-runtime';
`,
    );

    await compileRspackOnce({
      context: hostSrc,
      mode: 'development',
      target: 'node',
      entry: './preact-host.js',
      output: {
        path: hostDist,
        filename: 'shared-preact.cjs',
        library: { type: 'commonjs2' },
      },
      resolve: {
        alias: preactAliases,
      },
    });
    preactHostBundleCode = fs.readFileSync(
      path.join(hostDist, 'shared-preact.cjs'),
      'utf-8',
    );

    await compileRspackOnce({
      context: hostSrc,
      mode: 'development',
      target: 'node',
      entry: refreshPackageEntry,
      output: {
        path: hostDist,
        filename: 'shared-refresh.cjs',
        library: { type: 'commonjs2' },
      },
      externals: {
        '@lynx-js/react/internal': 'commonjs __host_preact__',
        '@lynx-js/react': 'commonjs __host_hooks__',
      },
    });
    refreshHostBundleCode = fs.readFileSync(
      path.join(hostDist, 'shared-refresh.cjs'),
      'utf-8',
    );
  });

  afterAll(() => {
    for (const dir of cleanupDirs) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('applies each distinct (prev, next) pair once in order [A0->A1, A0->A1, A1->A2]', async () => {
    const sb = createSharedContext();
    const { h, render } = sb.p.preact;
    const { useState } = sb.p.hooks as {
      useState: <T>(init: T) => [T, (next: T | ((prev: T) => T)) => void];
    };
    const core = sb.sandbox['__PREFRESH__'] as {
      replaceComponent: (prev: unknown, next: unknown, reset: boolean) => void;
    };
    const replaceSpy = rstest.spyOn(core, 'replaceComponent');

    function A0() {
      const [count] = useState(42);
      return h('div', null, `A0:${count}`);
    }
    function A1() {
      const [count] = useState(42);
      return h('div', null, `A1:${count}`);
    }
    function A2() {
      const [count] = useState(42);
      return h('div', null, `A2:${count}`);
    }

    const runtime = sb.refresh.createRefreshRuntime();
    runtime.sign(A0, 'useState[count:42]', false, () => [], 'begin');
    runtime.sign(A0, 'useState[count:42]', false, () => [], 'needsHooks');
    runtime.register(A0, './app.jsx A');
    runtime.register(A0, './app.jsx %exports% A');

    const container = sb.createContainer();
    render(h(A0, null), container);
    expect(container.textContent).toBe('A0:42');

    // Two distinct registry IDs both transition A0 -> A1 (duplicate pair),
    // then one transitions A1 -> A2 in the same flush batch.
    runtime.sign(A1, 'useState[count:42]', false, () => [], 'begin');
    runtime.sign(A1, 'useState[count:42]', false, () => [], 'needsHooks');
    runtime.register(A1, './app.jsx A');
    runtime.register(A1, './app.jsx %exports% A');

    runtime.sign(A2, 'useState[count:42]', false, () => [], 'begin');
    runtime.sign(A2, 'useState[count:42]', false, () => [], 'needsHooks');
    runtime.register(A2, './app.jsx A');

    runtime.flush();
    await flushPreact();

    expect(replaceSpy).toHaveBeenCalledTimes(2);
    expect(replaceSpy.mock.calls[0]).toEqual([A0, A1, false]);
    expect(replaceSpy.mock.calls[1]).toEqual([A1, A2, false]);
    expect(container.textContent).toBe('A2:42');
  });

  it('isolates colliding ./app.jsx#App across two bundled runtimes in both load orders and across local files', async () => {
    for (const order of ['A-first', 'B-first'] as const) {
      const sb = createSharedContext();

      const bundleA = await startHmrBundle({
        sandboxRuntime: sb,
        entry: './entry.jsx',
        refreshMode: 'bundled',
        evaluateImmediately: false,
        files: {
          'card.jsx': makeCard('A', '1'),
          'app.jsx': makeCleanApp('A', 'v1', 10),
          'entry.jsx': makeCounterEntryCode(),
        },
      });
      const bundleB = await startHmrBundle({
        sandboxRuntime: sb,
        entry: './entry.jsx',
        refreshMode: 'bundled',
        evaluateImmediately: false,
        files: {
          'card.jsx': makeCard('B', '1'),
          'app.jsx': makeCleanApp('B', 'v1', 20),
          'entry.jsx': makeCounterEntryCode(),
        },
      });

      try {
        let exportsA: Record<string, unknown>;
        let exportsB: Record<string, unknown>;
        if (order === 'A-first') {
          exportsA = bundleA.evaluate();
          exportsB = bundleB.evaluate();
        } else {
          exportsB = bundleB.evaluate();
          exportsA = bundleA.evaluate();
        }

        const containerA = sb.createContainer();
        const containerB = sb.createContainer();
        (exportsA['mount'] as (c: FakeElement) => void)(containerA);
        (exportsB['mount'] as (c: FakeElement) => void)(containerB);
        await flushPreact();

        expect(containerA.textContent).toBe('A-v1:10|A-card-1');
        expect(containerB.textContent).toBe('B-v1:20|B-card-1');

        (sb.sandbox['__SET_STATE_A__'] as () => void)();
        (sb.sandbox['__SET_STATE_B__'] as () => void)();
        await flushPreact();
        expect(containerA.textContent).toBe('A-v1:11|A-card-1');
        expect(containerB.textContent).toBe('B-v1:21|B-card-1');

        const rendersBBefore = sb.sandbox['__RENDERS_B__'];
        await bundleA.writeFile('app.jsx', makeCleanApp('A', 'v2', 10));
        await (exportsA['checkHmr'] as () => Promise<unknown>)();
        await flushPreact();

        expect(containerA.textContent).toBe('A-v2:11|A-card-1');
        expect(containerB.textContent).toBe('B-v1:21|B-card-1');
        expect(sb.sandbox['__RENDERS_B__']).toBe(rendersBBefore);

        const rendersABefore = sb.sandbox['__RENDERS_A__'];
        await bundleB.writeFile('card.jsx', makeCard('B', '2'));
        await (exportsB['checkHmr'] as () => Promise<unknown>)();
        await flushPreact();

        expect(containerB.textContent).toBe('B-v1:21|B-card-2');
        expect(containerA.textContent).toBe('A-v2:11|A-card-1');
        expect(sb.sandbox['__RENDERS_A__']).toBe(rendersABefore);
      } finally {
        await bundleA.close();
        await bundleB.close();
      }
    }

    // Same-named local helper components across two modules in the same bundle
    const sb = createSharedContext();
    const bundle = await startHmrBundle({
      sandboxRuntime: sb,
      entry: './entry.jsx',
      refreshMode: 'bundled',
      files: {
        'first.jsx':
          `function Box() { return <span>first-1</span>; } export function First() { return <Box />; }`,
        'second.jsx':
          `function Box() { return <span>second-1</span>; } export function Second() { return <Box />; }`,
        'entry.jsx': `
import { render } from 'preact';
import { First } from './first.jsx';
import { Second } from './second.jsx';
export function mount(c) { render(<div><First />|<Second /></div>, c); }
export async function checkHmr() { return module.hot.check(true); }
`,
      },
    });
    try {
      const container = sb.createContainer();
      (bundle.exports['mount'] as (c: FakeElement) => void)(container);
      await flushPreact();
      expect(container.textContent).toBe('first-1|second-1');

      await bundle.writeFile(
        'first.jsx',
        `function Box() { return <span>first-2</span>; } export function First() { return <Box />; }`,
      );
      await (bundle.exports['checkHmr'] as () => Promise<unknown>)();
      await flushPreact();
      expect(container.textContent).toBe('first-2|second-1');
    } finally {
      await bundle.close();
    }
  });

  it('keeps card A HMR and hook state intact after closing card B with shared external @lynx-js/react/refresh', async () => {
    const sb = createSharedContext();

    const bundleA = await startHmrBundle({
      sandboxRuntime: sb,
      entry: './entry.jsx',
      refreshMode: 'shared-external',
      files: {
        'app.jsx': makeSharedApp('A', 'v1'),
        'entry.jsx': makeCounterEntryCode(),
      },
    });
    const bundleB = await startHmrBundle({
      sandboxRuntime: sb,
      entry: './entry.jsx',
      refreshMode: 'shared-external',
      files: {
        'app.jsx': makeSharedApp('B', 'v1'),
        'entry.jsx': makeCounterEntryCode(),
      },
    });

    try {
      const containerA = sb.createContainer();
      const containerB = sb.createContainer();
      (bundleA.exports['mount'] as (c: FakeElement) => void)(containerA);
      await flushPreact();
      (sb.sandbox['__SET_SHARED_A__'] as () => void)();
      await flushPreact();
      expect(containerA.textContent).toBe('A-v1:2');

      (bundleB.exports['mount'] as (c: FakeElement) => void)(containerB);
      await flushPreact();
      expect(containerB.textContent).toBe('B-v1:1');

      // Close card B
      (bundleB.exports['unmount'] as (c: FakeElement) => void)(containerB);
      await flushPreact();

      // Update A's state and then apply an HMR update to A
      (sb.sandbox['__SET_SHARED_A__'] as () => void)();
      await flushPreact();
      expect(containerA.textContent).toBe('A-v1:3');

      await bundleA.writeFile('app.jsx', makeSharedApp('A', 'v2'));
      await (bundleA.exports['checkHmr'] as () => Promise<unknown>)();
      await flushPreact();
      expect(containerA.textContent).toBe('A-v2:3');
    } finally {
      await bundleA.close();
      await bundleB.close();
    }
  });

  it('binds delayed-resolve async external @lynx-js/react/refresh to owning bundle across interleaved loads', async () => {
    const sb = createSharedContext();
    let resolveRefreshA: ((value: SharedRefreshModule) => void) | null = null;
    sb.sandbox['__LOAD_REFRESH_A__'] = new Promise<SharedRefreshModule>(
      (resolve) => {
        resolveRefreshA = resolve;
      },
    );
    sb.sandbox['__LOAD_REFRESH_B__'] = Promise.resolve(sb.refresh);

    const bundleA = await startHmrBundle({
      sandboxRuntime: sb,
      entry: './entry.jsx',
      refreshMode: { asyncExternalGlobal: 'globalThis.__LOAD_REFRESH_A__' },
      evaluateImmediately: false,
      files: {
        'app.jsx': makeAsyncApp('A', 'v1'),
        'entry.jsx': makeCounterEntryCode(),
      },
    });
    const bundleB = await startHmrBundle({
      sandboxRuntime: sb,
      entry: './entry.jsx',
      refreshMode: { asyncExternalGlobal: 'globalThis.__LOAD_REFRESH_B__' },
      evaluateImmediately: false,
      files: {
        'app.jsx': makeAsyncApp('B', 'v1'),
        'entry.jsx': makeCounterEntryCode(),
      },
    });

    try {
      // Evaluate A while its async external is still pending, then interleave B completely.
      const exportsAPromise = bundleA.evaluate() as unknown as Promise<
        Record<string, unknown>
      >;
      const exportsB = await (
        bundleB.evaluate() as unknown as Promise<Record<string, unknown>>
      );

      const containerB = sb.createContainer();
      (exportsB['mount'] as (c: FakeElement) => void)(containerB);
      await flushPreact();
      (sb.sandbox['__SET_ASYNC_B__'] as () => void)();
      await flushPreact();
      expect(containerB.textContent).toBe('B-v1:11');

      resolveRefreshA!(sb.refresh);
      const exportsA = await exportsAPromise;

      const containerA = sb.createContainer();
      (exportsA['mount'] as (c: FakeElement) => void)(containerA);
      await flushPreact();
      (sb.sandbox['__SET_ASYNC_A__'] as () => void)();
      await flushPreact();
      expect(containerA.textContent).toBe('A-v1:11');

      // Preserving hooks update on A must keep count=11 and leave B intact.
      await bundleA.writeFile('app.jsx', makeAsyncApp('A', 'v2'));
      await (exportsA['checkHmr'] as () => Promise<unknown>)();
      await flushPreact();
      expect(containerA.textContent).toBe('A-v2:11');
      expect(containerB.textContent).toBe('B-v1:11');

      // Signature-changing update on A must reset count back to 10 (proving $RefreshSig$ bound to A).
      await bundleA.writeFile('app.jsx', makeAsyncApp('A', 'v3', true));
      await (exportsA['checkHmr'] as () => Promise<unknown>)();
      await flushPreact();
      expect(containerA.textContent).toBe('A-v3:10:reset');
      expect(containerB.textContent).toBe('B-v1:11');
    } finally {
      await bundleA.close();
      await bundleB.close();
    }
  });

  it('supports legacy single-template fallbacks and keeps new-plugin templates isolated when legacy runs before or after', async () => {
    // 1. Legacy plugin against new `@lynx-js/react/refresh` (via `globalThis.__PREFRESH__` + `flush`)
    {
      const sb = createSharedContext();
      const { h, render } = sb.p.preact;
      const { useState } = sb.p.hooks as {
        useState: <T>(init: T) => [T, (next: T | ((prev: T) => T)) => void];
      };
      const ambient = sb.sandbox['__PREFRESH__'] as {
        register: (type: unknown, id: string) => void;
        sign: (
          type: unknown,
          key: string,
          forceReset?: boolean,
          getCustomHooks?: () => unknown[],
          status?: string,
        ) => string | undefined;
      };

      function V1() {
        const [n] = useState(5);
        return h('div', null, `legacy-plugin-v1:${n}`);
      }
      function V2() {
        const [n] = useState(5);
        return h('div', null, `legacy-plugin-v2:${n}`);
      }

      ambient.sign(V1, 'k', false, () => [], 'begin');
      ambient.sign(V1, 'k', false, () => [], 'needsHooks');
      ambient.register(V1, './app.jsx V');

      const container = sb.createContainer();
      render(h(V1, null), container);
      expect(container.textContent).toBe('legacy-plugin-v1:5');

      ambient.sign(V2, 'k', false, () => [], 'begin');
      ambient.sign(V2, 'k', false, () => [], 'needsHooks');
      ambient.register(V2, './app.jsx V');
      sb.refresh.flush();
      await flushPreact();
      expect(container.textContent).toBe('legacy-plugin-v2:5');
    }

    // 2. New plugin against legacy `@lynx-js/react/refresh` external (without `createRefreshRuntime`)
    {
      const sb = createSharedContext();
      const legacyExternal: SharedRefreshModule = {
        flush: sb.refresh.flush,
        isComponent: sb.refresh.isComponent,
      } as SharedRefreshModule;

      const makeLegacyApp = (version: string) => `
import { useState } from 'preact/hooks';
export function App() {
  const [n] = useState(7);
  return <div>{${
        JSON.stringify(`new-plugin-legacy-runtime-${version}:`)
      }}{n}</div>;
}
`;
      const bundle = await startHmrBundle({
        sandboxRuntime: sb,
        entry: './entry.jsx',
        refreshMode: { legacyExternal },
        files: {
          'app.jsx': makeLegacyApp('v1'),
          'entry.jsx': makeCounterEntryCode(),
        },
      });
      try {
        const container = sb.createContainer();
        (bundle.exports['mount'] as (c: FakeElement) => void)(container);
        await flushPreact();
        expect(container.textContent).toBe('new-plugin-legacy-runtime-v1:7');

        await bundle.writeFile('app.jsx', makeLegacyApp('v2'));
        await (bundle.exports['checkHmr'] as () => Promise<unknown>)();
        await flushPreact();
        expect(container.textContent).toBe('new-plugin-legacy-runtime-v2:7');
      } finally {
        await bundle.close();
      }
    }

    // 3. Shared context: ambient `globalThis.__PREFRESH__` overwritten before and after new-plugin template
    {
      const sb = createSharedContext();
      const legacySpyBefore = {
        register: rstest.fn(),
        sign: rstest.fn(() => 'needsHooks'),
        getPendingUpdates: rstest.fn(() => []),
        flush: rstest.fn(),
        replaceComponent: rstest.fn(),
        getSignature: rstest.fn(),
        computeKey: rstest.fn(),
      };
      sb.sandbox['__PREFRESH__'] = legacySpyBefore;

      const makeNewApp = (version: string) => `
import { useState } from 'preact/hooks';
export function App() {
  const [n, setN] = useState(3);
  globalThis.__INC_MIXED_NEW__ = () => setN(v => v + 1);
  return <div>{${JSON.stringify(`new-${version}:`)}}{n}</div>;
}
`;

      const newBundle = await startHmrBundle({
        sandboxRuntime: sb,
        entry: './entry.jsx',
        refreshMode: 'shared-external',
        files: {
          'app.jsx': makeNewApp('v1'),
          'entry.jsx': makeCounterEntryCode(),
        },
      });

      try {
        const container = sb.createContainer();
        (newBundle.exports['mount'] as (c: FakeElement) => void)(container);
        await flushPreact();
        (sb.sandbox['__INC_MIXED_NEW__'] as () => void)();
        await flushPreact();
        expect(container.textContent).toBe('new-v1:4');

        // Another legacy template loads AFTER and overwrites `globalThis.__PREFRESH__`
        const legacySpyAfter = {
          register: rstest.fn(),
          sign: rstest.fn(() => 'needsHooks'),
          getPendingUpdates: rstest.fn(() => []),
          flush: rstest.fn(),
          replaceComponent: rstest.fn(),
          getSignature: rstest.fn(),
          computeKey: rstest.fn(),
        };
        sb.sandbox['__PREFRESH__'] = legacySpyAfter;

        await newBundle.writeFile('app.jsx', makeNewApp('v2'));
        await (newBundle.exports['checkHmr'] as () => Promise<unknown>)();
        await flushPreact();

        expect(container.textContent).toBe('new-v2:4');
        expect(legacySpyBefore.register).not.toHaveBeenCalled();
        expect(legacySpyAfter.register).not.toHaveBeenCalled();
      } finally {
        await newBundle.close();
      }
    }
  });
});
