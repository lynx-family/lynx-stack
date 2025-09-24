// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mergeRsbuildConfig } from '@rsbuild/core'
import type { RsbuildMode } from '@rsbuild/core'

import { isDebug } from '../debug.js'
import type { Filename } from './output/filename.js'

import type { Config } from './index.js'

export function applyDefaultRspeedyConfig(config: Config): Config {
  // config.performance?.chunkSplit?.strategy has been explicitly set to a value other than 'all-in-one'
  const enableChunkSplitting = config.performance?.chunkSplit?.strategy
    && config.performance?.chunkSplit?.strategy !== 'all-in-one'

  return mergeRsbuildConfig({
    mode: ((): RsbuildMode => {
      if (config.mode) {
        return config.mode
      }
      const nodeEnv = process.env['NODE_ENV']
      return nodeEnv === 'production' || nodeEnv === 'development'
        ? nodeEnv
        : 'none'
    })(),
    output: {
      // We are applying the default filename to the config
      // since some plugin(e.g.: `@lynx-js/qrcode-rsbuild-plugin`) will read
      // from the `output.filename.bundle` field.
      filename: getFilename(config.output?.filename),

      // inlineScripts defaults to false when chunk splitting is enabled, true otherwise
      inlineScripts: !enableChunkSplitting,

      cssModules: {
        localIdentName: '[local]-[hash:base64:6]',
      },
    },

    performance: {
      profile: isDebug() ? true : undefined,
    },

    tools: {
      rsdoctor: {
        experiments: {
          enableNativePlugin: true,
        },
      },
    },
  }, config)
}

const DEFAULT_FILENAME = '[name].[platform].bundle'

function getFilename(filename: string | Filename | undefined): Filename {
  if (typeof filename === 'string') {
    return {
      bundle: filename,
      template: filename,
    }
  }

  const finalFilename = filename?.bundle
    ?? filename?.template
    ?? DEFAULT_FILENAME

  return {
    bundle: finalFilename,
    template: finalFilename,
  }
}
