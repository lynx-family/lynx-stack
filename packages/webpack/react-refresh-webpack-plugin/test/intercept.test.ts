// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from '@rstest/core';

import { ReactRefreshRspackPlugin } from '../src/ReactRefreshRspackPlugin.js';

describe('ReactRefresh plugins', () => {
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
    expect(generateResult).toContain(
      'globalThis[Symbol.for(\'__LYNX_WEBPACK_MODULES__\')] = __webpack_modules__;',
    );
  });
});
