// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it, rstest } from '@rstest/core';

import { LAYERS } from '@lynx-js/react-webpack-plugin';

import { ReactRefreshRspackPlugin } from '../src/ReactRefreshRspackPlugin.js';

function generateInterceptSource(): string {
  const plugin = new ReactRefreshRspackPlugin();
  let generateResult = '';

  const mockCompiler = {
    options: { mode: 'development' },
    webpack: {
      ProvidePlugin: class {
        apply() {
          /* noop */
        }
      },
    },
    hooks: {
      thisCompilation: {
        tap: (_name: string, cb: (compilation: unknown) => void) => {
          const compilation = {
            hooks: {
              runtimeModule: {
                tap: (_name: string, moduleCb: (module: unknown) => void) => {
                  const module = {
                    name: 'hot_module_replacement',
                    source: { source: Buffer.from('') },
                  };
                  moduleCb(module);

                  generateResult = module.source.source.toString();
                },
              },
            },
          };
          cb(compilation);
        },
      },
    },
  };

  // @ts-expect-error test mock
  plugin.apply(mockCompiler);
  return generateResult;
}

function createSandboxInterceptor(
  modules: Record<string, (...args: unknown[]) => void>,
  initialGlobal: Record<string, unknown> = {},
) {
  const sandbox: Record<string, unknown> = { ...initialGlobal };
  const webpackRequire = {
    i: [] as ((options: {
      id: string;
      factory: (...args: unknown[]) => void;
    }) => void)[],
  };

  const source = generateInterceptSource();
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const runIntercept = new Function(
    '__webpack_modules__',
    '__webpack_require__',
    'globalThis',
    source,
  ) as (
    modules: Record<string, (...args: unknown[]) => void>,
    webpackRequire: unknown,
    globalObj: Record<string, unknown>,
  ) => void;
  runIntercept(modules, webpackRequire, sandbox);

  return {
    sandbox,
    intercept: webpackRequire.i[0]!,
  };
}

function TestRefreshComp() {
  /* noop */
}

describe('ReactRefresh plugins', () => {
  it('ReactRefreshRspackPlugin intercept code generation in dev', () => {
    const generateResult = generateInterceptSource();
    expect(generateResult).toContain('__webpack_modules__');
    expect(generateResult).toContain(
      'globalThis[Symbol.for(\'__LYNX_WEBPACK_MODULES__\')] = __webpack_modules__;',
    );
  });

  it('rewrites missing background-layer module to main-thread even when ambient __PREFRESH__ exists', () => {
    const bgId = `./app.jsx(${LAYERS.BACKGROUND})`;
    const mtId = `./app.jsx(${LAYERS.MAIN_THREAD})`;
    const fallbackFactory = rstest.fn();
    const mainThreadFactory = rstest.fn();
    const modules = { [mtId]: mainThreadFactory };

    const { intercept } = createSandboxInterceptor(modules, {
      __PREFRESH__: { sign: rstest.fn(), register: rstest.fn() },
    });

    const options = { id: bgId, factory: fallbackFactory };
    intercept(options);

    expect(options.id).toBe(mtId);
    expect(options.factory).toBe(mainThreadFactory);
  });

  it('keeps background-layer module intact when present in __webpack_modules__ even without __PREFRESH__', () => {
    const bgId = `./app.jsx(${LAYERS.BACKGROUND})`;
    const mtId = `./app.jsx(${LAYERS.MAIN_THREAD})`;
    const bgFactory = rstest.fn();
    const mtFactory = rstest.fn();
    const modules = { [bgId]: bgFactory, [mtId]: mtFactory };

    const { intercept } = createSandboxInterceptor(modules);

    const options = { id: bgId, factory: bgFactory };
    intercept(options);

    expect(options.id).toBe(bgId);
    expect(options.factory).not.toBe(mtFactory);
  });

  it('leaves options intact when neither background nor main-thread factory exists', () => {
    const bgId = `./missing.jsx(${LAYERS.BACKGROUND})`;
    const placeholderFactory = rstest.fn();
    const { intercept } = createSandboxInterceptor({});

    const options = { id: bgId, factory: placeholderFactory };
    intercept(options);

    expect(options.id).toBe(bgId);
    expect(options.factory).toBe(placeholderFactory);
  });

  it('prefixes synchronous $RefreshReg$ registrations with moduleObject.id in bundle runtime', () => {
    const register = rstest.fn();
    const sign = rstest.fn(() => 'needsHooks');
    const flush = rstest.fn();

    const { sandbox, intercept } = createSandboxInterceptor({});

    const refreshRuntimeModule = {
      id: '@lynx-js/react/refresh',
      exports: {} as Record<string, unknown>,
    };
    const refreshOpts = {
      id: refreshRuntimeModule.id,
      factory(moduleObject: { exports: Record<string, unknown> }) {
        moduleObject.exports = {
          createRefreshRuntime: () => ({ register, sign, flush }),
          flush: rstest.fn(),
          isComponent: rstest.fn(),
        };
      },
    };
    intercept(refreshOpts);
    refreshOpts.factory(refreshRuntimeModule, refreshRuntimeModule.exports, {});

    const tsModule = { id: './hooks/useCounter.ts', exports: {} };
    const tsOpts = {
      id: tsModule.id,
      factory() {
        (sandbox['$RefreshReg$'] as (t: unknown, id: string) => void)(
          TestRefreshComp,
          'Comp',
        );
      },
    };
    intercept(tsOpts);
    tsOpts.factory(tsModule, tsModule.exports, {});

    expect(register).toHaveBeenCalledTimes(1);
    expect(register).toHaveBeenCalledWith(
      TestRefreshComp,
      './hooks/useCounter.ts Comp',
    );
  });
});
