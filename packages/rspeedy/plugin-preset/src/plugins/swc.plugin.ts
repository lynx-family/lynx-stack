// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import {
  ES_ENV_TARGETS,
  getESVersionEnvInclude,
} from '../utils/getESVersionTarget.js'

export function pluginSwc(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:swc',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          tools: {
            swc(config) {
              // `env` and `jsc.target` are mutually exclusive in SWC. Reject a
              // user-set `jsc.target` instead of silently dropping it.
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

              config.env = {
                ...config.env,
                targets: ES_ENV_TARGETS,
                include: [
                  // Lower `let`/`const` to `var`; QuickJS parses `var` faster.
                  // Listing it in `env.exclude` opts out (exclude > include).
                  'transform-block-scoping',
                  ...getESVersionEnvInclude(),
                  ...(config.env?.include ?? []),
                ],
              }
            },
          },
        })
      })
    },
  }
}
