// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'

import type { RsbuildPlugin } from '@rsbuild/core'

import {
  ES_ENV_TARGETS,
  getESVersionEnvInclude,
} from '../utils/getESVersionTarget.js'

const CORE_JS = /[\\/]node_modules[\\/]core-js[\\/]/
const BUILTIN_INCLUDES = ['es.object.has-own']
const HAS_OWN_POLYFILL = 'core-js/modules/es.object.has-own.js'

export function pluginSwc(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:swc',
    setup(api) {
      api.modifyBundlerChain((chain, { environment }) => {
        const { name } = environment
        if (
          !(name === 'lynx' || name.startsWith('lynx-'))
          || chain.resolve.fallback.has(HAS_OWN_POLYFILL)
        ) {
          return
        }
        // Resolve the engine's shim when the application has no core-js.
        chain.resolve.fallback.set(
          HAS_OWN_POLYFILL,
          createRequire(import.meta.url).resolve(HAS_OWN_POLYFILL),
        )
      })

      api.modifyEnvironmentConfig({
        order: 'post',
        handler(config, { name, mergeEnvironmentConfig }) {
          const isLynx = name === 'lynx' || name.startsWith('lynx-')
          if (isLynx) {
            // Do not inject polyfills into core-js's own implementation.
            config.source.exclude = [
              ...new Set([...(config.source.exclude ?? []), CORE_JS]),
            ]
          }

          return mergeEnvironmentConfig(config, {
            tools: {
              swc(config) {
                // `env` and `jsc.target` are mutually exclusive in SWC. Reject a
                // user-set `jsc.target` instead of silently dropping it.
                if (config.jsc?.target !== undefined) {
                  throw new Error(
                    'Rspeedy manages the SWC compilation target via `env`, which '
                      + 'is mutually exclusive with `jsc.target`. Remove '
                      + '`tools.swc.jsc.target` (received '
                      + `\`${
                        JSON.stringify(config.jsc.target)
                      }\`). To downlevel `
                      + 'specific syntax, add the corresponding transforms to '
                      + '`tools.swc.env.include` instead (e.g. '
                      + '`[\'transform-class-properties\']`).',
                  )
                }

                config.env = {
                  ...config.env,
                  targets: ES_ENV_TARGETS,
                  // A `Set`, so applying the engine more than once to the same
                  // environment does not repeat the transforms.
                  include: [
                    ...new Set([
                      // Lower `let`/`const` to `var`; QuickJS parses `var`
                      // faster. Listing it in `env.exclude` opts out
                      // (exclude > include).
                      'transform-block-scoping',
                      ...getESVersionEnvInclude(),
                      ...(config.env?.include ?? []),
                      // Browser syntax targets do not describe Lynx API gaps.
                      // Explicit builtin includes win over SWC excludes.
                      ...isLynx
                        ? BUILTIN_INCLUDES.filter(feature =>
                          !config.env?.exclude?.includes(feature)
                        )
                        : [],
                    ]),
                  ],
                }
              },
            },
          })
        },
      })
    },
  }
}
