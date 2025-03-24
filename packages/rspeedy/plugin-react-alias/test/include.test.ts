// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRsbuild } from '@rsbuild/core'
import type { Rspack } from '@rsbuild/core'
import { describe, expect, it } from 'vitest'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

import { pluginReactAlias } from '../src/index.js'

// The Default JS RegExp of Rsbuild
const SCRIPT_REGEXP = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/

describe('React - Include', () => {
  it('should include react', async () => {
    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({ LAYERS }),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(config).not.toBeNull()

    const swcRule = config?.module?.rules?.find(
      (rule): rule is Rspack.RuleSetRule => {
        return !!(rule && rule !== '...'
          && (rule.test as RegExp | undefined)?.toString()
            === SCRIPT_REGEXP.toString())
      },
    )

    expect(swcRule?.include).toMatchInlineSnapshot(`
      [
        {
          "and": [
            "<WORKSPACE>",
            {
              "not": /\\[\\\\\\\\/\\]node_modules\\[\\\\\\\\/\\]/,
            },
          ],
        },
        /\\\\\\.\\(\\?:ts\\|tsx\\|jsx\\|mts\\|cts\\)\\$/,
        "<WORKSPACE>/packages/react",
      ]
    `)
  })
})
