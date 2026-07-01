// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

rstest.stubEnv('USE_RSPACK', 'true').stubEnv('NODE_ENV', 'development')

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
            "<ROOT>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
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
            "<ROOT>/packages/webpack/css-extract-webpack-plugin/runtime/hotModuleReplacement.lepus.cjs",
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

  // `@rsbuild/core/dist/client/hmr.js` is injected by the dev server, so it
  // only shows up in the emitted bundles, not the resolved config.
  test(
    'web dev output uses the Lynx HMR runtime, not the Rsbuild web client',
    async () => {
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-hmr-'))

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  './fixtures/special-var-name/index.jsx',
                  import.meta.url,
                ),
              ),
            },
          },
          environments: {
            lynx: {},
            web: {},
          },
          output: {
            distPath: { root: tmp },
            filenameHash: false,
          },
          plugins: [
            pluginReactLynx(),
          ],
        },
      })

      const firstCompile = new Promise<void>(resolve => {
        rsbuild.onDevCompileDone(({ isFirstCompile }) => {
          if (isFirstCompile) {
            resolve()
          }
        })
      })

      // Only `createDevServer` injects the HMR client, not `build`.
      const server = await rsbuild.createDevServer()

      try {
        await firstCompile

        const read = (relativePath: string) =>
          readFile(path.join(tmp, relativePath), 'utf-8')

        const bundles = [
          {
            mainThread: 'main/main-thread.js',
            background: 'main/background.js',
          }, // web
          {
            mainThread: '.rspeedy/main/main-thread.js',
            background: '.rspeedy/main/background.js',
          }, // lynx
        ]

        for (const { mainThread, background } of bundles) {
          const mainThreadJS = await read(mainThread)
          const backgroundJS = await read(background)

          // No Rsbuild web HMR client.
          expect(mainThreadJS).not.toContain('@rsbuild/core/dist/client/hmr.js')
          expect(backgroundJS).not.toContain('@rsbuild/core/dist/client/hmr.js')

          // Lynx HMR runtime instead.
          expect(mainThreadJS).toContain('hotModuleReplacement.lepus.cjs')
          expect(backgroundJS).toContain('webpack-dev-transport')
        }
      } finally {
        await server.close()
        await rm(tmp, { recursive: true, force: true })
      }
    },
    60_000,
  )
})
