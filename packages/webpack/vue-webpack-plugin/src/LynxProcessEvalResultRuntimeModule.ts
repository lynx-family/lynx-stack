// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RuntimeModule } from '@rspack/core';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

type LynxProcessEvalResultRuntimeModule = new() => RuntimeModule;

export function createLynxProcessEvalResultRuntimeModule(
  webpack: typeof import('@rspack/core').rspack,
): LynxProcessEvalResultRuntimeModule {
  return class LynxProcessEvalResultRuntimeModule
    extends webpack.RuntimeModule
  {
    constructor() {
      super('Lynx process eval result', webpack.RuntimeModule.STAGE_ATTACH);
    }

    override generate(): string {
      const chunk = this.chunk;
      const compilation = this.compilation!;

      if (!chunk || !compilation) {
        return '';
      }

      return `
${LynxRuntimeGlobals.lynxProcessEvalResult} = function (result, schema) {
  var chunk = result(schema);
  if (chunk.ids && chunk.modules) {
    // We only deal with webpack chunk
    ${webpack.RuntimeGlobals.externalInstallChunk}(chunk);
    // TODO: sort with preOrderIndex. See: https://github.com/web-infra-dev/rspack/pull/8588
    for (var moduleId in chunk.modules) {
      ${webpack.RuntimeGlobals.require}(moduleId);
    }
    return chunk;
  }
}
`;
    }
  };
}
