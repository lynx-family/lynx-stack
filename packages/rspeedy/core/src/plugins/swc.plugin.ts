// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import {
  ES_ENV_TARGETS,
  getESVersionEnvInclude,
  getESVersionTarget,
} from '../utils/getESVersionTarget.js'

export function pluginSwc(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:swc',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const isProd = config.mode === 'production'
        return mergeRsbuildConfig(config, {
          tools: {
            swc(config) {
              // Rspeedy expresses the compilation baseline through `env`
              // (a high `targets` plus an explicit `include` transform list),
              // which is mutually exclusive with `jsc.target` in SWC. Rather
              // than silently dropping a user-configured `jsc.target`, surface
              // a clear error that points to the supported alternative.
              if (config.jsc?.target !== undefined) {
                throw new Error(
                  'Rspeedy manages the SWC compilation target via `env`, which '
                    + 'is mutually exclusive with `jsc.target`. Remove '
                    + '`tools.swc.jsc.target` (received '
                    + `\`${JSON.stringify(config.jsc.target)}\`). To downlevel `
                    + 'specific syntax, add the corresponding transforms to '
                    + '`tools.swc.env.include` instead (e.g. '
                    + '`[\'transform-class-properties\']`).',
                )
              }

              // Keep any transforms the user added via `tools.swc.env.include`
              // and merge them on top of Rspeedy's baseline. Rspeedy's
              // `targets` always win (the baseline is intentionally high so the
              // `include` list is canonical). Other `env` fields from the
              // bundler default (e.g. `mode`) are intentionally not carried
              // over, matching the previous `delete config.env` behavior.
              const userInclude = config.env?.include ?? []
              config.jsc ??= {}
              config.env = {
                targets: ES_ENV_TARGETS,
                include: [
                  ...getESVersionEnvInclude(getESVersionTarget(isProd)),
                  ...userInclude,
                ],
              }
            },
          },
        })
      })
    },
  }
}
