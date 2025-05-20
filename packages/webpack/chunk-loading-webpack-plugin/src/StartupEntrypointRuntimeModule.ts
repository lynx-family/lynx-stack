// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from 'webpack';

type StartupEntrypointRuntimeModule = new(
  asyncChunkLoading: boolean,
) => RuntimeModule;

const runtimeTemplateBasicFunction = (args: string, body: string[]) => {
  return `(${args}) => {\n${body.join('\n')}\n}`;
};

const runtimeTemplateReturningFunction = (returnValue: string, args = '') => {
  return `(${args}) => (${returnValue})`;
};

export function createStartupEntrypointRuntimeModule(
  webpack: typeof import('webpack'),
): StartupEntrypointRuntimeModule {
  const { RuntimeGlobals, RuntimeModule } = webpack;
  return class StartupEntrypointRuntimeModule extends RuntimeModule {
    asyncChunkLoading: boolean;

    constructor(asyncChunkLoading: boolean) {
      super('Lynx startup entrypoint', RuntimeModule.STAGE_ATTACH);
      this.asyncChunkLoading = asyncChunkLoading;
    }

    override generate(): string {
      return `${RuntimeGlobals.startupEntrypoint} = ${
        runtimeTemplateBasicFunction('result, chunkIds, fn', [
          '// arguments: chunkIds, moduleId are deprecated',
          'var moduleId = chunkIds;',
          `if(!fn) chunkIds = result, fn = ${
            runtimeTemplateReturningFunction(
              `${RuntimeGlobals.require}(${RuntimeGlobals.entryModuleId} = moduleId)`,
            )
          };`,
          ...(this.asyncChunkLoading
            ? [
              `return Promise.all(chunkIds.map(${RuntimeGlobals.ensureChunk}, ${RuntimeGlobals.require})).then(${
                runtimeTemplateBasicFunction('', [
                  'var r = fn();',
                  'return r === undefined ? result : r;',
                ])
              })`,
            ]
            : [
              `chunkIds.map(${RuntimeGlobals.ensureChunk}, ${RuntimeGlobals.require})`,
              'var r = fn();',
              'return r === undefined ? result : r;',
            ]),
        ])
      }`;
    }
  };
}
