// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { NodeRunner, TestContext } from '@rspack/test-tools';
import type {
  IGlobalContext,
  ITestContext,
  ITestEnv,
  ITestProcessor,
  TTestConfig,
  TTestRunnerCreator,
} from '@rspack/test-tools';

declare global {
  var printLogger: boolean;
}

globalThis.printLogger ??= false;

type RstestRuntime = typeof import('@rstest/core');

const runtime = globalThis as unknown as {
  afterEach: RstestRuntime['afterEach'];
  beforeEach: RstestRuntime['beforeEach'];
  // `ITestEnv['expect']` is `Expect`, a type `@rspack/test-tools` references but
  // does not export, so it resolves to `error` and makes every `expect(...)`
  // call "unsafe". Use rstest's concrete `expect` type, which is what actually
  // backs the global at runtime.
  expect: RstestRuntime['expect'];
  it: RstestRuntime['it'];
  rstest?: RstestRuntime['rstest'];
};

const afterEach = runtime.afterEach;
const beforeEach = runtime.beforeEach;
const expect = runtime.expect;
const it = runtime.it;
const mockApi = runtime.rstest;

/** HMR step bookkeeping shared between the hot-update loader, plugin and runner. */
export interface TUpdateOptions {
  updateIndex: number;
  totalUpdates: number;
  changedFiles: string[];
}

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

  afterExecute?: TAfterExecuteFn | undefined;

  beforeExecute?: TBeforeExecuteFn | undefined;
}

export function createRstestEnv(): ITestEnv {
  return {
    it,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    beforeEach,
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    afterEach,
    expect,
    rstest: mockApi,
  } as ITestEnv;
}

interface TRunnerOutput {
  exports: unknown;
  context: IGlobalContext;
}

/** A NodeRunner that returns `{ exports, context }` like the legacy Rspeedy runner. */
export class RspeedyNormalRunner extends NodeRunner {
  override async run(
    file: string,
  ): Promise<{ exports: unknown; context: typeof globalThis }> {
    const res = await super.run(file);
    return {
      exports: res,
      context: global,
    };
  }
}

/**
 * Wrap a case's `moduleScope` so fixtures written against vitest's `vi` global
 * (e.g. `vi.fn()`, `vi.stubGlobal()`) keep working under rstest, where no `vi`
 * exists: alias the API-compatible `rstest` mock API into the module scope.
 * Keeps the fixture sources unchanged across the vitest → rstest migration.
 */
export function withViModuleScope(
  testConfig: TTestConfig,
): TTestConfig {
  const oldModuleScope = testConfig.moduleScope;
  return {
    ...testConfig,
    moduleScope: (ms, stats) => {
      if (typeof oldModuleScope === 'function') {
        ms = oldModuleScope(ms, stats);
      }
      (ms as unknown as Record<string, unknown>)['vi'] = mockApi;
      return ms;
    },
  };
}

/** Runner creator that drives `RspeedyNormalRunner` (the default for normal cases). */
export const rspeedyRunnerCreator: TTestRunnerCreator = {
  key: (_context: ITestContext, name: string, file: string) =>
    file.includes(':') ? `${name}:${file}` : name,
  runner: (context: ITestContext, name: string, _file: string, env: ITestEnv) =>
    new RspeedyNormalRunner({
      env,
      name,
      runInNewContext: false,
      testConfig: withViModuleScope(context.getTestConfig()),
      source: context.getSource(),
      dist: context.getDist(),
      compilerOptions: context.getCompiler().getOptions(),
    }),
};

export function createRunner(
  src: string,
  dist: string,
  runnerCreator: TTestRunnerCreator,
  options: {
    afterExecute?: TAfterExecuteFn | undefined;
    beforeExecute?: TBeforeExecuteFn | undefined;
  } = {},
): (name: string, processor: ITestProcessor) => void {
  const require = createRequire(import.meta.url);
  const testConfigFile = path.join(src, 'test.config.cjs');
  const testConfig: TTestConfig = existsSync(testConfigFile)
    ? require(testConfigFile) as TTestConfig
    : {};
  const oldModuleScope = testConfig.moduleScope;
  testConfig.moduleScope = (ms, stats) => {
    if (typeof oldModuleScope === 'function') {
      ms = oldModuleScope(ms, stats);
    }
    // @ts-expect-error Mock the console.alog method
    ms.console.alog = () => void 0;
    // Fixtures written against vitest's `vi` global (e.g. `vi.fn()`,
    // `vi.stubGlobal()`): under rstest there is no `vi`, so alias the
    // API-compatible `rstest` mock API into the module scope. Keeps the
    // fixture sources unchanged across the vitest → rstest migration.
    (ms as unknown as Record<string, unknown>)['vi'] = mockApi;
    return ms;
  };

  return function run(name: string, processor: ITestProcessor) {
    const context = new TestContext({
      name,
      src,
      dist,
      runnerCreator,
      testConfig,
    });
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
      context.setValue('documentType', 'fake');
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
        rstest: mockApi,
      }, context);
      if (typeof options.afterExecute === 'function') {
        const modules = await Promise.all(
          context.getValue<Promise<TRunnerOutput>[]>('modules')!,
        );
        await options.afterExecute(modules);
      }
      await processor.check?.(createRstestEnv(), context);
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
}

export async function getOptions<T>(path: string): Promise<T> {
  const options = await import(path) as
    & { default?: T }
    & T;

  return options.default ?? options;
}
