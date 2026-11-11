// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The VM executes real emitted factories and exposes the webpack runtime.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */

import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from '@rstest/core';

import {
  createHMRCompiler,
  createMainThreadRuntime,
} from './helpers/main-thread-hmr.js';

it('executes a stable root definition module through empty, added, removed and readded worklets before ACK', async () => {
  const tempRoot = path.resolve(__dirname, '../../../../.tmp/main-thread-hmr');
  await fs.mkdir(tempRoot, { recursive: true });
  const context = await fs.mkdtemp(path.join(tempRoot, 'definitions-'));
  const owner = path.join(context, 'owner.js');
  const sources = [
    'export const ready = true;',
    `export const task = () => { 'main thread'; return 42; };`,
    'export const ready = true;',
    `export const task = () => { 'main thread'; return 84; };`,
  ];
  await fs.writeFile(
    path.join(context, 'index.js'),
    `if (__BACKGROUND__) require('./owner.js');
globalThis.entryRuns = (globalThis.entryRuns || 0) + 1;`,
  );
  await fs.writeFile(owner, sources[0]!);

  const compiler = createHMRCompiler(context);
  let runtime: ReturnType<typeof createMainThreadRuntime>;
  let build = 0;
  let initialModules: string[];
  try {
    await new Promise<void>((resolve, reject) => {
      const watcher = compiler.watch(
        { aggregateTimeout: 100 },
        (error, stats) => {
          void (async () => {
            try {
              if (error) throw error;
              if (stats!.hasErrors()) {
                throw new Error(stats!.toString({ all: false, errors: true }));
              }
              const compilation = stats!.compilation;
              const step = build++;
              if (step === 0) {
                runtime = createMainThreadRuntime(stats!);
                initialModules = Object.keys(runtime.context['testRequire'].c)
                  .filter(id => id.includes('__lynx-react-defines'));
                expect(runtime.registrations.size).toBe(0);
              } else {
                const ack = await runtime.apply(compilation);
                expect(ack.error).toBeUndefined();
                expect(ack).toMatchObject({
                  sequence: step,
                  hash: stats!.hash,
                  ok: true,
                });
                expect([...runtime.registrations.values()].map(fn => fn()))
                  .toEqual(step === 3 ? [42, 84] : [42]);
                expect(runtime.events).toEqual([
                  'register',
                  'ack',
                  ...(step >= 2 ? ['ack'] : []),
                  ...(step === 3 ? ['register', 'ack'] : []),
                ]);
                const cachedModules = Object.keys(
                  runtime.context['testRequire'].c,
                ).filter(
                  id => id.includes('__lynx-react-defines'),
                );
                expect(cachedModules).toHaveLength(1);
                expect(cachedModules).toEqual(initialModules);
                if (step === 2) {
                  expect(
                    runtime.context['testRequire'].m[cachedModules[0]!]
                      .toString(),
                  )
                    .not.toContain('registerWorklet');
                }
              }
              expect(runtime.context['entryRuns']).toBe(1);
              if (build < sources.length) {
                await fs.writeFile(owner, sources[build]!);
              } else {
                watcher.close(resolve);
              }
            } catch (error) {
              watcher.close(() => reject(error as Error));
            }
          })();
        },
      );
    });
  } finally {
    await new Promise<void>((resolve, reject) =>
      compiler.close(error => error ? reject(error) : resolve())
    );
    await fs.rm(context, { recursive: true, force: true });
  }
});
