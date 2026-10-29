// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { setImmediate } from 'node:timers/promises';
import { runInNewContext } from 'node:vm';

import { rspack } from '@rspack/core';
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  rstest,
} from '@rstest/core';

import { ExternalsLoadingPlugin } from '../src/index.js';

const external = (name: string, async: boolean, url = 'component.bundle') => ({
  libraryName: name,
  url,
  async,
  mainThread: { sectionPath: 'component' },
  background: { sectionPath: 'component' },
});

const cases = [false, true].flatMap(async =>
  ['main-thread', 'background'].map(layer => ({ async, layer }))
);

describe('external import order', () => {
  let directory: string;
  const sources = new Map<string, string>();

  beforeAll(async () => {
    directory = await fs.mkdtemp(
      path.join(os.tmpdir(), 'lynx-external-order-'),
    );
    for (const async of [false, true]) {
      const entry = Object.fromEntries(
        ['main-thread', 'background'].map(
          layer => [layer, { import: './index.js', layer }],
        ),
      );
      if (async) {
        for (const layer of ['main-thread', 'background']) {
          entry[`await-${layer}`] = { import: './async-index.js', layer };
        }
      }
      await new Promise<void>((resolve, reject) => {
        const compiler = rspack({
          mode: 'development',
          context: path.join(__dirname, 'fixtures', 'import-order'),
          entry,
          output: {
            path: directory,
            filename: `${async}-[name].js`,
            publicPath: '',
          },
          optimization: { concatenateModules: false },
          plugins: [
            new ExternalsLoadingPlugin({
              mainThreadLayer: 'main-thread',
              backgroundLayer: 'background',
              externals: {
                component: external('Component', async),
                'component-alias': external('Alias', async),
                unused: external('Unused', async, 'unused.bundle'),
                ...(async
                  ? { runtime: external('Runtime', true, 'runtime.bundle') }
                  : {}),
              },
            }),
          ],
        });
        compiler.run((error, stats) => {
          compiler.close(closeError => {
            if (error) reject(error);
            else if (closeError) reject(closeError);
            else if (stats?.hasErrors()) reject(new Error(stats.toString()));
            else resolve();
          });
        });
      });
      for (const layer of ['main-thread', 'background']) {
        const key = `${async}-${layer}`;
        sources.set(
          key,
          await fs.readFile(path.join(directory, `${key}.js`), 'utf8'),
        );
        if (async) {
          sources.set(
            `await-${layer}`,
            await fs.readFile(
              path.join(directory, `true-await-${layer}.js`),
              'utf8',
            ),
          );
        }
      }
    }
  });

  afterAll(async () => {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  it.each(cases)(
    'defers section evaluation until import ($layer, async: $async)',
    async ({ layer, async }) => {
      const state = { ready: false, events: [] as string[] };
      const component = { run: () => state.events.push('run') };
      const fetchBundle = rstest.fn((url: string) => ({
        wait: () => ({ code: 0, url }),
        then: (callback: (response: object) => void) =>
          callback({ code: 0, url }),
      }));
      const loadScript = rstest.fn(() => {
        expect(state.ready).toBe(true);
        state.events.push('load');
        return component;
      });
      const globals: Record<string, unknown> = {};
      runInNewContext(sources.get(`${async}-${layer}`)!, {
        __externalOrder: state,
        lynx: {
          fetchBundle,
          loadScript,
          [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: globals,
        },
        __LoadStyleSheet: () => null,
      });
      await setImmediate();
      expect(state.events).toEqual(['init', 'load', 'run', 'run']);
      expect(fetchBundle).toHaveBeenCalledTimes(async ? 3 : 2);
      expect(loadScript).toHaveBeenCalledTimes(1);
      const cached = globals['Component'];
      expect(globals['Component']).toBe(cached);
      expect(globals['Alias']).toBe(cached);
      expect(async ? await cached : cached).toBe(component);
      expect(loadScript).toHaveBeenCalledTimes(1);
      expect(Object.getOwnPropertyDescriptor(globals, 'Component')?.writable)
        .toBe(true);
    },
  );

  it.each(cases)(
    'preserves host exports and entry-time injection ($layer, async: $async)',
    async ({ layer, async }) => {
      for (const inject of [false, true]) {
        const state = {
          ready: false,
          events: [] as string[],
          inject: undefined as object | undefined,
        };
        const component = { run: () => state.events.push('injected') };
        if (inject) state.inject = component;
        const loadScript = rstest.fn();
        const globals: Record<string, unknown> = inject
          ? {}
          : { Component: component };
        runInNewContext(sources.get(`${async}-${layer}`)!, {
          __externalOrder: state,
          lynx: {
            fetchBundle: (url: string) => ({ wait: () => ({ code: 0, url }) }),
            loadScript,
            [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: globals,
          },
          __LoadStyleSheet: () => null,
        });
        await setImmediate();
        expect(loadScript).not.toHaveBeenCalled();
        expect(state.events).toEqual(['init', 'injected', 'injected']);
        expect(globals['Component']).toBe(component);
        expect(globals['Alias']).toBe(component);
      }
    },
  );

  it.each(['main-thread', 'background'])(
    'respects a dynamic import after an asynchronous initializer on %s',
    async (layer) => {
      const state = { ready: false, events: [] as string[] };
      const loadScript = rstest.fn(
        (_section: string, { bundleName }: { bundleName: string }) => {
          if (bundleName === 'runtime.bundle') {
            state.events.push('runtime');
            return {};
          }
          expect(state.ready).toBe(true);
          state.events.push('component');
          return { run: () => state.events.push('run') };
        },
      );
      runInNewContext(sources.get(`await-${layer}`)!, {
        __externalOrder: state,
        lynx: {
          fetchBundle: (url: string) => Promise.resolve({ code: 0, url }),
          loadScript,
        },
        __LoadStyleSheet: () => null,
      });
      await setImmediate();
      expect(state.events).toEqual(['runtime', 'init', 'component', 'run']);
      expect(loadScript).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['main-thread', 'background'])(
    'caches a pending Promise and shared-section aliases on %s',
    async (layer) => {
      let resolveFetch!: (response: object) => void;
      const response = new Promise<object>(resolve => {
        resolveFetch = resolve;
      });
      const component = { run: rstest.fn() };
      const loadScript = rstest.fn(() => component);
      const globals: Record<string, unknown> = {};
      runInNewContext(sources.get(`true-${layer}`)!, {
        __externalOrder: { events: [] },
        lynx: {
          fetchBundle: () => response,
          loadScript,
          [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: globals,
        },
        __LoadStyleSheet: () => null,
      });
      const pending = globals['Component'];
      expect(globals['Component']).toBe(pending);
      expect(globals['Alias']).toBe(pending);
      expect(Object.getOwnPropertyDescriptor(globals, 'Component'))
        .toMatchObject({ value: pending, writable: true });
      expect(loadScript).not.toHaveBeenCalled();
      resolveFetch({ code: 0, url: 'component.bundle' });
      expect(await pending).toBe(component);
      await setImmediate();
      expect(globals['Component']).toBe(pending);
      expect(loadScript).toHaveBeenCalledTimes(1);
      expect(component.run).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['main-thread', 'background'])(
    'caches a rejected loading Promise on %s',
    async (layer) => {
      const loadScript = rstest.fn((_section, { bundleName }) => {
        if (bundleName === 'unused.bundle') {
          throw new Error('section evaluation failed');
        }
        return { run: rstest.fn() };
      });
      const globals: Record<string, unknown> = {};
      runInNewContext(sources.get(`true-${layer}`)!, {
        __externalOrder: { events: [] },
        console: { error: rstest.fn() },
        lynx: {
          fetchBundle: (url: string) => Promise.resolve({ code: 0, url }),
          loadScript,
          [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: globals,
        },
        __LoadStyleSheet: () => null,
      });
      await setImmediate();
      expect(loadScript).toHaveBeenCalledTimes(1);
      const rejected = globals['Unused'];
      expect(globals['Unused']).toBe(rejected);
      await expect(rejected).rejects.toThrow('Failed to load script');
      expect(globals['Unused']).toBe(rejected);
      expect(loadScript).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['main-thread', 'background'])(
    'does not cache a synchronous throw on %s',
    (layer) => {
      const error = new Error('section evaluation failed');
      const component = { run: rstest.fn() };
      const loadScript = rstest.fn().mockImplementationOnce(() => {
        throw error;
      }).mockReturnValue(component);
      const globals: Record<string, unknown> = {};
      expect(() => {
        runInNewContext(sources.get(`false-${layer}`)!, {
          __externalOrder: { events: [] },
          console: { error: rstest.fn() },
          lynx: {
            fetchBundle: (url: string) => ({ wait: () => ({ code: 0, url }) }),
            loadScript,
            [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: globals,
          },
          __LoadStyleSheet: () => null,
        });
      }).toThrow('Failed to load script');
      expect(typeof Object.getOwnPropertyDescriptor(globals, 'Component')?.get)
        .toBe('function');
      expect(globals['Component']).toBe(component);
      expect(globals['Component']).toBe(component);
      expect(globals['Alias']).toBe(component);
      expect(loadScript).toHaveBeenCalledTimes(2);
    },
  );
});
