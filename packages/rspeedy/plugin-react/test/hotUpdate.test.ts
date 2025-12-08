// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

vi.stubEnv('USE_RSPACK', 'true').stubEnv('NODE_ENV', 'development')

describe('hot update', () => {
  test('should prepend hot update runtime in development mode', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()
    expect(config.entry).toMatchInlineSnapshot(`
      {
        "main": {
          "filename": ".rspeedy/main/background.js",
          "import": [
            "@lynx-js/webpack-dev-transport/client",
            "@lynx-js/react/refresh",
            "@rspack/core/hot/dev-server",
            "./src/index.js",
          ],
          "layer": "react:background",
        },
        "main__main-thread": {
          "filename": ".rspeedy/main/main-thread.js",
          "import": [
            "<WORKSPACE>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
            "./src/index.js",
          ],
          "layer": "react:main-thread",
        },
      }
    `)
  })

  test('should prepend hot update runtime when liveReload is set to false', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        dev: {
          liveReload: false,
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()
    expect(config.entry).toMatchInlineSnapshot(`
      {
        "main": {
          "filename": ".rspeedy/main/background.js",
          "import": [
            "@lynx-js/webpack-dev-transport/client",
            "@lynx-js/react/refresh",
            "@rspack/core/hot/dev-server",
            "./src/index.js",
          ],
          "layer": "react:background",
        },
        "main__main-thread": {
          "filename": ".rspeedy/main/main-thread.js",
          "import": [
            "<WORKSPACE>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
            "./src/index.js",
          ],
          "layer": "react:main-thread",
        },
      }
    `)
  })

  test('should not prepend refresh runtime when hmr is set to false', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        dev: {
          hmr: false,
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()
    expect(config.entry).toMatchInlineSnapshot(`
      {
        "main": {
          "filename": ".rspeedy/main/background.js",
          "import": [
            "@lynx-js/webpack-dev-transport/client",
            "./src/index.js",
          ],
          "layer": "react:background",
        },
        "main__main-thread": {
          "filename": ".rspeedy/main/main-thread.js",
          "import": [
            "./src/index.js",
          ],
          "layer": "react:main-thread",
        },
      }
    `)
  })

  test('should not prepend dev runtime when hmr and liveReload is set to false both', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        dev: {
          hmr: false,
          liveReload: false,
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const [config] = await rsbuild.initConfigs()
    expect(config.entry).toMatchInlineSnapshot(`
      {
        "main": {
          "filename": ".rspeedy/main/background.js",
          "import": [
            "./src/index.js",
          ],
          "layer": "react:background",
        },
        "main__main-thread": {
          "filename": ".rspeedy/main/main-thread.js",
          "import": [
            "./src/index.js",
          ],
          "layer": "react:main-thread",
        },
      }
    `)
  })
})
