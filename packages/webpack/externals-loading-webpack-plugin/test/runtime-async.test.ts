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

const predicate = ({ systemInfo }: { systemInfo: Record<string, unknown> }) =>
  systemInfo['platform'] === 'Harmony' || systemInfo['platform'] === 'web';

const external = (libraryName: string | string[]) => ({
  libraryName,
  url: 'component.bundle',
  async: predicate,
  mainThread: { sectionPath: 'component' },
  background: { sectionPath: 'component' },
});

const cases = ['main-thread', 'background'].flatMap(layer =>
  ['global', 'lynx', 'web', 'sync', 'missing'].map(info => ({ layer, info }))
);

describe('runtime async selection', () => {
  let directory: string;
  const sources = new Map<string, string>();

  beforeAll(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lynx-runtime-async-'));
    await new Promise<void>((resolve, reject) => {
      const compiler = rspack({
        mode: 'development',
        context: path.join(__dirname, 'fixtures', 'import-order'),
        entry: Object.fromEntries(
          ['main-thread', 'background'].map(
            layer => [layer, { import: './runtime-index.js', layer }],
          ),
        ),
        output: { path: directory, filename: '[name].js', publicPath: '' },
        optimization: { concatenateModules: false },
        plugins: [
          new ExternalsLoadingPlugin({
            mainThreadLayer: 'main-thread',
            backgroundLayer: 'background',
            externals: {
              component: external('Component'),
              'component-alias': external('Alias'),
              'component/subpath': external(['Component', 'Nested']),
              unused: { ...external('Unused'), url: 'unused.bundle' },
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
      sources.set(
        layer,
        await fs.readFile(path.join(directory, `${layer}.js`), 'utf8'),
      );
    }
  });

  afterAll(async () => {
    if (directory) await fs.rm(directory, { recursive: true, force: true });
  });

  it.each(cases)(
    'selects loading at first import ($layer, systemInfo: $info)',
    async ({ layer, info }) => {
      const isAsync = info === 'global' || info === 'lynx' || info === 'web';
      const state = { ready: false, events: [] as string[] };
      const component = { run: () => state.events.push('run') };
      const wait = rstest.fn(() => {
        if (isAsync) throw new Error('Harmony must never wait');
        return { code: 0, url: 'component.bundle' };
      });
      const then = rstest.fn((callback: (response: object) => void) => {
        if (!isAsync) {
          throw new Error('Synchronous platforms must not use then');
        }
        queueMicrotask(() => callback({ code: 0, url: 'component.bundle' }));
      });
      const loadScript = rstest.fn(() => {
        expect(state.ready).toBe(true);
        state.events.push('load');
        return { ...component, Nested: component };
      });
      runInNewContext(sources.get(layer)!, {
        __externalOrder: state,
        ...(info === 'global' || info === 'sync' || info === 'web'
          ? {
            SystemInfo: {
              platform: info === 'web'
                ? 'web'
                : (info === 'global'
                  ? 'Harmony'
                  : 'iOS'),
            },
          }
          : {}),
        lynx: {
          ...(info === 'global' || info === 'lynx'
            ? { SystemInfo: { platform: info === 'lynx' ? 'Harmony' : 'iOS' } }
            : {}),
          fetchBundle: () =>
            info === 'web'
              ? Promise.resolve({ code: 0, url: 'component.bundle' })
              : { wait, then },
          loadScript,
        },
        __LoadStyleSheet: () => null,
      });
      await setImmediate();
      expect(state.events).toEqual(['init', 'load', 'run', 'run', 'run']);
      expect(loadScript).toHaveBeenCalledTimes(1);
      expect(wait).toHaveBeenCalledTimes(isAsync ? 0 : 1);
      expect(then).toHaveBeenCalledTimes(isAsync && info !== 'web' ? 1 : 0);
    },
  );

  it.each(['main-thread', 'background'])(
    'caches synchronous failures as rejected promises on %s',
    async layer => {
      const component = { run: rstest.fn() };
      const loadScript = rstest.fn((_section, { bundleName }) => {
        if (bundleName === 'unused.bundle') throw new Error('section failed');
        return { ...component, Nested: component };
      });
      const wait = rstest.fn((url: string) => ({ code: 0, url }));
      const globals: Record<string, unknown> = {};
      runInNewContext(sources.get(layer)!, {
        __externalOrder: { events: [] },
        SystemInfo: { platform: 'iOS' },
        console: { error: rstest.fn() },
        lynx: {
          fetchBundle: (url: string) => ({ wait: () => wait(url) }),
          loadScript,
          [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: globals,
        },
        __LoadStyleSheet: () => null,
      });
      await setImmediate();
      expect(loadScript).toHaveBeenCalledTimes(1);
      const rejected = globals['Unused'];
      // The executor runs immediately, preserving synchronous fetch timing.
      expect(loadScript).toHaveBeenCalledTimes(2);
      expect(globals['Unused']).toBe(rejected);
      await expect(rejected).rejects.toThrow('Failed to load script');
      expect(globals['Unused']).toBe(rejected);
      expect(loadScript).toHaveBeenCalledTimes(2);
      expect(wait).toHaveBeenCalledTimes(2);
    },
  );
});
