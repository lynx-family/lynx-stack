/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import type { Chunk, Compilation, Module } from 'webpack';

import { RuntimeGlobals as LynxRuntimeGlobals } from '@lynx-js/webpack-runtime-globals';

export const MODULE_TYPE = 'css/mini-extract';

export function generateFromTemplate(
  webpack: typeof import('webpack'),
  runtime: () => void,
): string {
  const { Template, RuntimeGlobals: WebpackRuntimeGlobals } = webpack;

  const RuntimeGlobals = Object.assign(
    {},
    WebpackRuntimeGlobals,
    LynxRuntimeGlobals,
  );
  return Template.getFunctionContent(runtime).replace(
    /\$RuntimeGlobals_(\w+)\$/g,
    (_, name: keyof typeof RuntimeGlobals) => RuntimeGlobals[name],
  );
}

export function compareIds(a: string, b: string): number {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

export function compareModulesByIdentifier(a: Module, b: Module): number {
  return compareIds(a.identifier(), b.identifier());
}

export const getCssChunkObject = (
  mainChunk: Chunk,
  compilation: Compilation,
): Record<string, number> => {
  const obj: Record<string, number> = {};
  const { chunkGraph } = compilation;

  for (const chunk of mainChunk.getAllAsyncChunks()) {
    // MiniCssExtractPlugin uses `chunkGraph.getOrderedChunkModulesIterable`
    // but it does not exist on Rspack.
    const modules = chunkGraph.getChunkModules(chunk);

    modules.sort(compareModulesByIdentifier);

    for (const module of modules) {
      if (module.type === MODULE_TYPE) {
        obj[chunk.id as string] = 1;
        break;
      }
    }
  }

  return obj;
};
