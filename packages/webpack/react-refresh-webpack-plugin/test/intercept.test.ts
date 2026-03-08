// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest';

import { ReactRefreshRspackPlugin } from '../src/ReactRefreshRspackPlugin.js';
import { ReactRefreshWebpackPlugin } from '../src/ReactRefreshWebpackPlugin.js';

describe('ReactRefresh plugins', () => {
  it('ReactRefreshWebpackPlugin intercept code generation in dev', () => {
    const plugin = new ReactRefreshWebpackPlugin();
    let generateResult = '';

    const mockCompiler = {
      options: { mode: 'development' },
      context: '/test',
      webpack: {
        EntryPlugin: class {
          apply() {
            /* noop */
          }
        },
        ProvidePlugin: class {
          apply() {
            /* noop */
          }
        },
        RuntimeGlobals: {
          interceptModuleExecution: 'interceptModuleExecution',
        },
        RuntimeModule: class {
          name: string;
          stage: number;
          constructor(name: string, stage: number) {
            this.name = name;
            this.stage = stage;
          }
        },
      },
      hooks: {
        compilation: {
          tap: (_name: string, cb: (compilation: unknown) => void) => {
            const compilation = {
              compiler: mockCompiler,
              mainTemplate: {
                hooks: {
                  localVars: {
                    tap: () => {
                      /* noop */
                    },
                  },
                },
              },
              hooks: {
                additionalTreeRuntimeRequirements: {
                  tap: (
                    _name: string,
                    reqCb: (chunk: string, requirements: Set<string>) => void,
                  ) => {
                    const requirements = new Set<string>();
                    reqCb('chunk', requirements);
                  },
                },
              },
              addRuntimeModule: (
                _chunk: unknown,
                module: { generate: () => string },
              ) => {
                generateResult = module.generate();
              },
            };
            cb(compilation);
          },
        },
      },
    };

    plugin.apply(mockCompiler);
    expect(generateResult).toContain('__webpack_modules__');
    expect(generateResult).toContain(
      `
if (true) {
  globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')] = __webpack_modules__;
}`.trim(),
    );
  });

  it('ReactRefreshRspackPlugin intercept code generation in dev', () => {
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
    expect(generateResult).toContain('__webpack_modules__');
    expect(generateResult).toContain(`
if (true) {
  globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')] = __webpack_modules__;
}
`.trim());
  });

  it('ReactRefreshWebpackPlugin intercept code generation in production', () => {
    const plugin = new ReactRefreshWebpackPlugin();
    let generateResult = '';

    const mockCompiler = {
      options: { mode: 'production' },
      context: '/test',
      webpack: {
        EntryPlugin: class {
          apply() {
            /* noop */
          }
        },
        ProvidePlugin: class {
          apply() {
            /* noop */
          }
        },
        RuntimeGlobals: {
          interceptModuleExecution: 'interceptModuleExecution',
        },
        RuntimeModule: class {
          name: string;
          stage: number;
          constructor(name: string, stage: number) {
            this.name = name;
            this.stage = stage;
          }
        },
      },
      hooks: {
        compilation: {
          tap: (_name: string, cb: (compilation: unknown) => void) => {
            mockCompiler.options.mode = 'production';
            const compilation = {
              compiler: mockCompiler,
              mainTemplate: {
                hooks: {
                  localVars: {
                    tap: () => {
                      /* noop */
                    },
                  },
                },
              },
              hooks: {
                additionalTreeRuntimeRequirements: {
                  tap: (
                    _name: string,
                    reqCb: (chunk: string, requirements: Set<string>) => void,
                  ) => {
                    const requirements = new Set<string>();
                    reqCb('chunk', requirements);
                  },
                },
              },
              addRuntimeModule: (
                _chunk: unknown,
                module: { generate: () => string },
              ) => {
                generateResult = module.generate();
              },
            };
            cb(compilation);
          },
        },
      },
    };

    // Override the early return for testing the generation logic
    mockCompiler.options.mode = 'development';
    // @ts-expect-error test mock
    plugin.apply(mockCompiler);

    mockCompiler.options.mode = 'production';
    expect(generateResult).toContain(
      `
if (false) {
  globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')] = __webpack_modules__;
}`.trim(),
    );
  });

  it('ReactRefreshRspackPlugin intercept code generation in production', () => {
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
            mockCompiler.options.mode = 'production';
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

    mockCompiler.options.mode = 'development';
    // @ts-expect-error test mock
    plugin.apply(mockCompiler);

    mockCompiler.options.mode = 'production';

    expect(generateResult).toContain(`
if (false) {
  globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')] = __webpack_modules__;
}
`.trim());
  });
});
