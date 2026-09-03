// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'

import { getLynxConfig } from '../config.js'

type OutputConfig = NonNullable<RsbuildConfig['output']>

export function pluginOutput(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:output',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) =>
        mergeRsbuildConfig(
          {
            // Default bundler-generated runtime / wrapper code to `var`
            // (QuickJS parses it faster than `const`/`let`); the SWC
            // `transform-block-scoping` pass handles user source separately.
            // Placed first so user-provided
            // `tools.rspack.output.environment.const` can opt out.
            tools: {
              // Lynx does not use HTML.
              htmlPlugin: false,
              rspack: { output: { environment: { const: false } } },
            },
          },
          config,
        )
      )

      api.modifyEnvironmentConfig(
        (config, { name, mergeEnvironmentConfig }) => {
          const original = api.getRsbuildConfig('original')
          // A value set on the environment wins over the same value set at the
          // root, which is how Rsbuild merges the two.
          const outputs = [
            original.environments?.[name]?.output,
            original.output,
          ]
          return mergeEnvironmentConfig(config, {
            output: {
              distPath: {
                // We override the default value of Rsbuild(`static/css`) here.
                // Since all the CSS should be encoded into the template in
                // Lynx.
                css: pick(outputs, (output) =>
                  typeof output.distPath === 'object'
                    ? output.distPath.css
                    : undefined) ?? getLynxConfig(api).resolveIntermediateDir(),
              },
              filename: {
                css: pick(outputs, (output) =>
                  output.filename?.css)
                  ?? '[name]/[name].css',
              },
              // A Lynx bundle has nowhere to link a separate license file to.
              legalComments: pick(outputs, (output) =>
                output.legalComments)
                ?? 'none',
            },
          })
        },
      )
    },
  }
}

function pick<T>(
  outputs: (OutputConfig | undefined)[],
  get: (output: OutputConfig) => T | undefined,
): T | undefined {
  for (const output of outputs) {
    const value = output === undefined ? undefined : get(output)
    if (value !== undefined) return value
  }
  return undefined
}
