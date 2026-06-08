// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'

import { DEFAULT_DIST_PATH_INTERMEDIATE } from '../config/output/dist-path.js'
import type { DistPath } from '../config/output/dist-path.js'
import type { Filename } from '../config/output/filename.js'
import type { Output } from '../config/output/index.js'

const defaultFilenameOptions: Readonly<
  Required<Pick<Filename, 'css'>>
> = Object.freeze({
  css: '[name]/[name].css',
})

const defaultDistPathOptions = Object.freeze(
  {
    // We override the default value of Rsbuild(`static/css`) here.
    // Since all the CSS should be encoded into the template in Lynx.
    css: DEFAULT_DIST_PATH_INTERMEDIATE,
  } satisfies DistPath,
)

export function pluginOutput(options?: Output): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:output',
    setup(api) {
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        // Default bundler-generated runtime / wrapper code to `var` (QuickJS
        // parses it faster than `const`/`let`); the SWC `transform-block-scoping`
        // pass handles user source separately. Placed first so user-provided
        // `tools.rspack.output.environment.const` can opt out.
        const lowerToVar: RsbuildConfig = {
          tools: { rspack: { output: { environment: { const: false } } } },
        }

        if (!options) {
          return mergeRsbuildConfig(
            lowerToVar,
            {
              output: {
                filename: {
                  css: defaultFilenameOptions.css!,
                },
              },
            },
            config,
          )
        }

        return mergeRsbuildConfig(lowerToVar, config, {
          output: {
            distPath: Object.assign(
              {},
              defaultDistPathOptions,
              options.distPath,
            ),
            filename: Object.assign(
              {},
              defaultFilenameOptions,
              options.filename,
            ) as Required<Required<RsbuildConfig>['output']>['filename'],
          },
        })
      })
    },
  }
}
