// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Worklet implementations are read from executed Rspack VM factories.

import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from '@rstest/core';

import {
  createHMRCompiler,
  createMainThreadRuntime,
} from './helpers/main-thread-hmr.js';

const worklet = (value: number) =>
  `export const task = () => { 'main thread'; return ${value}; };`;

it.each([
  { changed: 'body', moduleIds: 'named' as const },
  { changed: 'helper', moduleIds: 'named' as const },
  { changed: 'helper', moduleIds: 'deterministic' as const },
  { changed: 'css-helper', moduleIds: 'named' as const },
  { changed: 'shared-helper', moduleIds: 'named' as const },
  { changed: 'background-only', moduleIds: 'named' as const },
])(
  'updates a loaded async $changed ($moduleIds IDs) before acknowledging the new version',
  async ({ changed, moduleIds }) => {
    const tempRoot = path.resolve(
      __dirname,
      '../../../../.tmp/main-thread-hmr',
    );
    await fs.mkdir(tempRoot, { recursive: true });
    const context = await fs.mkdtemp(path.join(tempRoot, 'async-'));
    const synthetic = changed === 'background-only';
    const versions = synthetic
      ? [
        'export const ready = true;',
        worklet(42),
        'export const ready = true;',
        worklet(84),
      ]
      : (changed === 'body'
        ? [worklet(1), worklet(42)]
        : ['export const value = 1;', 'export const value = 42;']);
    const target = path.join(
      context,
      synthetic ? 'owner.js' : (changed === 'body' ? 'route.js' : 'helper.js'),
    );
    await fs.writeFile(
      path.join(context, 'index.js'),
      `export const load = () => import('./route.js');`,
    );
    if (changed === 'css-helper') {
      await fs.writeFile(
        path.join(context, 'style.css'),
        '.task { width: 10px; }',
      );
    }
    if (changed !== 'body') {
      await fs.writeFile(
        path.join(context, 'route.js'),
        synthetic
          ? `if (__BACKGROUND__) require('./owner.js'); export const ready = true;`
          : `${
            changed === 'css-helper' ? 'import \'./style.css\';' : ''
          }import { value } from './helper.js' with { runtime: 'shared' }; export const task = () => { 'main thread'; return value; };`,
      );
    }
    await fs.writeFile(target, versions[0]!);
    const compiler = createHMRCompiler(
      context,
      {},
      ['./index.js'],
      moduleIds,
      changed === 'shared-helper'
        ? {
          cacheGroups: {
            shared: {
              test: module =>
                module.layer === 'react:main-thread'
                && (module.nameForCondition() ?? '').endsWith('helper.js'),
              name: 'shared',
              chunks: 'all',
              enforce: true,
            },
          },
        }
        : false,
    );
    let runtime: ReturnType<typeof createMainThreadRuntime>;
    let build = 0;
    let initialDefinitions: string[];
    try {
      await new Promise<void>((resolve, reject) => {
        const watcher = compiler.watch(
          { aggregateTimeout: 100 },
          (error, stats) => {
            void (async () => {
              if (error) throw error;
              if (stats!.hasErrors()) {
                throw new Error(stats!.toString({ all: false, errors: true }));
              }
              const compilation = stats!.compilation;
              const step = build++;
              if (step === 0) {
                runtime = createMainThreadRuntime(stats!);
                runtime.loadAsyncModule(
                  compilation,
                  path.join(context, 'route.js'),
                );
                initialDefinitions = Object.keys(
                  (runtime.context['testRequire'] as {
                    c: Record<string, unknown>;
                  }).c,
                )
                  .filter(id => id.includes('route.js.__lynx-react-defines'));
                expect([...runtime.registrations.values()].map(fn => fn()))
                  .toEqual(synthetic ? [] : [1]);
              } else {
                const ack = await runtime.apply(compilation);
                expect(ack.error).toBeUndefined();
                expect(ack).toMatchObject({ ok: true, hash: stats!.hash });
                expect([...runtime.registrations.values()].at(-1)!()).toBe(
                  step === 3 ? 84 : 42,
                );
                expect(runtime.events.at(-1)).toBe('ack');
                if (synthetic) {
                  expect(initialDefinitions).toHaveLength(1);
                  expect(
                    Object.keys(
                      (runtime.context['testRequire'] as {
                        c: Record<string, unknown>;
                      }).c,
                    )
                      .filter(id =>
                        id.includes('route.js.__lynx-react-defines')
                      ),
                  )
                    .toEqual(initialDefinitions);
                }
                // MTS-only helpers must also notify the already loaded BTS owner.
                if (
                  changed === 'helper' || changed === 'shared-helper'
                  || changed === 'css-helper'
                ) {
                  const owner = [...compilation.modules].find(module =>
                    module.layer === 'react:background'
                    && (module as { resource?: string }).resource
                      === path.join(context, 'route.js')
                  )!;
                  const metadata = [...compilation.getAssets()].find(asset =>
                    asset.name.startsWith('main__background.')
                    && asset.name.endsWith('.hot-update.js')
                  )!.source.source().toString();
                  expect(metadata).toContain(
                    `exports.lynxRefreshModules=${
                      JSON.stringify([
                        compilation.chunkGraph.getModuleId(owner),
                      ])
                    }`,
                  );
                }
              }
              if (build < versions.length) {
                await fs.writeFile(target, versions[build]!);
              } else watcher.close(resolve);
            })().catch(error => watcher.close(() => reject(error as Error)));
          },
        );
      });
    } finally {
      await new Promise<void>((resolve, reject) =>
        compiler.close(error => error ? reject(error) : resolve())
      );
      await fs.rm(context, { recursive: true, force: true });
    }
  },
);
