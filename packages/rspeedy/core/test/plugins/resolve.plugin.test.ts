// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

describe('Plugins - Resolve', () => {
  test('defaults', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    expect(config.resolve).toMatchInlineSnapshot(`
      {
        "alias": {
          "@swc/helpers": "<ROOT>/node_modules/<PNPM_INNER>/@swc/helpers",
        },
        "aliasFields": [
          "browser",
        ],
        "conditionNames": [
          "lynx",
          "import",
          "require",
          "browser",
        ],
        "extensionAlias": {
          ".js": [
            ".js",
            ".ts",
            ".tsx",
          ],
          ".jsx": [
            ".jsx",
            ".tsx",
          ],
        },
        "extensions": [
          ".ts",
          ".tsx",
          ".mjs",
          ".js",
          ".jsx",
          ".json",
          ".cjs",
        ],
        "mainFields": [
          "lynx",
          "module",
          "main",
        ],
        "mainFiles": [
          "index.lynx",
          "index",
        ],
        "tsConfig": {
          "configFile": "<ROOT>/tsconfig.json",
          "references": "auto",
        },
      }
    `)
  })

  test('source.alias', async () => {
    const rsbuild = await createStubRspeedy({
      source: {
        alias: {
          foo: 'path/to/foo',
          bar$: 'bar.jsx',
          'react': ['@lynx-js/react', 'react'],
          ignored: false,
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    expect(config.resolve?.alias).toMatchInlineSnapshot(`
      {
        "@swc/helpers": "<ROOT>/node_modules/<PNPM_INNER>/@swc/helpers",
        "bar$": "bar.jsx",
        "foo": "path/to/foo",
        "ignored": false,
        "react": [
          "@lynx-js/react",
          "react",
        ],
      }
    `)
  })
})
