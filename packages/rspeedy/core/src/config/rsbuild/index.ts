// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { ConsoleType, RsbuildConfig, SourceMap } from '@rsbuild/core'
import type { UndefinedOnPartialDeep } from 'type-fest'

import { toRsbuildEntry } from './entry.js'
import type { Config } from '../index.js'

// This is the default value from lynx-speedy.
// We may change it based on new benchmarks.
const defaultDataUriLimit = 2 * 1024

export function toRsbuildConfig(
  config: Config,
): UndefinedOnPartialDeep<RsbuildConfig> {
  return {
    provider: config.provider,
    dev: {
      watchFiles: config.dev?.watchFiles,
      // We expect to use different default writeToDisk with Rsbuild
      writeToDisk: config.dev?.writeToDisk ?? true,

      progressBar: config.dev?.progressBar ?? true,
    },
    environments: config.environments ?? { lynx: {} },
    mode: config.mode,
    output: {
      assetPrefix: config.output?.assetPrefix,

      charset: 'utf8',

      cleanDistPath: config.output?.cleanDistPath,

      copy: config.output?.copy,

      cssModules: config.output?.cssModules,

      // We expect to use different default dataUriLimit with Rsbuild
      dataUriLimit: config.output?.dataUriLimit ?? defaultDataUriLimit,

      distPath: config.output?.distPath,

      filenameHash: config.output?.filenameHash,

      // TODO(OSS): change the default value to `linked`(or `undefined`) when OSS.
      // We expect to use different default legalComments with Rsbuild
      legalComments: config.output?.legalComments ?? 'none',

      polyfill: 'off',

      // TODO: update the Rsbuild type to allow `sourceMap.js` to be `*-debugids`
      sourceMap: config.output?.sourceMap as SourceMap,
    },
    source: {
      alias: config.source?.alias,

      assetsInclude: config.source?.assetsInclude,

      decorators: config.source?.decorators,

      define: config.source?.define,

      entry: toRsbuildEntry(config.source?.entry),

      exclude: config.source?.exclude,

      include: config.source?.include,

      preEntry: config.source?.preEntry,

      transformImport: config.source?.transformImport,

      tsconfigPath: config.source?.tsconfigPath,
    },
    server: {
      base: config.server?.base,

      headers: config.server?.headers,

      host: config.server?.host,

      port: config.server?.port,

      strictPort: config.server?.strictPort,
    },
    plugins: config.plugins,
    performance: {
      buildCache: config.performance?.buildCache,

      chunkSplit: config.performance?.chunkSplit,

      profile: config.performance?.profile,

      removeConsole: toRsbuildRemoveConsole(config) as
        | ConsoleType[]
        | false
        | undefined,

      printFileSize: config.performance?.printFileSize ?? true,
    },
    tools: {
      bundlerChain: config.tools?.bundlerChain,

      cssExtract: config.tools?.cssExtract,

      cssLoader: config.tools?.cssLoader,

      htmlPlugin: false,

      rspack: config.tools?.rspack,

      swc: config.tools?.swc,
    },
  }
}

function toRsbuildRemoveConsole(config: Config): string[] | false | undefined {
  if (config.performance?.removeConsole === true) {
    // Lynx use console as a parameter in the runtime-wrapper
    // So we need to use all the console methods instead of `true` to make sure Rsbuild can remove all the console methods
    return ['log', 'warn', 'error', 'info', 'debug', 'profile', 'profileEnd']
  }

  return config.performance?.removeConsole
}
