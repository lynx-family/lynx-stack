// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Compiler } from '@rspack/core';
import type { TUpdateOptions } from '@rspack/test-tools';

export class TestHotUpdatePlugin {
  constructor(private updateOptions: TUpdateOptions) {}
  apply(compiler: Compiler): void {
    compiler.hooks.beforeRun.tap('TestHotUpdatePlugin', () => {
      compiler.modifiedFiles = new Set(this.updateOptions.changedFiles);
      this.updateOptions.changedFiles = [];
    });

    compiler.hooks.compilation.tap('TestHotUpdatePlugin', compilation => {
      compilation.hooks.additionalTreeRuntimeRequirements.tap(
        'HMR_TEST_PLUGIN',
        (_, set) => {
          set.add(compiler.webpack.RuntimeGlobals.moduleCache);
        },
      );
      compilation.hooks.runtimeModule.tap(
        'HMR_TEST_PLUGIN',
        (module) => {
          if (
            module.constructor.name === 'DefinePropertyGettersRuntimeModule'
          ) {
            module.source!.source = Buffer.from(
              `__webpack_require__.d = function (exports, definition) {
												for (var key in definition) {
														if (__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
																Object.defineProperty(exports, key, { configurable: true, enumerable: true, get: definition[key] });
														}
												}
										};
										`,
              'utf-8',
            );
          }
        },
      );
    });
  }
}
