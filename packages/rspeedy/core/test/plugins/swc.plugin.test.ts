// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'
import { getLoaderOptions } from '../getLoaderOptions.js'

describe('Plugins - SWC', () => {
  test('defaults', async () => {
    const rsbuild = await createStubRspeedy({
      mode: 'production',
    })

    const config = await rsbuild.unwrapConfig()

    expect(getLoaderOptions(config, 'builtin:swc-loader'))
      .toMatchInlineSnapshot(`
        {
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<WORKSPACE>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
              "syntax": "typescript",
              "tsx": false,
            },
            "target": "es2015",
            "transform": {
              "decoratorVersion": "2022-03",
              "legacyDecorator": false,
            },
          },
          "rspackExperiments": {
            "collectTypeScriptInfo": {
              "exportedEnum": true,
              "typeExports": true,
            },
          },
        }
      `)
  })

  test('defaults development', async () => {
    const rsbuild = await createStubRspeedy({
      mode: 'development',
    })

    const config = await rsbuild.unwrapConfig()

    expect(getLoaderOptions(config, 'builtin:swc-loader'))
      .toMatchInlineSnapshot(`
        {
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<WORKSPACE>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
              "syntax": "typescript",
              "tsx": false,
            },
            "target": "es2019",
            "transform": {
              "decoratorVersion": "2022-03",
              "legacyDecorator": false,
            },
          },
          "rspackExperiments": {
            "collectTypeScriptInfo": {
              "exportedEnum": false,
              "typeExports": true,
            },
          },
        }
      `)
  })

  test('modify swc config from plugin', async () => {
    const rsbuild = await createStubRspeedy({
      plugins: [
        {
          name: 'test:swc',
          setup(api: RsbuildPluginAPI) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
              return mergeRsbuildConfig(config, {
                tools: {
                  swc(config) {
                    config.minify = true
                    return config
                  },
                },
              })
            })
          },
        },
      ],
    })

    const config = await rsbuild.unwrapConfig()

    expect(getLoaderOptions(config, 'builtin:swc-loader'))
      .toMatchInlineSnapshot(`
        {
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<WORKSPACE>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
              "syntax": "typescript",
              "tsx": false,
            },
            "target": "es2019",
            "transform": {
              "decoratorVersion": "2022-03",
              "legacyDecorator": false,
            },
          },
          "minify": true,
          "rspackExperiments": {
            "collectTypeScriptInfo": {
              "exportedEnum": false,
              "typeExports": true,
            },
          },
        }
      `)
  })
})
