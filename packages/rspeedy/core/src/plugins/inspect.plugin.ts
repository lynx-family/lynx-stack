// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { mkdir, writeFile } from 'node:fs/promises'
import path, { dirname } from 'node:path'

import { logger } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'
import { stringify } from 'javascript-stringify'
import color from 'picocolors'

import type { Config } from '../config/index.js'
import { DEFAULT_DIST_PATH_INTERMEDIATE } from '../config/output/dist-path.js'
import { debug } from '../debug.js'

export function pluginInspect(config: Config): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:inspect',
    setup(api) {
      api.onBeforeBuild(async () => {
        await inspectRspeedyConfig(
          config,
          /** path */ path.join(
            api.context.distPath,
            DEFAULT_DIST_PATH_INTERMEDIATE,
            'rspeedy.config.js',
          ),
          /** verbose */ false,
        )
      })
    },
  }
}

export async function inspectRspeedyConfig(
  config: Config,
  path: string,
  verbose: boolean,
): Promise<void> {
  const stringifiedConfig = stringify(
    config,
    (value: string | (() => unknown), _, stringify) => {
      if (
        typeof value === 'function' && !verbose && value.toString().length > 100
      ) {
        return `function () { /* omitted long function */ }`
      }
      return stringify(value)
    },
    2,
  )

  if (!stringifiedConfig) {
    debug('No Rspeedy config found, skip inspect config.')
    return
  }
  await mkdir(dirname(path), { recursive: true })

  await writeFile(path, `export default ${stringifiedConfig}`)

  logger.success(
    `Inspect Rspeedy config succeed, open following files to view the content: \n\n  - ${
      color.bold(color.yellow('Rspeedy'))
    }: ${color.underline(path)}\n`,
  )
}
