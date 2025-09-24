// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import {
  BasicRunnerFactory,
  ECompilerType,
  NodeRunner,
  TestContext,
} from '@rspack/test-tools';
import type {
  IGlobalContext,
  ITestContext,
  ITestEnv,
  ITestProcessor,
  ITestRunner,
  TCompiler,
  TCompilerFactory,
  TCompilerOptions,
  TCompilerStatsCompilation,
  TRunnerFactory,
  TTestConfig,
  TUpdateOptions,
} from '@rspack/test-tools';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

export type TBeforeExecuteFn = () => Promise<void> | void;
export type TAfterExecuteFn = (modules: TRunnerOutput[]) => Promise<void>;
export interface ITestSuite {
  /** The name of the suite */
  name: string;
  /**
   * The absolute path to the cases.
   *
   * @example
   * ```
   * import path from 'node:path'
   *
   * import { describeCases } from '@lynx-js/test-tools'
   *
   * describeCases({
   *   name: 'runtime-wrapper',
   *   casePath: path.join(__dirname, 'cases'),
   * })
   * ```
   */
  casePath: string;
  /**
   * Enable build cache
   *
   * @defaultValue `false`
   *
   * @remarks
   * webpack-only
   */
  cache?: boolean;

  afterExecute?: TAfterExecuteFn | undefined;

  beforeExecute?: TBeforeExecuteFn | undefined;
}

export function createVitestEnv(): ITestEnv {
  return {
    it,
    beforeEach,
    afterEach,
    expect,
    vi,
  };
}

interface TRunnerOutput {
  exports: unknown;
  context: IGlobalContext;
}

export function createRunner(
  src: string,
  dist: string,
  runnerFactory: new(
    name: string,
    context: ITestContext,
  ) => TRunnerFactory<ECompilerType>,
  options: {
    afterExecute?: TAfterExecuteFn | undefined;
    beforeExecute?: TBeforeExecuteFn | undefined;
  } = {},
): (name: string, processor: ITestProcessor) => void {
  const require = createRequire(import.meta.url);
  const testConfigFile = path.join(src, 'test.config.cjs');
  const testConfig = existsSync(testConfigFile)
    ? require(testConfigFile) as TTestConfig<ECompilerType>
    : {};
  const oldModuleScope = testConfig.moduleScope;
  testConfig.moduleScope = (ms, stats) => {
    if (typeof oldModuleScope === 'function') {
      ms = oldModuleScope(ms, stats);
    }
    // @ts-expect-error Mock the console.alog method
    ms.console.alog = () => void 0;
    return ms;
  };

  const context = new TestContext({
    src,
    dist,
    compilerFactories: {
      [ECompilerType.Rspack]: options =>
        (require('@rspack/core') as TCompilerFactory<ECompilerType>)(
          options,
        ),
      [ECompilerType.Webpack]: options =>
        (require('webpack') as TCompilerFactory<ECompilerType>)(
          options,
        ) as TCompiler<ECompilerType>,
    },
    runnerFactory,
    testConfig,
  });
  const runner = function run(name: string, processor: ITestProcessor) {
    it(`should run before`, async () => {
      await processor.beforeAll?.(context);
      await processor.before?.(context);
    });
    it(`should compile`, async () => {
      await processor.config?.(context);
      await processor.compiler?.(context);
      await processor.build?.(context);
    });
    const tasks: [string, () => Promise<void>][] = [];
    const beforeTasks: (() => Promise<void> | void)[] = [];
    const afterTasks: (() => Promise<void> | void)[] = [];
    it(`${name} should run sync`, async () => {
      context.setValue(name, 'documentType', 'fake');
      if (typeof options.beforeExecute === 'function') {
        await options.beforeExecute();
      }
      await processor.run?.({
        expect,
        it: (description: string, fn: () => Promise<void>) => {
          expect(typeof description === 'string');
          expect(typeof fn === 'function');
          tasks.push([description, fn]);
        },
        beforeEach: (fn: () => Promise<void> | void) => {
          expect(typeof fn === 'function');
          beforeTasks.push(fn);
        },
        afterEach: (fn: () => Promise<void> | void) => {
          expect(typeof fn === 'function');
          afterTasks.push(fn);
        },
        vi,
      }, context);
      if (typeof options.afterExecute === 'function') {
        const modules = await Promise.all(
          context.getValue<Promise<TRunnerOutput>[]>(name, 'modules')!,
        );
        await options.afterExecute(modules);
      }
      await processor.check?.(createVitestEnv(), context);
    });
    it(`${name} should run async`, async function() {
      for (const [description, fn] of tasks) {
        for (const before of beforeTasks) {
          await before();
        }
        try {
          await fn();
        } catch (e) {
          throw new Error(
            `Error: ${description} failed\n${(e as Error).stack}`,
          );
        }
        for (const after of afterTasks) {
          await after();
        }
      }
    });
    it(`${name} should run after`, async () => {
      await processor.after?.(context);
      await processor.afterAll?.(context);
    });
  };

  return runner;
}

export class RspeedyNormalRunner<
  T extends ECompilerType = ECompilerType.Rspack,
> extends NodeRunner<T> {
  override async run<T>(
    file: string,
  ): Promise<{ exports: T; context: typeof globalThis }> {
    const res = await super.run(file) as T;
    return {
      exports: res,
      context: global,
    };
  }
}

export class RspeedyNormalRunnerFactory<
  T extends ECompilerType,
> extends BasicRunnerFactory<T> {
  override createRunner(
    _: string,
    __: TCompilerStatsCompilation<T>,
    compilerOptions: TCompilerOptions<T>,
    env: ITestEnv,
  ): ITestRunner {
    return new RspeedyNormalRunner({
      env,
      name: this.name,
      runInNewContext: false,
      testConfig: this.context.getTestConfig(),
      source: this.context.getSource(),
      dist: this.context.getDist(),
      compilerOptions: compilerOptions,
    });
  }
}

export async function getOptions<T>(path: string): Promise<T> {
  const options = await import(path) as
    & { default?: T }
    & T;

  return options.default ?? options;
}

export interface TImportedBundler {
  HotModuleReplacementPlugin: new() => unknown;
  LoaderOptionsPlugin: new(update: TUpdateOptions) => unknown;
}
