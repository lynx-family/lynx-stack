// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RuntimeModule } from 'webpack';

type StartupChunkDependenciesRuntimeModule = new(
  asyncChunkLoading: boolean,
) => RuntimeModule;

const runtimeTemplateBasicFunction = (args: string, body: string[]) => {
  return `(${args}) => {\n${body.join('\n')}\n}`;
};

export function createStartupChunkDependenciesRuntimeModule(
  webpack: typeof import('webpack'),
): StartupChunkDependenciesRuntimeModule {
  const { RuntimeGlobals, RuntimeModule, Template } = webpack;
  return class StartupChunkDependenciesRuntimeModule extends RuntimeModule {
    asyncChunkLoading: boolean;

    constructor(asyncChunkLoading: boolean) {
      super('Lynx startup chunk dependencies', RuntimeModule.STAGE_ATTACH);
      this.asyncChunkLoading = asyncChunkLoading;
    }

    override generate(): string {
      const chunkGraph = this.chunkGraph!;
      const chunk = this.chunk!;
      const chunkIds = Array.from(
        chunkGraph.getChunkEntryDependentChunksIterable(chunk),
      ).map(chunk => chunk.id);
      let startupCode: string[];

      if (this.asyncChunkLoading === false) {
        startupCode = chunkIds
          .map(id => `${RuntimeGlobals.ensureChunk}(${JSON.stringify(id)});`)
          .concat('return next();');
        // lazy bundle can't exports Promise
        // TODO: handle Promise in lazy bundle exports to support chunk splitting
      } else if (chunkIds.length === 0) {
        startupCode = ['return next();'];
      } else if (chunkIds.length === 1) {
        startupCode = [
          `return ${RuntimeGlobals.ensureChunk}(${
            JSON.stringify(chunkIds[0])
          }).then(next);`,
        ];
      } else if (chunkIds.length > 2) {
        startupCode = [
          `return Promise.all(${
            JSON.stringify(chunkIds)
          }.map(${RuntimeGlobals.ensureChunk}, ${RuntimeGlobals.require})).then(next);`,
        ];
      } else {
        startupCode = [
          'return Promise.all([',
          Template.indent(
            chunkIds.map(id =>
              `${RuntimeGlobals.ensureChunk}(${JSON.stringify(id)})`
            ).join(',\n'),
          ),
          ']).then(next);',
        ];
      }

      return Template.asString([
        `var next = ${RuntimeGlobals.startup};`,
        `${RuntimeGlobals.startup} = ${
          runtimeTemplateBasicFunction(
            '',
            startupCode,
          )
        };`,
      ]);
    }
  };
}
