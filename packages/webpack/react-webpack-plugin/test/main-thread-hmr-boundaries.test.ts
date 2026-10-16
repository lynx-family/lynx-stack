// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// App exports are read from an executed Rspack VM bundle.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import fs from 'node:fs/promises';
import path from 'node:path';

import { expect, it } from '@rstest/core';

import {
  createHMRCompiler,
  createMainThreadRuntime,
} from './helpers/main-thread-hmr.js';

const app = (offset: number) => `
  import { useLabel } from './hook.js';
  import { task } from './owner.js';
  export function App() { return [useLabel() + ${offset}, task]; }
`;
const owner = (value: number) =>
  `export const task = () => { 'main thread'; return ${value}; };`;
const entryWithPolicy = (
  policy: string,
  broken: boolean,
  hasWorklet: boolean,
) => `
  ${hasWorklet ? owner(1) : ''}
  if (module.hot) module.hot.${
  policy === 'handler'
    ? 'accept(() => { globalThis.handled = (globalThis.handled || 0) + 1; })'
    : 'decline()'
};
  if (${broken}) throw new Error('entry update failure');
`;

it.each(['wrapper', 'hook'])(
  'accepts %s changes through the actual app entry and still replays worklet owners',
  async changed => {
    const tempRoot = path.resolve(
      __dirname,
      '../../../../.tmp/main-thread-hmr',
    );
    await fs.mkdir(tempRoot, { recursive: true });
    const context = await fs.mkdtemp(path.join(tempRoot, 'boundaries-'));
    const files = {
      'index.js':
        `import { App } from './app.js'; globalThis.read = App; globalThis.entryRuns = (globalThis.entryRuns || 0) + 1;`,
      'other.js':
        `import { useLabel } from './hook.js'; globalThis.otherRead = useLabel; globalThis.otherRuns = (globalThis.otherRuns || 0) + 1;`,
      'app.js': app(1),
      'hook.js': 'export function useLabel() { return 1; }',
      'owner.js':
        `import { useLabel } from './hook.js' with { runtime: 'shared' }; export const task = () => { 'main thread'; return useLabel(); };`,
    };
    await Promise.all(
      Object.entries(files).map(([name, content]) =>
        fs.writeFile(path.join(context, name), content)
      ),
    );
    const compiler = createHMRCompiler(context, {}, [
      './index.js',
      './other.js',
    ]);
    let runtime: ReturnType<typeof createMainThreadRuntime>;
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
              if (runtime) {
                const ack = await runtime.apply(stats!.compilation);
                expect(ack.error).toBeUndefined();
                expect(ack).toMatchObject({ ok: true, hash: stats!.hash });
                expect(runtime.context['read']()[0]).toBe(3);
                expect(runtime.context['otherRead']()).toBe(
                  changed === 'wrapper' ? 1 : 2,
                );
                expect(runtime.context['entryRuns']).toBe(2);
                expect(runtime.context['otherRuns']).toBe(
                  changed === 'wrapper' ? 1 : 2,
                );
                // Accepting helpers themselves would leave the registered closure stale.
                expect([...runtime.registrations.values()][0]!()).toBe(
                  changed === 'wrapper' ? 1 : 2,
                );
                watcher.close(resolve);
              } else {
                runtime = createMainThreadRuntime(stats!);
                expect(runtime.context['read']()[0]).toBe(2);
                expect([...runtime.registrations.values()][0]!()).toBe(1);
                await fs.writeFile(
                  path.join(
                    context,
                    changed === 'wrapper' ? 'app.js' : 'hook.js',
                  ),
                  changed === 'wrapper'
                    ? app(2)
                    : 'export function useLabel() { return 2; }',
                );
              }
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

it.each([
  { policy: 'decline', hasWorklet: false },
  { policy: 'handler', hasWorklet: false },
  { policy: 'decline', hasWorklet: true },
  { policy: 'handler', hasWorklet: true },
])(
  'rejects an entry update with an explicit $policy (worklet=$hasWorklet) instead of acknowledging a failed transaction',
  async ({ policy, hasWorklet }) => {
    const tempRoot = path.resolve(
      __dirname,
      '../../../../.tmp/main-thread-hmr',
    );
    await fs.mkdir(tempRoot, { recursive: true });
    const context = await fs.mkdtemp(path.join(tempRoot, 'entry-policy-'));
    await fs.writeFile(
      path.join(context, 'index.js'),
      entryWithPolicy(policy, false, hasWorklet),
    );
    const compiler = createHMRCompiler(context);
    let runtime: ReturnType<typeof createMainThreadRuntime>;
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
              if (runtime) {
                const ack = await runtime.apply(stats!.compilation);
                expect(ack.ok).toBe(false);
                expect(ack.error).toContain(
                  policy === 'handler'
                    ? 'entry update failure'
                    : 'self decline',
                );
                expect(runtime.context['handled']).toBe(
                  policy === 'handler' ? 1 : undefined,
                );
                watcher.close(resolve);
              } else {
                runtime = createMainThreadRuntime(stats!);
                await fs.writeFile(
                  path.join(context, 'index.js'),
                  entryWithPolicy(policy, true, hasWorklet),
                );
              }
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

it.each([false, true])(
  'keeps worklet owner HMR with ET=%s without widening ET root acceptance',
  async elementTemplate => {
    const tempRoot = path.resolve(
      __dirname,
      '../../../../.tmp/main-thread-hmr',
    );
    await fs.mkdir(tempRoot, { recursive: true });
    const context = await fs.mkdtemp(path.join(tempRoot, 'backend-boundary-'));
    await fs.writeFile(
      path.join(context, 'index.js'),
      `import './owner.js'; globalThis.entryRuns = (globalThis.entryRuns || 0) + 1;`,
    );
    await fs.writeFile(path.join(context, 'owner.js'), owner(1));
    const compiler = createHMRCompiler(context, {
      experimental_useElementTemplate: elementTemplate,
    });
    let runtime: ReturnType<typeof createMainThreadRuntime>;
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
              if (runtime) {
                const ack = await runtime.apply(stats!.compilation);
                expect(ack.error).toBeUndefined();
                expect(ack).toMatchObject({ ok: true, hash: stats!.hash });
                expect([...runtime.registrations.values()].at(-1)!()).toBe(2);
                expect(runtime.context['entryRuns']).toBe(1);
                watcher.close(resolve);
              } else {
                runtime = createMainThreadRuntime(stats!);
                expect(
                  runtime.context['testRequire']
                    .c['(react:main-thread)/./index.js'].hot._selfAccepted,
                ).toBe(!elementTemplate);
                expect([...runtime.registrations.values()].at(-1)!()).toBe(1);
                await fs.writeFile(path.join(context, 'owner.js'), owner(2));
              }
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
