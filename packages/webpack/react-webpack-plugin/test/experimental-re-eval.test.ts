// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import type { Configuration, Stats } from '@rspack/core';
import { describe, expect, test } from '@rstest/core';

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin';

// `create-react-config.js` is plain JS without a generated d.ts.
// @ts-expect-error untyped JS helper
import { createConfig as createConfigUntyped } from './create-react-config.js';
import { RuntimeWrapperWebpackPlugin } from '../../runtime-wrapper-webpack-plugin/src/index.js';
import { ReactWebpackPlugin } from '../src/ReactWebpackPlugin.js';

const createConfig = createConfigUntyped as (
  loaderOptions: Record<string, unknown>,
  pluginOptions: Record<string, unknown>,
) => Configuration;

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, 'fixtures/lazy-bundle-fetcher/index.jsx');
const RE_EVAL_APP = join(__dirname, 'fixtures/re-eval/index.jsx');
const RELOADER = `lynx[Symbol.for('__LYNX_MAIN_THREAD_ENTRY_RELOADER__')]`;
const ENTRY_SUPPORT =
  `lynx[Symbol.for('__LYNX_ENTRY_SUPPORTS_RE_EVAL__')] = true;`;

async function buildMainThread(
  experimental_isLazyBundle: boolean,
  experimental_reEvalJSOnReload = true,
  fixture = FIXTURE,
) {
  const dist = await mkdtemp(join(tmpdir(), 'rwp-re-eval-'));
  const pluginOptions = {
    experimental_isLazyBundle,
    experimental_reEvalJSOnReload,
    mainThreadChunks: ['main__main-thread.js'],
  };
  const config = createConfig({}, pluginOptions);
  // Exercise the source plugin under test, rather than its prebuilt package export.
  config.plugins![0] = new ReactWebpackPlugin(pluginOptions);
  config.entry = {
    'main__main-thread': { import: fixture, layer: 'react:main-thread' },
    'main__background': { import: fixture, layer: 'react:background' },
  };
  config.context = dirname(fixture);
  config.output = { ...config.output, filename: '[name].js', path: dist };
  config.mode = 'development';
  config.devtool = false;
  config.plugins = [
    ...(config.plugins ?? []),
    new RuntimeWrapperWebpackPlugin({
      experimental_isLazyBundle,
      experimental_reEvalJSOnReload,
      test: /background\.js$/,
    }),
    new LynxEncodePlugin(),
    new LynxTemplatePlugin({
      ...LynxTemplatePlugin.defaultOptions,
      chunks: ['main__main-thread', 'main__background'],
      filename: 'main/template.js',
      intermediate: '.rspeedy/main',
      experimental_isLazyBundle,
    }),
  ];

  const compiler = rspack(config);
  let stats: Stats;
  try {
    stats = await new Promise((resolve, reject) => {
      compiler.run((err, result) => {
        if (err) return reject(err);
        if (!result) return reject(new Error('rspack returned empty stats'));
        resolve(result);
      });
    });
  } finally {
    await new Promise<void>(resolve => compiler.close(() => resolve()));
  }
  if (stats.hasErrors()) {
    throw new Error(stats.toString({ all: false, errors: true }));
  }

  return {
    mainThread: await readFile(join(dist, 'main__main-thread.js'), 'utf8'),
    background: await readFile(join(dist, 'main__background.js'), 'utf8'),
  };
}

describe('ReactWebpackPlugin: experimental re-evaluation', () => {
  test('does not mark entries when re-evaluation is disabled', async () => {
    const { mainThread, background } = await buildMainThread(false, false);
    expect(mainThread).not.toContain(ENTRY_SUPPORT);
    expect(background).not.toContain(ENTRY_SUPPORT);
    expect(mainThread).not.toContain(RELOADER);
    expect(mainThread).not.toContain('__LYNX_MAIN_THREAD_RELOAD_COMPLETER__');
  });

  test('installs the entry reloader for a regular bundle', async () => {
    const { mainThread, background } = await buildMainThread(false);
    expect(mainThread).toContain(`${RELOADER} = () => {`);
    expect(mainThread).toContain(ENTRY_SUPPORT);
    expect(mainThread.indexOf(ENTRY_SUPPORT)).toBeGreaterThan(
      mainThread.indexOf(RELOADER),
    );
    expect(background).toContain(ENTRY_SUPPORT);
    expect(background.indexOf(ENTRY_SUPPORT)).toBeLessThan(
      background.indexOf('var Promise = lynx.Promise;'),
    );
  });

  test('does not install the entry reloader for a lazy bundle', async () => {
    const { mainThread, background } = await buildMainThread(true);
    expect(mainThread).not.toContain(RELOADER);
    expect(mainThread).not.toContain(ENTRY_SUPPORT);
    expect(background).not.toContain(ENTRY_SUPPORT);
  });
});

interface FakeElement {
  id: number;
  tag: string;
  children: FakeElement[];
  parent?: FakeElement | undefined;
  attrs: Record<string, unknown>;
  componentAtIndex?: (...args: unknown[]) => number;
  enqueueComponent?: (...args: unknown[]) => void;
}

/** Runs a main-thread bundle against a recording Element PAPI. */
function runMainThread(source: string) {
  let nextId = 1;
  const papiCalls: string[] = [];
  const lifecycleEvents: string[] = [];
  const listeners = new Set<string>();
  const eventTarget = () => ({
    addEventListener: (type: string, fn: unknown) =>
      listeners.add(`${type}:${String(fn)}#${listeners.size}`),
    removeEventListener: (type: string) => {
      const key = [...listeners].find(k => k.startsWith(`${type}:`));
      if (key) listeners.delete(key);
    },
    dispatchEvent: () => undefined,
  });
  const jsContext = eventTarget();
  const native = eventTarget();
  let page: FakeElement | undefined;

  const create = (tag: string): FakeElement => ({
    id: nextId++,
    tag,
    children: [],
    attrs: {},
  });
  const detach = (child: FakeElement) => {
    if (child.parent) {
      child.parent.children.splice(child.parent.children.indexOf(child), 1);
    }
    child.parent = undefined;
  };
  // biome-ignore lint/suspicious/noExplicitAny: fakes of native APIs with loosely typed arguments
  const papi: Record<string, (...args: any[]) => unknown> = {
    __CreatePage: () => (page = create('page')),
    __CreateElement: (tag: string) => create(tag),
    __CreateView: () => create('view'),
    __CreateText: () => create('text'),
    __CreateImage: () => create('image'),
    __CreateScrollView: () => create('scroll-view'),
    __CreateWrapperElement: () => create('wrapper'),
    __CreateRawText: (text: string) =>
      Object.assign(create('raw-text'), { attrs: { text } }),
    __CreateList: (
      _: unknown,
      componentAtIndex: FakeElement['componentAtIndex'],
      enqueueComponent: FakeElement['enqueueComponent'],
    ) => Object.assign(create('list'), { componentAtIndex, enqueueComponent }),
    __UpdateListCallbacks: (
      list: FakeElement,
      componentAtIndex?: FakeElement['componentAtIndex'],
      enqueueComponent?: FakeElement['enqueueComponent'],
    ) => {
      if (componentAtIndex) list.componentAtIndex = componentAtIndex;
      if (enqueueComponent) list.enqueueComponent = enqueueComponent;
    },
    __AppendElement: (parent: FakeElement, child: FakeElement) => {
      detach(child);
      parent.children.push(child);
      child.parent = parent;
    },
    __InsertElementBefore: (
      parent: FakeElement,
      child: FakeElement,
      ref?: FakeElement,
    ) => {
      detach(child);
      const index = ref ? parent.children.indexOf(ref) : -1;
      parent.children.splice(
        index < 0 ? parent.children.length : index,
        0,
        child,
      );
      child.parent = parent;
    },
    __RemoveElement: (_: FakeElement, child: FakeElement) => detach(child),
    __GetElementUniqueID: (element: FakeElement) => element.id,
    __GetTag: (element: FakeElement) => element.tag,
    __GetPageElement: () => page,
    __SetAttribute: (element: FakeElement, key: string, value: unknown) => {
      element.attrs[key] = value;
    },
    __GetAttributeByName: (element: FakeElement, key: string) =>
      element.attrs[key],
    __OnLifecycleEvent: ([type]: [string]) => lifecycleEvents.push(type),
  };

  const host: Record<string, unknown> = {
    console,
    lynx: {
      getJSContext: () => jsContext,
      getNative: () => native,
      performance: {
        profileStart: () => undefined,
        profileEnd: () => undefined,
        profileMark: () => undefined,
      },
      reportError: (error: unknown) => {
        throw error;
      },
    },
    SystemInfo: { lynxSdkVersion: '3.2' },
  };
  // Any other Element PAPI the bundle calls only needs to exist.
  for (const [, name] of source.matchAll(/\b(__[A-Z]\w+)\(/g)) {
    papi[name!] ??= () => undefined;
  }
  for (const [name, fn] of Object.entries(papi)) {
    host[name] = (...args: unknown[]) => {
      papiCalls.push(name);
      return fn(...args);
    };
  }

  runInNewContext(source, host, { filename: 'main__main-thread.js' });
  const call = (name: string, ...args: unknown[]) =>
    (host[name] as (...args: unknown[]) => unknown)(...args);

  const elements = (
    root = page!,
  ): FakeElement[] => [
    root,
    ...root.children.flatMap(child => elements(child)),
  ];
  return {
    papiCalls,
    lifecycleEvents,
    listeners,
    renderPage: () => call('renderPage', {}),
    reload: (data = {}) => call('updatePage', data, { reloadTemplate: true }),
    elementsOfSnapshot: (snapshotId: number) =>
      (call('getUniqueIdListBySnapshotId', { snapshotId }) as {
        uniqueIdList: number[];
      } | null)?.uniqueIdList,
    snapshotOf: (uniqueId: number) =>
      (call('getSnapshotIdByUniqueId', { uniqueId }) as
        | { snapshotId: number }
        | null)?.snapshotId,
    patch: (reloadVersion: number) =>
      call('rLynxChange', {
        data: JSON.stringify({ patchList: [] }),
        patchOptions: { reloadVersion },
      }),
    elements,
    texts: () => elements().map(e => e.attrs['text']).filter(Boolean),
    list: () => elements().find(e => e.tag === 'list'),
    listenerTypes: () => [...listeners].map(key => key.split(':')[0]).sort(),
  };
}

describe('ReactWebpackPlugin: re-evaluating the main-thread entry', () => {
  test('runs the entry again on the existing native tree', async () => {
    const { mainThread } = await buildMainThread(false, true, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();
    expect(page.texts()).toContain('evaluation 1, module 1');
    const elementsBefore = page.elements();

    page.papiCalls.length = 0;
    page.reload();

    // Module state starts over, but every native element is reused.
    expect(page.texts()).toContain('evaluation 2, module 1');
    expect(page.papiCalls.filter(name => name.startsWith('__Create'))).toEqual(
      [],
    );
    expect(page.elements()).toEqual(elementsBefore);
  });

  test('keeps listeners and first-screen state across repeated reloads', async () => {
    const { mainThread } = await buildMainThread(false, true, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();
    const listenersBefore = page.listenerTypes();
    expect(listenersBefore).toEqual([
      'Lynx.Worklet.releaseWorkletRef',
      'Lynx.Worklet.runWorkletCtx',
      '__DestroyLifetime',
    ]);

    for (let i = 0; i < 3; i++) page.reload();

    // Each entry must retire what it installed, or listeners pile up per reload.
    expect(page.listenerTypes()).toEqual(listenersBefore);
    // Without the first-screen state, a new entry would not hand its tree to the background.
    expect(page.lifecycleEvents.filter(type => type === 'rLynxFirstScreen'))
      .toHaveLength(4);
    expect(page.texts()).toContain('evaluation 4, module 1');
  });

  test('keeps native list callbacks working across reloads', async () => {
    const { mainThread } = await buildMainThread(false, true, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();
    const list = page.list()!;
    const first = list.componentAtIndex!(list, list.id, 0, 1, false);
    list.componentAtIndex!(list, list.id, 1, 2, false);
    list.enqueueComponent!(list, list.id, first);

    page.reload();

    // The native list survives the entry; its recycled item must still be reusable.
    expect(page.list()).toBe(list);
    expect(list.componentAtIndex!(list, list.id, 2, 3, false)).toBe(first);
  });

  test('drops patches the background sent before the reload', async () => {
    const { mainThread } = await buildMainThread(false, true, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();
    page.reload();

    page.papiCalls.length = 0;
    page.patch(0);
    expect(page.papiCalls).not.toContain('__FlushElementTree');
    page.patch(1);
    expect(page.papiCalls).toContain('__FlushElementTree');
  });

  test('renders the new entry with the reload data', async () => {
    const { mainThread } = await buildMainThread(false, true, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();

    page.reload({ hideList: true });

    // Evaluating the entry resets `__initData`; the merged reload data must survive it.
    expect(page.list()).toBeUndefined();
    expect(page.texts()).toContain('evaluation 2, module 1');
  });

  test('never lets a snapshot ID name another element after a reload', async () => {
    const { mainThread } = await buildMainThread(false, true, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();
    const list = page.list()!;
    for (let i = 0; i < 3; i++) {
      list.componentAtIndex!(list, list.id, i, i, false);
    }
    const before = new Map<number, number[]>();
    for (const element of page.elements()) {
      const id = page.snapshotOf(element.id);
      if (id !== undefined) before.set(id, page.elementsOfSnapshot(id)!);
    }
    expect(before.size).toBeGreaterThan(5);

    // The tree changes shape, so a new entry counting from scratch would hand
    // the old IDs to other elements.
    page.reload({ hideList: true });

    for (const [id, elements] of before) {
      const now = page.elementsOfSnapshot(id);
      if (now !== undefined) expect(now).toEqual(elements);
    }
  });

  test('reuses the previous entry when re-evaluation is disabled', async () => {
    const { mainThread } = await buildMainThread(false, false, RE_EVAL_APP);
    const page = runMainThread(mainThread);
    page.renderPage();
    page.reload();
    expect(page.texts()).toContain('evaluation 1, module 1');
  });
});
