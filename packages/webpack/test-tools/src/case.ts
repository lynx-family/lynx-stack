// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { RspackOptions, Stats } from '@rspack/core';
import { BasicCaseCreator, describeByWalk } from '@rspack/test-tools';
import type { ITestContext, ITestProcessor } from '@rspack/test-tools';

import { getOptions, rspeedyRunnerCreator } from './suite.js';
import type { ITestSuite, TAfterExecuteFn, TBeforeExecuteFn } from './suite.js';

const TARGET = 'node' as const;

function lynxDefaultOptions(
  context: ITestContext,
  cwd: string,
): RspackOptions {
  return {
    context: cwd,
    entry: context.getSource(),
    mode: 'none',
    target: TARGET,
    output: {
      publicPath: '/',
      path: context.getDist(),
      // The entry bundle is named `rspack.bundle.js` (matching the legacy
      // `${compilerType}.bundle.js` default) so the fixtures' sibling-CSS
      // lookup `__filename.replace('.js', '.css')` resolves to
      // `rspack.bundle.css`, the name `CssExtractRspackPlugin` emits.
      filename: 'rspack.bundle.js',
    },
    resolve: {
      extensions: ['.jsx', '.tsx', '.js', '.ts', '.json'],
      extensionAlias: {
        '.js': ['.ts', '.js'],
        '.jsx': ['.tsx', '.jsx'],
        '.mjs': ['.mts', '.mjs'],
      },
    },
  };
}

/**
 * Lynx cases carry their per-case config in `test.config.cjs`, but
 * `@rspack/test-tools`' `BasicCaseCreator` only reads `test.config.js`, so its
 * `context.getTestConfig()` is empty for these cases. Load the `.cjs` directly
 * to honor the lynx-specific per-case `beforeExecute` hook (which sets up the
 * globals a case bundle needs before it runs).
 */
interface LynxCaseConfig {
  beforeExecute?: () => void | Promise<void>;
}

function readLynxCaseConfig(src: string): LynxCaseConfig {
  const file = path.join(src, 'test.config.cjs');
  if (!existsSync(file)) return {};
  const require = createRequire(import.meta.url);
  return require(file) as LynxCaseConfig;
}

/** Vendored `findBundle` for a single-entry node case. */
function findBundle(context: ITestContext): string | undefined {
  const stats = context.getCompiler().getStats() as Stats | null;
  if (!stats) return undefined;
  const info = stats.toJson({ all: false, entrypoints: true });
  const assets = (info.entrypoints?.['main']?.assets ?? []).filter((s) =>
    s.name.endsWith('.js')
  );
  return assets[assets.length - 1]?.name;
}

/**
 * The case bundle's top-level `it()` callbacks are collected by
 * `@rspack/test-tools`' concurrent env and replayed sequentially inside a single
 * outer rstest test. Registering each `it` makes the env call `expect()` twice
 * (`expect(typeof description === 'string')` etc.), polluting
 * `expect.getState().assertionCalls` before any task body runs. A fixture's
 * `expect.assertions(n)` then sees those extra calls and fails. Reset the
 * per-test assertion counter to 0 when the first replayed task body starts, so
 * the count reflects only the case file's own assertions (which is what the
 * legacy runner did and what fixtures expect — the count spans all of the
 * file's `it` bodies).
 */
function withScopedAssertions<E extends { it?: unknown; expect?: unknown }>(
  env: E,
): E {
  const originalIt = env.it as
    | ((description: string, fn: () => unknown) => void)
    | undefined;
  const expectFn = env.expect as
    | {
      setState?: (s: { assertionCalls: number }) => void;
    }
    | undefined;
  if (
    typeof originalIt !== 'function'
    || typeof expectFn?.setState !== 'function'
  ) {
    return env;
  }
  let didReset = false;
  return {
    ...env,
    it: (description: string, fn: () => unknown) => {
      originalIt(description, () => {
        if (!didReset) {
          didReset = true;
          expectFn.setState!({ assertionCalls: 0 });
        }
        return fn();
      });
    },
  };
}

function createNormalProcessor(
  name: string,
  src: string,
  cwd: string,
  hooks: {
    afterExecute?: TAfterExecuteFn | undefined;
    beforeExecute?: TBeforeExecuteFn | undefined;
  },
): ITestProcessor {
  return {
    config: async (context) => {
      const compiler = context.getCompiler();
      const defaultOptions = lynxDefaultOptions(context, cwd);
      const caseOptions = await getOptions<RspackOptions>(
        path.join(src, 'rspack.config.js'),
      );
      const { merge } = await import('webpack-merge');
      const options = merge(
        defaultOptions as Record<string, unknown>,
        caseOptions as Record<string, unknown>,
      ) as RspackOptions;
      options.target = TARGET;
      compiler.setOptions(options);
    },
    compiler: (context) => {
      context.getCompiler().createCompiler();
    },
    build: async (context) => {
      await context.getCompiler().build();
    },
    run: async (env, context) => {
      const testConfig = context.getTestConfig();
      if (testConfig.noTests) return;
      const caseConfig = readLynxCaseConfig(src);
      if (typeof hooks.beforeExecute === 'function') {
        await hooks.beforeExecute();
      }
      if (typeof caseConfig.beforeExecute === 'function') {
        await caseConfig.beforeExecute();
      }
      const bundle = findBundle(context);
      if (!bundle) return;
      const runner = context.getRunner(bundle, withScopedAssertions(env));
      const mod = runner.run(bundle);
      const result = context.getValue<unknown[]>('modules') ?? [];
      result.push(mod);
      context.setValue('modules', result);
      const modules = await Promise.all(result);
      if (typeof hooks.afterExecute === 'function') {
        // @ts-expect-error runner output shape is `{ exports, context }`.
        await hooks.afterExecute(modules);
      }
    },
    check: (_env, context) => {
      const stats = context.getCompiler().getStats() as Stats | null;
      if (stats?.hasErrors()) {
        const errors = stats.toJson({ errors: true }).errors ?? [];
        throw new Error(
          `Failed to compile ${name}:\n${
            errors.map((e) => e.message).join('\n\n')
          }`,
        );
      }
    },
  };
}

const creators = new Map<string, BasicCaseCreator>();

function getCreator(
  cwd: string,
  hooks: {
    afterExecute?: TAfterExecuteFn | undefined;
    beforeExecute?: TBeforeExecuteFn | undefined;
  },
): BasicCaseCreator {
  // Each suite has a distinct cwd; key by it so per-suite hooks are respected.
  const key = cwd;
  if (!creators.has(key)) {
    creators.set(
      key,
      new BasicCaseCreator({
        clean: true,
        describe: false,
        target: TARGET,
        steps: ({ name, src }) => [
          createNormalProcessor(name, src, cwd, hooks),
        ],
        runner: rspeedyRunnerCreator,
        // Serial (like the hot creator): some fixtures call bare `toMatchSnapshot`
        // (not `toMatchFileSnapshotSync`), and running cases concurrently makes
        // those fire outside a test context ("'toMatchSnapshot' cannot be used
        // without test context") ~1/10 of the time depending on scheduling.
        concurrent: 1,
      }),
    );
  }
  return creators.get(key)!;
}

export function describeCases(suite: ITestSuite): void {
  const distPath = path.resolve(suite.casePath, '../dist/config');
  const creator = getCreator(suite.casePath, {
    afterExecute: suite.afterExecute,
    beforeExecute: suite.beforeExecute,
  });
  describeByWalk(suite.name, (name, src, dist) => {
    creator.create(name, src, dist);
  }, {
    source: suite.casePath,
    dist: distPath,
  });
}
