// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger, mergeRsbuildConfig } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'

import type {
  RsdoctorRspackPluginOptions,
  Tools,
} from '../config/tools/index.js'
import { isCI } from '../utils/is-ci.js'

export function pluginRsdoctor(
  options?: Tools['rsdoctor'],
): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:rsdoctor',
    remove: ['rsbuild:rsdoctor'],

    setup(api) {
      if (process.env['RSDOCTOR'] !== 'true') {
        return
      }

      api.onBeforeCreateCompiler(async ({ bundlerConfigs }) => {
        const { RsdoctorRspackPlugin } = await import('@rsdoctor/rspack-plugin')

        for (const config of bundlerConfigs) {
          const pluginName = 'RsdoctorRspackPlugin'

          const registered = config.plugins?.some(
            (plugin) =>
              (typeof plugin === 'object'
                && plugin?.['isRsdoctorPlugin'] === true)
              || plugin?.constructor?.name === pluginName,
          )

          if (registered) {
            continue
          }

          config.plugins ??= []

          const defaultOptions: RsdoctorRspackPluginOptions = {
            // We disable client server on CI by default.
            // But it can be overridden by `tools.rsdoctor`.
            disableClientServer: isCI(),

            supports: {
              banner: true, // We must enable `supports.banner` since we have runtime wrapper enabled
            },

            linter: {
              rules: {
                'ecma-version-check':
                  options?.linter?.rules?.['ecma-version-check'] ?? [
                    'Warn',
                    { ecmaVersion: 2019 },
                  ],
              },
            },
          }

          config.plugins.push(
            new RsdoctorRspackPlugin(
              mergeRsbuildConfig(defaultOptions, options),
            ),
          )
        }
        logger.info(`Rsdoctor is enabled.`)
      })
    },
  }
}
