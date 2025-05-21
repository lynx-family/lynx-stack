// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mergeRsbuildConfig } from '@rsbuild/core'

import type { Filename } from './output/filename.js'

import type { Config } from './index.js'

export function applyDefaultRspeedyConfig(config: Config): Config {
  const ret = mergeRsbuildConfig({
    output: {
      // We are applying the default filename to the config
      // since some plugin(e.g.: `@lynx-js/qrcode-rsbuild-plugin`) will read
      // from the `output.filename.bundle` field.
      filename: getFilename(config.output?.filename),

      // inlineScripts should be enabled by default
      inlineScripts: true,
    },

    tools: {
      rsdoctor: {
        experiments: {
          enableNativePlugin: true,
        },
      },
    },
  }, config)

  return ret
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
