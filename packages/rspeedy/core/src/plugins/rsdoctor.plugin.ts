// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'

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
        const pendingConfigs = bundlerConfigs.filter(config =>
          !config.plugins?.some(plugin =>
            (typeof plugin === 'object'
              && plugin?.['isRsdoctorPlugin'] === true)
            || plugin?.constructor?.name === 'RsdoctorRspackPlugin'
          )
        )
        if (pendingConfigs.length === 0) return

        const [major = 0, minor = 0] = process.versions.node.split('.').map(
          Number,
        )
        if (major < 22 || (major === 22 && minor < 18)) {
          throw new Error(
            'Rsdoctor 2.0 requires Node.js >=22.18. Upgrade Node.js, unset RSDOCTOR, '
              + 'or install @rsdoctor/rspack-plugin@1 and register RsdoctorRspackPlugin '
              + 'through tools.rspack with supports.banner: true.',
          )
        }

        const installMessage =
          'Rsdoctor 2.0 is unavailable. Install @rsdoctor/core@2.0.0-beta.1 '
          + 'without omitting optional dependencies, or unset RSDOCTOR.'

        // Resolve separately so errors inside the plugin are not reported as missing packages.
        try {
          createRequire(import.meta.url).resolve('@rsdoctor/core')
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'MODULE_NOT_FOUND') {
            throw error
          }
          throw new Error(installMessage, { cause: error })
        }
        const { RsdoctorRspackPlugin } = await import('@rsdoctor/core')
        if (typeof RsdoctorRspackPlugin !== 'function') {
          throw new Error(installMessage)
        }

        for (const config of pendingConfigs) {
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
            // Normalize the simplified config type at the plugin boundary.
            new RsdoctorRspackPlugin(
              mergeRsbuildConfig(
                defaultOptions,
                options,
              ) as unknown as ConstructorParameters<
                typeof RsdoctorRspackPlugin<[]>
              >[0],
            ),
          )
        }
        logger.info(`Rsdoctor is enabled.`)
      })
    },
  }
}
