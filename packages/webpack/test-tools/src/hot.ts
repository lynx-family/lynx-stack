// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { RspackOptions, Stats, StatsCompilation } from '@rspack/core';
import {
  BasicCaseCreator,
  NodeRunner,
  describeByWalk,
} from '@rspack/test-tools';
import type {
  IModuleScope,
  ITestContext,
  ITestEnv,
  ITestProcessor,
  ITestRunner,
  TTestConfig,
} from '@rspack/test-tools';
import { HotUpdatePlugin } from '@rspack/test-tools/helper/hot-update/plugin';

import { getOptions } from './suite.js';
import type { ITestSuite } from './suite.js';

// `@rspack/test-tools` 2.x reads `__TEST_*__` / `__RSPACK_*__` from globals at
// barrel-load time. The barrel import above triggers that, so the consuming
// test process must set them (see the css-extract vitest setup). `__DEBUG__` is
// also read at runtime by the vendored runner glue, so default it here.
declare global {
  var printLogger: boolean;
}
// `__DEBUG__` is declared as `boolean` by `@rspack/test-tools` globals; default
// it so the vendored runner glue does not read `undefined` at runtime.
(globalThis as { __DEBUG__?: boolean }).__DEBUG__ ??= false;

const TARGET = 'node' as const;

// ---------------------------------------------------------------------------
// Glue vendored from `@rspack/test-tools@2.0.6` `dist/case/hot.js`. These
// (`defaultOptions`, `overrideOptions`, `createHotRunner` and the base hot
// processor lifecycle) live behind the package `exports` map and are not
// importable, so the public primitives are used and only the glue is vendored.
// Shared with `hot-snapshot.ts`, which adds the step-snapshot matching.
// ---------------------------------------------------------------------------

/**
 * Dedupe `preact` for hot bundles that pull in `@lynx-js/react`.
 *
 * `@lynx-js/react` renders with `@lynx-js/internal-preact`, but some of its
 * entry points (and the prefresh runtime) import bare `preact` / `preact/*`,
 * which resolve to the standalone `preact` package — a *second* preact copy
 * whose hooks dispatcher is installed on a different `options` object, breaking
 * `useRef`/`useMemo` (`Cannot read properties of undefined (reading '__H')`).
 * The production `@lynx-js/rspeedy` build solves this with a `resolve.alias`
 * (see `plugin-react-alias`); the hot harness has no such plugin, so vendor the
 * minimal alias here, resolving each preact entry *relative to `@lynx-js/react`*
 * so it lands on that package's `@lynx-js/internal-preact`.
 *
 * Returns `{}` when `@lynx-js/react` is not installed (e.g. the css-extract /
 * template hot suites), so those suites are unaffected.
 */
function preactDedupeAlias(): Record<string, string> {
  const require = createRequire(import.meta.url);
  let reactPkg: string;
  try {
    reactPkg = require.resolve('@lynx-js/react/package.json');
  } catch {
    return {};
  }
  const fromReact = createRequire(reactPkg);
  const entries = [
    'preact',
    'preact/hooks',
    'preact/compat',
    'preact/debug',
    'preact/devtools',
    'preact/test-utils',
    'preact/jsx-runtime',
    'preact/jsx-dev-runtime',
  ];
  const alias: Record<string, string> = {};
  for (const entry of entries) {
    try {
      // `$` makes the alias exact, matching `plugin-react-alias`.
      alias[`${entry}$`] = fromReact.resolve(entry);
    } catch {
      // Entry not present in this preact build; skip it.
    }
  }
  return alias;
}

/** Vendored from `hot.js` `defaultOptions(context, target)`. */
export function hotDefaultOptions(context: ITestContext): RspackOptions {
  const options: RspackOptions = {
    context: context.getSource(),
    mode: 'development',
    devtool: false,
    output: {
      path: context.getDist(),
      // The lynx convention (matching the committed snapshots and the
      // `bundlePath` in `test.config.cjs`) names the entry bundle
      // `rspack-bundle.js`, not the upstream `bundle.js`.
      filename: 'rspack-bundle.js',
      chunkFilename: '[name].chunk.[fullhash].js',
      publicPath: 'https://test.cases/path/',
      library: { type: 'commonjs2' },
    },
    module: {
      // Native CSS by default; `mergeCaseOptions` forces the lynx css rule to
      // `javascript/auto` so `CssExtractRspackPlugin` is not bypassed.
      defaultRules: [
        '...',
        {
          test: /\.css$/i,
          type: 'css/auto',
        },
      ],
    },
    optimization: {
      moduleIds: 'named',
    },
    resolve: {
      alias: preactDedupeAlias(),
    },
    target: TARGET,
  };
  options.plugins ??= [];
  // NOTE: `HotModuleReplacementPlugin` is pushed by the (async) config hook via
  // a lazy `import('@rspack/core')`, not here — a static top-level import would
  // make the barrel eagerly load `@rspack/core` (ESM) and race
  // `@rspack/test-tools`'s `compiler.js` `require('@rspack/core')` under rstest.
  return options;
}

/** Vendored from `hot.js` `overrideOptions(context, options, target, updatePlugin)`. */
export function hotOverrideOptions(
  options: RspackOptions,
  updatePlugin: HotUpdatePlugin,
): void {
  // Keep the falsy check (not `??=`): an empty-string/empty-array `entry` is
  // also "no entry" and must fall back to the default index module.
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  if (!options.entry) {
    options.entry = './index.js';
  }
  options.module ??= {};
  const generator = (options.module.generator ??= {}) as Record<
    string,
    { exportsOnly?: boolean }
  >;
  for (const cssModuleType of ['css/auto', 'css/module', 'css'] as const) {
    generator[cssModuleType] ??= {};
    generator[cssModuleType].exportsOnly ??= false;
  }
  options.plugins ??= [];
  options.plugins.push(updatePlugin);
  if (!globalThis.printLogger) {
    options.infrastructureLogging = { level: 'error' };
  }
}

/**
 * Merge the per-case ESM config (loaded via dynamic `import()`) onto the
 * vendored `hotDefaultOptions`. Arrays (`module.rules`, `plugins`) are
 * concatenated and `output`/`optimization`/`experiments` shallow-merged, so the
 * case keeps full control without any per-case harness shim.
 *
 * Every case css rule is forced to `type: 'javascript/auto'`, otherwise the
 * `defaultRules` native-CSS rule (`type: 'css/auto'`) bypasses lynx's
 * `CssExtractRspackPlugin`.
 */
export function mergeCaseOptions(
  base: RspackOptions,
  caseOptions: RspackOptions,
): RspackOptions {
  const merged: RspackOptions = { ...base, ...caseOptions };

  merged.output = { ...base.output, ...caseOptions.output };
  merged.optimization = { ...base.optimization, ...caseOptions.optimization };
  merged.experiments = { ...base.experiments, ...caseOptions.experiments };
  merged.resolve = { ...base.resolve, ...caseOptions.resolve };

  const baseRules = base.module?.rules ?? [];
  const caseRules = (caseOptions.module?.rules ?? []).map((rule) => {
    if (
      rule
      && typeof rule === 'object'
      && 'test' in rule
      && rule.test instanceof RegExp
      && rule.test.test('a.css')
    ) {
      return { ...rule, type: 'javascript/auto' };
    }
    return rule;
  });
  merged.module = {
    ...base.module,
    ...caseOptions.module,
    rules: [...baseRules, ...caseRules],
  };

  merged.plugins = [
    ...(base.plugins ?? []),
    ...(caseOptions.plugins ?? []),
  ];

  return merged;
}

/**
 * Vendored from `hot.js` `findBundle` (node target only), extended with the
 * lynx `test.config.cjs` conventions: `findBundle(index, options)` and the
 * `bundlePath` list (cases whose entry is not `main`, e.g. `entry.js`).
 */
export function findHotBundle(
  context: ITestContext,
  updateIndex: number,
): string[] {
  const compiler = context.getCompiler();
  const stats = compiler.getStats() as Stats | null;
  if (!stats) throw new Error('Stats should exists when find bundle');
  const testConfig = context.getTestConfig() as {
    findBundle?: (index: number, options: RspackOptions) => string | string[];
    bundlePath?: string[];
  };
  if (typeof testConfig.findBundle === 'function') {
    const res = testConfig.findBundle(updateIndex, compiler.getOptions());
    return typeof res === 'string' ? [res] : res;
  }
  if (Array.isArray(testConfig.bundlePath)) {
    return testConfig.bundlePath;
  }
  const info = stats.toJson({ all: false, entrypoints: true });
  const entrypoints = info.entrypoints ?? {};
  const mainName = entrypoints['main'] ? 'main' : Object.keys(entrypoints)[0];
  const assets = (entrypoints[mainName!]?.assets ?? []).filter((s) =>
    s.name.endsWith('.js')
  );
  const last = assets[assets.length - 1]?.name;
  return last ? [last] : [];
}

export interface IHotProcessorHooks {
  /** Called by the runner after a successful hot rebuild (step snapshot). */
  onStep?: (
    env: ITestEnv,
    context: ITestContext,
    updateIndex: number,
    stats: Stats,
    runtime: Record<string, unknown> | undefined,
  ) => void;
  /** Called on the initial build (step 0 snapshot). */
  onInitial?: (
    env: ITestEnv,
    context: ITestContext,
    stats: Stats,
  ) => void;
}

export interface IHotProcessor extends ITestProcessor {
  updatePlugin: HotUpdatePlugin;
}

/**
 * The base hot processor lifecycle vendored from `hot.js` `createHotProcessor`
 * (config / compiler / build / run / check). The optional `hooks` let
 * `hot-snapshot.ts` register step-snapshot matching without re-implementing the
 * lifecycle.
 */
export function createBaseHotProcessor(
  name: string,
  src: string,
  temp: string,
  hooks: IHotProcessorHooks = {},
): IHotProcessor {
  const updatePlugin = new HotUpdatePlugin(src, temp);

  const processor: IHotProcessor = {
    updatePlugin,

    before: async (context) => {
      await updatePlugin.initialize();
      context.setValue('hotUpdatePlugin', updatePlugin);
    },

    config: async (context) => {
      const compiler = context.getCompiler();
      let options = hotDefaultOptions(context);
      // Lazy so the barrel doesn't eagerly `import '@rspack/core'` (see note in
      // `hotDefaultOptions`). By the time we await it here, nothing else is
      // mid-loading `@rspack/core`, so the later `compiler.js` require is fine.
      const { HotModuleReplacementPlugin } = await import('@rspack/core');
      (options.plugins ??= []).push(new HotModuleReplacementPlugin());
      const caseOptions = await getOptions<RspackOptions>(
        path.join(src, 'rspack.config.js'),
      );
      options = mergeCaseOptions(options, caseOptions);
      hotOverrideOptions(options, updatePlugin);
      compiler.setOptions(options);
    },

    compiler: (context) => {
      context.getCompiler().createCompiler();
    },

    build: async (context) => {
      await context.getCompiler().build();
    },

    run: async (env, context) => {
      // The runner reads these on each `NEXT_HMR` rebuild.
      context.setValue(
        'hotUpdateStepChecker',
        (updateIndex: number, stats: Stats, runtime: Record<string, unknown>) =>
          hooks.onStep?.(env, context, updateIndex, stats, runtime),
      );
      context.setValue(
        'hotUpdateStepErrorChecker',
        (_updateIndex: number, _stats: Stats) => {
          // No snapshotting on error steps; the build error surfaces via `NEXT`.
        },
      );

      // Inlined from `common.js` `run`: find the bundle(s) and drive the runner.
      const testConfig = context.getTestConfig();
      if (testConfig.noTests) return;
      const bundles = findHotBundle(context, updatePlugin.getUpdateIndex());
      if (bundles.length === 0) return;
      const result = context.getValue<unknown[]>('modules') ?? [];
      for (const bundle of bundles) {
        if (!bundle) continue;
        const runner = context.getRunner(bundle, env);
        result.push(runner.run(bundle));
      }
      context.setValue('modules', result);
      await Promise.all(result);
    },

    check: (env, context) => {
      hooks.onInitial?.(
        env,
        context,
        context.getCompiler().getStats() as Stats,
      );
    },

    afterAll: (context) => {
      if (context.getTestConfig().checkSteps === false) return;
      const updateIndex = updatePlugin.getUpdateIndex();
      const totalUpdates = updatePlugin.getTotalUpdates();
      if (updateIndex + 1 !== totalUpdates) {
        throw new Error(
          `Should run all hot steps (${
            updateIndex + 1
          } / ${totalUpdates}): ${name}`,
        );
      }
    },
  };

  return processor;
}

/**
 * Vendored from `hot.js` `createHotRunner` + the lynx `NEXT` injection. Adds
 * `moduleScope.NEXT_HMR` (goNext + build + step hook) and a callback-style
 * `moduleScope.NEXT` that routes the real apply through the lynx
 * `@lynx-js/test-tools/update.js` callback (`import.meta.webpackHot.check`).
 */
export function createHotRunner(
  context: ITestContext,
  name: string,
  _file: string,
  env: ITestEnv,
): ITestRunner {
  const compiler = context.getCompiler();
  const compilerOptions = compiler.getOptions();
  const testConfig = context.getTestConfig();
  const source = context.getSource();
  const dist = context.getDist();
  const updatePlugin = context.getValue<HotUpdatePlugin>('hotUpdatePlugin')!;

  const nextHMR = async (
    m: {
      hot: { check: (o?: unknown) => Promise<unknown> };
      buildError?: Error | null;
    },
    options?: unknown,
  ) => {
    await updatePlugin.goNext();
    const stats = await compiler.build();
    if (!stats) throw new Error('Should generate stats during build');
    const jsonStats = stats.toJson({
      assets: true,
      chunks: true,
      chunkModules: true,
      modules: true,
      entrypoints: true,
      chunkGroups: true,
    });
    const hasErrors = (jsonStats.errors?.length ?? 0) > 0;
    const checker = context.getValue<
      (updateIndex: number, stats: Stats, runtime: unknown) => void
    >(
      hasErrors
        ? 'hotUpdateStepErrorChecker'
        : 'hotUpdateStepChecker',
    );
    if (checker) {
      checker(
        updatePlugin.getUpdateIndex(),
        stats,
        runner.getGlobal('__HMR_UPDATED_RUNTIME__'),
      );
    }
    // Mirror the legacy `@rspack/test-tools` `next()` callback semantics: when
    // the rebuild fails to compile, the lynx `update()` callback must receive
    // the error (so error-recovery cases like `jsx/recovery` can assert on it
    // and proceed). The `NEXT` glue reads `m.buildError` inside `hot.check`.
    // Keep `||`: an empty joined message (no/empty error texts) must still
    // fall back to a human-readable default, which `??` would skip.
    const errorMessage = jsonStats.errors?.map((e) => e.message).join('\n')
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      || 'Module build failed';
    m.buildError = hasErrors ? new Error(errorMessage) : null;
    // Keep `||`: `options` may be `false` (a defined-but-falsy hot-check arg),
    // which must be replaced by `true`; `??` would preserve the `false`.
    // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
    const updatedModules = await m.hot.check(options || true);
    if (!updatedModules) throw new Error('No update available');
    return jsonStats;
  };

  const commonOptions = {
    env,
    name,
    runInNewContext: false,
    testConfig: {
      ...testConfig,
      moduleScope(
        ms: IModuleScope,
        stats?: StatsCompilation,
        options?: RspackOptions,
      ) {
        const moduleScope = ms;
        if (typeof testConfig.moduleScope === 'function') {
          testConfig.moduleScope(
            moduleScope,
            stats,
            options ?? compilerOptions,
          );
        }
        moduleScope['NEXT_HMR'] = nextHMR;
        // lynx fixtures use the vitest `vi` global (`vi.fn()`,
        // `vi.stubGlobal`). The runner executes modules in a `new Function`
        // scope where outer globals are not visible, so surface it explicitly.
        moduleScope['vi'] ??= (globalThis as { vi?: unknown }).vi;
        // lynx fixtures call `NEXT(update(done, true, cb))`; `update` returns an
        // `(err, stats) => {}` callback that does `import.meta.webpackHot.check`.
        // NEXT_HMR rebuilds + runs the step hook, then its `m.hot.check` invokes
        // the lynx callback (success → inner asserts, error → done(err)).
        moduleScope['NEXT'] = (callback: (err: Error | null) => void) => {
          const hotModule: {
            hot: { check: () => Promise<unknown> };
            buildError?: Error | null;
          } = {
            hot: {
              check: () => {
                // `nextHMR` sets `hotModule.buildError` from the rebuild stats
                // before invoking `check`; forward a compile error to the lynx
                // `update()` callback so it surfaces (matching the legacy
                // `next()` `callback(error)` behaviour) instead of silently
                // proceeding as a success.
                if (typeof callback === 'function') {
                  callback(hotModule.buildError ?? null);
                }
                return Promise.resolve({});
              },
            },
          };
          return nextHMR(hotModule).catch((err: Error) => {
            // `callback` may be absent if a leaked/deferred timer fires `NEXT`
            // after the case already drained; swallow rather than leak an
            // unhandled rejection.
            if (typeof callback === 'function') callback(err);
          });
        };
        return moduleScope;
      },
    } as TTestConfig,
    source,
    dist,
    compilerOptions,
    cachable: true,
  };

  const runner: ITestRunner = new NodeRunner(commonOptions);
  return runner;
}

/**
 * Returns a `testConfig` hook that merges a case's committed `test.config.cjs`
 * (lynx convention; CommonJS, so `BasicCaseCreator.readTestConfig` — which only
 * reads `test.config.js` — misses it) into the harness `testConfig`. This is how
 * cases declare `bundlePath` / `findBundle` / `moduleScope` etc.
 */
export function loadCaseTestConfig(
  src: string,
): (testConfig: TTestConfig) => void {
  return (testConfig) => {
    const file = path.join(src, 'test.config.cjs');
    if (!existsSync(file)) return;
    const require = createRequire(import.meta.url);
    const caseConfig = require(file) as Record<string, unknown>;
    Object.assign(testConfig, caseConfig);
  };
}

const creators = new Map<string, BasicCaseCreator>();

function getHotCreator(): BasicCaseCreator {
  const key = 'hot';
  if (!creators.has(key)) {
    creators.set(
      key,
      new BasicCaseCreator({
        clean: true,
        describe: false,
        target: TARGET,
        steps: ({ name, src, dist, temp }) => [
          createBaseHotProcessor(name, src, temp ?? path.resolve(dist, 'temp')),
        ],
        runner: {
          key: (_context, name) => name,
          runner: createHotRunner,
        },
        // The lynx fixtures drive HMR through debounced/`setTimeout`-deferred
        // callbacks; running cases concurrently interleaves their leaked timers
        // across `require` contexts, so serialize to one case at a time.
        concurrent: 1,
      }),
    );
  }
  return creators.get(key)!;
}

export function hotCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../js/hot');
  const testDir = path.dirname(suite.casePath);
  const creator = getHotCreator();
  describeByWalk(suite.name, (name, src, dist) => {
    const relativeCase = path.relative(suite.casePath, src);
    const temp = path.join(testDir, '.hot-temp', relativeCase);
    creator.create(name, src, dist, temp, {
      testConfig: loadCaseTestConfig(src),
    });
  }, {
    source: suite.casePath,
    dist: distPath,
  });
}
