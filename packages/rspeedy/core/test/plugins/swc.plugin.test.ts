// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
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
          "collectTypeScriptInfo": {
            "exportedEnum": true,
            "typeExports": true,
          },
          "detectSyntax": "auto",
          "env": {
            "include": [
              "transform-block-scoping",
              "transform-async-generator-functions",
              "transform-dotall-regex",
              "transform-named-capturing-groups-regex",
              "transform-object-rest-spread",
              "transform-unicode-property-regex",
              "transform-json-strings",
              "transform-optional-catch-binding",
              "transform-nullish-coalescing-operator",
              "transform-optional-chaining",
              "transform-export-namespace-from",
              "transform-logical-assignment-operators",
              "transform-numeric-separator",
              "transform-class-properties",
              "transform-class-static-block",
              "transform-private-methods",
              "transform-private-property-in-object",
            ],
            "targets": {
              "chrome": "120",
            },
          },
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<ROOT>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
            },
            "transform": {
              "decoratorVersion": "2023-11",
              "legacyDecorator": false,
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
          "collectTypeScriptInfo": {
            "exportedEnum": false,
            "typeExports": true,
          },
          "detectSyntax": "auto",
          "env": {
            "include": [
              "transform-block-scoping",
              "transform-async-generator-functions",
              "transform-dotall-regex",
              "transform-named-capturing-groups-regex",
              "transform-object-rest-spread",
              "transform-unicode-property-regex",
              "transform-json-strings",
              "transform-optional-catch-binding",
              "transform-nullish-coalescing-operator",
              "transform-optional-chaining",
              "transform-export-namespace-from",
              "transform-logical-assignment-operators",
              "transform-numeric-separator",
              "transform-class-properties",
              "transform-class-static-block",
              "transform-private-methods",
              "transform-private-property-in-object",
            ],
            "targets": {
              "chrome": "120",
            },
          },
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<ROOT>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
            },
            "transform": {
              "decoratorVersion": "2023-11",
              "legacyDecorator": false,
            },
          },
        }
      `)
  })

  test('user-configured jsc.target throws (target is managed via env)', async () => {
    const rsbuild = await createStubRspeedy({
      tools: {
        swc: {
          jsc: {
            target: 'es5',
          },
        },
      },
    })

    // `env` and `jsc.target` are mutually exclusive in SWC. Rspeedy controls
    // the baseline via `env`, so a user-set `jsc.target` is rejected with a
    // clear error rather than silently dropped.
    await expect(rsbuild.unwrapConfig()).rejects.toThrowError(
      /Rspeedy manages the SWC compilation target via `env`/,
    )
  })

  test('user can opt out of transform-block-scoping via env.exclude', async () => {
    const rsbuild = await createStubRspeedy({
      mode: 'production',
      tools: {
        swc: {
          env: {
            exclude: ['transform-block-scoping'],
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    // SWC's `env.exclude` wins over `include`, so forwarding the user's
    // exclude opts out of the let/const → var lowering.
    expect(loaderOptions?.env?.exclude).toEqual(['transform-block-scoping'])
    expect(loaderOptions?.env?.include).toContain(
      'transform-async-generator-functions',
    )
  })

  test('user-configured env.include is merged onto the baseline', async () => {
    const rsbuild = await createStubRspeedy({
      mode: 'production',
      tools: {
        swc: {
          env: {
            // Extra transform the user opts into (e.g. lower let/const to var).
            include: ['transform-block-scoping'],
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    // The user's transform is honored ...
    expect(loaderOptions?.env?.include).toContain('transform-block-scoping')
    // ... on top of Rspeedy's ES2017-equivalent baseline ...
    expect(loaderOptions?.env?.include).toContain(
      'transform-async-generator-functions',
    )
    // ... and Rspeedy still owns `targets`.
    expect(loaderOptions?.env?.targets).toEqual({ chrome: '120' })
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
          "collectTypeScriptInfo": {
            "exportedEnum": false,
            "typeExports": true,
          },
          "detectSyntax": "auto",
          "env": {
            "include": [
              "transform-block-scoping",
              "transform-async-generator-functions",
              "transform-dotall-regex",
              "transform-named-capturing-groups-regex",
              "transform-object-rest-spread",
              "transform-unicode-property-regex",
              "transform-json-strings",
              "transform-optional-catch-binding",
              "transform-nullish-coalescing-operator",
              "transform-optional-chaining",
              "transform-export-namespace-from",
              "transform-logical-assignment-operators",
              "transform-numeric-separator",
              "transform-class-properties",
              "transform-class-static-block",
              "transform-private-methods",
              "transform-private-property-in-object",
            ],
            "targets": {
              "chrome": "120",
            },
          },
          "isModule": "unknown",
          "jsc": {
            "experimental": {
              "cacheRoot": "<ROOT>/node_modules/.cache/.swc",
              "keepImportAttributes": true,
            },
            "externalHelpers": true,
            "output": {
              "charset": "utf8",
            },
            "parser": {
              "decorators": true,
            },
            "transform": {
              "decoratorVersion": "2023-11",
              "legacyDecorator": false,
            },
          },
          "minify": true,
        }
      `)
  })
})
