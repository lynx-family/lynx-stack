// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// These are real compiled wrappers and custom sections. The VM models SDK
// init/define/require injection; it does not exercise Native fetch or encoding.
/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument */

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';

import type { Compilation } from '@rspack/core';
import { expect, it } from '@rstest/core';

import { createHMRCompiler } from './helpers/main-thread-hmr.js';

const { RuntimeWrapperWebpackPlugin } = createRequire(import.meta.url)(
  '../../runtime-wrapper-webpack-plugin/lib/index.js',
);

function createBackgroundApp(initial: Compilation, appId: string) {
  let compilation = initial;
  const factories = new Map<string, (...args: unknown[]) => unknown>();
  const sections = new Map<string, Record<string, { content: string }>>();
  const cache = new Map<string, unknown>();
  const fetched: string[] = [];
  const loaded: string[] = [];
  const fallback: string[] = [];
  const nativeModules = { appId };
  const timer = () => `${appId}:timer`;
  const vm = createContext({ bundleSupportLoadScript: true });
  vm['self'] = vm;

  const app = {
    define(name: string, factory: (...args: unknown[]) => unknown) {
      factories.set(name, factory);
    },
    require(this: void, name: string): unknown {
      const factory = factories.get(name);
      if (!factory) return {};
      const amdModule = { exports: {} };
      // Match BaseApp.require's established AMD argument order, including
      // the intentionally undefined browser globals before fetch and RAF.
      factory(
        app.require,
        amdModule,
        amdModule.exports,
        undefined,
        timer,
        timer,
        () => undefined,
        () => undefined,
        nativeModules,
        {},
        console,
        undefined,
        undefined,
        appId,
        undefined,
        {},
        lynx,
        ...Array.from({ length: 13 }, () => undefined),
        lynx.fetch,
        ...Array.from({ length: 6 }, () => undefined),
        timer,
        () => undefined,
      );
      return amdModule.exports;
    },
  };
  const execute = (source: string): unknown => {
    const result = runInContext(source, vm);
    return typeof result?.init === 'function'
      ? result.init({ tt: app })
      : result;
  };
  const lynx = {
    appId,
    Promise,
    fetch: () => `${appId}:fetch`,
    getCoreContext: () => ({ addEventListener: () => undefined }),
    fetchBundle(url: string) {
      fetched.push(url);
      const asset = compilation.getAsset(url.slice(1))!;
      const encoded = JSON.parse(asset.source.source().toString());
      const canonicalUrl = `native:${url}`;
      sections.set(canonicalUrl, encoded.customSections);
      return {
        then(resolve: (value: { code: number; url: string }) => void) {
          resolve({ code: 0, url: canonicalUrl });
          return null;
        },
      };
    },
    loadScript(section: string, { bundleName }: { bundleName: string }) {
      const key = `${bundleName}:${section}`;
      loaded.push(key);
      if (!cache.has(key)) {
        cache.set(key, execute(sections.get(bundleName)![section]!.content));
      }
      return cache.get(key);
    },
    requireModuleAsync(name: string) {
      fallback.push(name);
      throw new Error(`Unexpected legacy HMR loading: ${name}`);
    },
  };

  execute(
    compilation.getAsset('main__background.js')!.source.source().toString(),
  );
  const webpackRequire = vm['backgroundRequire'];
  const route = [...compilation.modules].find(module =>
    module.layer === 'react:background'
    && path.basename(module.nameForCondition() ?? '') === 'route.js'
  )!;
  const routeId = compilation.chunkGraph.getModuleId(route)!;
  for (const chunk of compilation.chunkGraph.getModuleChunksIterable(route)) {
    for (const filename of chunk.files) {
      if (filename.endsWith('.js')) {
        webpackRequire.C(
          execute(compilation.getAsset(filename)!.source.source().toString()),
        );
      }
    }
  }

  return {
    fetched,
    loaded,
    fallback,
    read: () => ({
      entry: vm['readEntry'](),
      route: webpackRequire(routeId).read(),
    }),
    apply: async (next: Compilation) => {
      compilation = next;
      const updated = await webpackRequire.c[
        Object.keys(webpackRequire.c).find(id => id.includes('index.js'))!
      ].hot.check(true);
      expect(updated).not.toBeNull();
      expect(webpackRequire.h()).toBe(next.hash);
    },
  };
}

it('loads sequential BTS Native updates with each app scope and a loaded async chunk', async () => {
  const tempRoot = path.resolve(__dirname, '../../../../.tmp/main-thread-hmr');
  await fs.mkdir(tempRoot, { recursive: true });
  const context = await fs.mkdtemp(path.join(tempRoot, 'background-'));
  const writeVersion = async (version: number) => {
    const probe =
      `() => [${version}, lynx.appId, NativeModules.appId, setTimeout(() => {}, 0), nativeAppId, fetch(), Promise === lynx.Promise, typeof console.log, typeof require]`;
    await Promise.all([
      fs.writeFile(
        path.join(context, 'index.js'),
        `export const load = () => import('./route.js');
if (__BACKGROUND__) { globalThis.readEntry = ${probe}; module.hot.accept(); }`,
      ),
      fs.writeFile(
        path.join(context, 'route.js'),
        `export const read = ${probe}; if (module.hot) module.hot.accept();`,
      ),
    ]);
  };
  await writeVersion(1);
  const compiler = createHMRCompiler(context);
  new RuntimeWrapperWebpackPlugin({
    // RSPACK_HOT_TEST writes its diagnostic marker to global self. Keep that
    // test-only access outside the SDK's intentionally undefined browser slot.
    injectVars: (vars: string[]) =>
      vars.map(name => name === 'self' ? '__unusedSelf' : name),
  }).apply(compiler);
  compiler.hooks.thisCompilation.tap('ExposeBackgroundRequire', compilation => {
    compilation.hooks.additionalTreeRuntimeRequirements.tap(
      'ExposeBackgroundRequire',
      chunk => {
        if (chunk.name !== 'main__background') return;
        class ExposeRequire extends compiler.webpack.RuntimeModule {
          constructor() {
            super(
              'BTS test require',
              compiler.webpack.RuntimeModule.STAGE_ATTACH + 1,
            );
          }
          override generate(): string {
            return 'globalThis.backgroundRequire = __webpack_require__;';
          }
        }
        compilation.addRuntimeModule(chunk, new ExposeRequire());
      },
    );
  });
  let apps: ReturnType<typeof createBackgroundApp>[];
  let step = 0;
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
            step++;
            if (step === 1) {
              apps = ['one', 'two'].map(appId =>
                createBackgroundApp(compilation, appId)
              );
            } else {
              await Promise.all(apps.map(app => app.apply(compilation)));
            }
            for (const [index, app] of apps.entries()) {
              const appId = index === 0 ? 'one' : 'two';
              const expected = [
                step,
                appId,
                appId,
                `${appId}:timer`,
                appId,
                `${appId}:fetch`,
                true,
                'function',
                'function',
              ];
              expect(app.read()).toEqual({ entry: expected, route: expected });
              expect(app.fallback).toEqual([]);
              expect(app.fetched).toHaveLength(step - 1);
              expect(app.loaded).toHaveLength((step - 1) * 3);
              expect(
                app.loaded.every(name =>
                  name.startsWith('native:/main__background.')
                ),
              ).toBe(true);
            }
            if (step < 3) {
              await writeVersion(step + 1);
            } else {
              watcher.close((closeError?: Error) =>
                closeError ? reject(closeError) : resolve()
              );
            }
          })().catch((failure: Error) => watcher.close(() => reject(failure)));
        },
      );
    });
  } finally {
    await new Promise<void>((resolve, reject) => {
      compiler.close(error => error ? reject(error) : resolve());
    });
    await fs.rm(context, { recursive: true, force: true });
  }
});
