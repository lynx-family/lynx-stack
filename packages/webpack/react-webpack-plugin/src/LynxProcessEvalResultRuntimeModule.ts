// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RuntimeModule } from '@rspack/core';

import {
  RuntimeGlobals as LynxRuntimeGlobals,
  deriveLynxHostId,
} from '@lynx-js/webpack-runtime-globals';

type LynxProcessEvalResultRuntimeModule = new(
  lazyBundleFetcher?: 'FetchBundle' | 'QueryComponent',
) => RuntimeModule;

export function createLynxProcessEvalResultRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): LynxProcessEvalResultRuntimeModule {
  return class LynxProcessEvalResultRuntimeModule
    extends webpack.RuntimeModule
  {
    constructor(
      public lazyBundleFetcher?: 'FetchBundle' | 'QueryComponent',
    ) {
      super(
        'webpack/runtime/lynx process eval result',
        webpack.RuntimeModule.STAGE_ATTACH,
      );
    }

    override generate(): string {
      const chunk = this.chunk;
      const compilation = this.compilation!;

      if (!chunk || !compilation) {
        return '';
      }

      // FetchBundle registers under the compile-time host id — the same
      // derivation `LynxAsyncChunksRuntimeModule` (template-webpack-plugin)
      // emits as `lynx_hid` and chunk loading passes as a nested import's
      // `host`. QueryComponent keeps the legacy `globDynamicComponentEntry`
      // key its wrapper protocol provides.
      const hostKey = this.lazyBundleFetcher === 'FetchBundle'
        ? JSON.stringify(
          deriveLynxHostId(
            compilation.outputOptions?.uniqueName,
            chunk.runtime,
          ),
        )
        : 'globDynamicComponentEntry';

      // Also assign the deprecated single global for backward compatibility.
      return `
globalThis.processEvalResult = (${LynxRuntimeGlobals.lynxProcessEvalResultByHost} || (${LynxRuntimeGlobals.lynxProcessEvalResultByHost} = {}))[${hostKey}] = function (result, schema) {
  var chunk = result && result(schema);
  if (chunk && chunk.ids && chunk.modules) {
    // We only deal with webpack chunk
    ${webpack.RuntimeGlobals.externalInstallChunk}(chunk);
    // TODO: sort with preOrderIndex. See: https://github.com/web-infra-dev/rspack/pull/8588
    for (var moduleId in chunk.modules) {
      ${webpack.RuntimeGlobals.require}(moduleId);
    }
    return chunk;
  }
  return chunk
}
`;
    }
  };
}
