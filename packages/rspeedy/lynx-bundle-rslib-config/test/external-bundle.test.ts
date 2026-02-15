// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRslib } from '@rslib/core'
import type { RslibConfig } from '@rslib/core'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { LAYERS, pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'

import { decodeTemplate } from './utils.js'
import { defineExternalBundleRslibConfig } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function build(rslibConfig: RslibConfig) {
  const rslib = await createRslib({
    config: rslibConfig,
    cwd: __dirname,
  })
  return await rslib.build()
}

describe('define config', () => {
  it('should return entry config', () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
    })
    expect(rslibConfig.lib[0]?.source).toMatchObject({
      entry: {
        utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
      },
    })
  })

  it('should override default lib config', () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      syntax: 'es2019',
    })
    expect(rslibConfig.lib[0]?.syntax).toBe('es2019')
  })
})

describe('should build external bundle', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  it('should build both main-thread and background code into external bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-dual',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-dual.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
  })

  it('should only build main-thread code into external bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: {
            import: path.join(__dirname, './fixtures/utils-lib/index.ts'),
            layer: LAYERS.MAIN_THREAD,
          },
        },
      },
      id: 'utils-m',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-m.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections'])).toEqual([
      'utils',
    ])
    expect(decodedResult['custom-sections']['utils']?.includes('.define('))
      .toBeFalsy()
  })

  it('should only build background code into external bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: {
            import: path.join(__dirname, './fixtures/utils-lib/index.ts'),
            layer: LAYERS.BACKGROUND,
          },
        },
      },
      id: 'utils-b',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-b.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections'])).toEqual([
      'utils',
    ])
    expect(decodedResult['custom-sections']['utils']?.includes('.define('))
      .toBeTruthy()
  })

  it('set engineVersion to 3.5', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-engineVersion-35',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
      },
      plugins: [pluginReactLynx()],
    }, {
      engineVersion: '3.5',
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-engineVersion-35.lynx.bundle'),
    )
    expect(decodedResult['engine-version']).toBe('3.5')
  })
})

describe('debug mode artifacts', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const distRoot = path.join(fixtureDir, 'lib')

  const bundleId = 'utils-debug-flag'

  const getFiles = () =>
    fs.existsSync(distRoot)
      ? fs.readdirSync(distRoot)
      : []

  const buildBundle = () => {
    return build(defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: bundleId,
      output: {
        distPath: {
          root: distRoot,
        },
      },
      plugins: [pluginReactLynx()],
    }))
  }

  it('does not emit template intermediates when DEBUG is unset', async () => {
    vi.stubEnv('DEBUG', undefined)

    await buildBundle()
    expect(getFiles()).not.toContain('tasm.json')

    vi.unstubAllEnvs()
  })

  it('emits template intermediates when DEBUG is set', async () => {
    vi.stubEnv('DEBUG', 'rspeedy')

    await buildBundle()
    expect(getFiles()).toEqual(
      expect.arrayContaining(['tasm.json']),
    )

    vi.unstubAllEnvs()
  })
})

describe('mount externals library', () => {
  it('should mount externals library to lynx by default', async () => {
    const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
        externals: {
          '@lynx-js/react': ['ReactLynx', 'React'],
        },
        minify: false,
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-reactlynx.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
    expect(decodedResult['custom-sections']['utils']).toContain(
      'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )
    expect(decodedResult['custom-sections']['utils__main-thread']).toContain(
      'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )
  })
  it('should mount externals library to globalThis', async () => {
    const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-globalThis',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist'),
        },
        externals: {
          '@lynx-js/react': ['ReactLynx', 'React'],
        },
        minify: false,
        globalObject: 'globalThis',
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(
        fixtureDir,
        'dist/utils-reactlynx-globalThis.lynx.bundle',
      ),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
    expect(decodedResult['custom-sections']['utils']).toContain(
      'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )
    expect(decodedResult['custom-sections']['utils__main-thread']).toContain(
      'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )
  })
})

describe('pluginReactLynx', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const distRoot = path.join(fixtureDir, 'dist')

  const bundleId = 'utils-reactlynx'

  let rslib!: Awaited<ReturnType<typeof createRslib>>
  let decodedResult!: Awaited<ReturnType<typeof decodeTemplate>>

  beforeAll(async () => {
    vi.stubEnv('DEBUG', 'rspeedy')

    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: bundleId,
      output: {
        distPath: {
          root: distRoot,
        },
      },
      plugins: [pluginReactLynx()],
    })
    rslib = await createRslib({
      config: rslibConfig,
      cwd: __dirname,
    })
    await rslib.build()
    decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist/utils-reactlynx.lynx.bundle'),
    )
  })

  afterAll(() => {
    vi.unstubAllEnvs()
  })

  it('should handle alias', async () => {
    const config = await rslib.inspectConfig()
    expect(config.origin.bundlerConfigs[0]!.resolve!.alias)
      .toMatchInlineSnapshot(`
        {
          "@lynx-js/preact-devtools$": false,
          "@lynx-js/react$": "<WORKSPACE>/packages/react/runtime/lib/index.js",
          "@lynx-js/react/compat$": "<WORKSPACE>/packages/react/runtime/compat/index.js",
          "@lynx-js/react/debug$": false,
          "@lynx-js/react/experimental/lazy/import$": "<WORKSPACE>/packages/react/runtime/lazy/import.js",
          "@lynx-js/react/internal$": "<WORKSPACE>/packages/react/runtime/lib/internal.js",
          "@lynx-js/react/legacy-react-runtime$": "<WORKSPACE>/packages/react/runtime/lib/legacy-react-runtime/index.js",
          "@lynx-js/react/runtime-components$": "<WORKSPACE>/packages/react/components/lib/index.js",
          "@lynx-js/react/worklet-runtime/bindings$": "<WORKSPACE>/packages/react/worklet-runtime/lib/bindings/index.js",
          "@swc/helpers": "<WORKSPACE>/node_modules/<PNPM_INNER>/@swc/helpers",
          "preact$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/dist/preact.mjs",
          "preact/compat$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/compat/dist/compat.mjs",
          "preact/compat/client$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/compat/client.mjs",
          "preact/compat/jsx-dev-runtime$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/compat/jsx-dev-runtime.mjs",
          "preact/compat/jsx-runtime$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/compat/jsx-runtime.mjs",
          "preact/compat/scheduler$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/compat/scheduler.mjs",
          "preact/compat/server$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/compat/server.mjs",
          "preact/debug$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/debug/dist/debug.mjs",
          "preact/devtools$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/devtools/dist/devtools.mjs",
          "preact/hooks$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/hooks/dist/hooks.mjs",
          "preact/jsx-dev-runtime$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/jsx-runtime/dist/jsxRuntime.mjs",
          "preact/jsx-runtime$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/jsx-runtime/dist/jsxRuntime.mjs",
          "preact/test-utils$": "<WORKSPACE>/node_modules/<PNPM_INNER>/@hongzhiyuan/preact/test-utils/dist/testUtils.mjs",
          "react$": "<WORKSPACE>/packages/react/runtime/lib/index.js",
          "react-compiler-runtime": "<WORKSPACE>/node_modules/<PNPM_INNER>/react-compiler-runtime",
          "use-sync-external-store$": "<WORKSPACE>/packages/use-sync-external-store/index.js",
          "use-sync-external-store/shim$": "<WORKSPACE>/packages/use-sync-external-store/index.js",
          "use-sync-external-store/shim/with-selector$": "<WORKSPACE>/packages/use-sync-external-store/with-selector.js",
          "use-sync-external-store/shim/with-selector.js$": "<WORKSPACE>/packages/use-sync-external-store/with-selector.js",
          "use-sync-external-store/with-selector$": "<WORKSPACE>/packages/use-sync-external-store/with-selector.js",
          "use-sync-external-store/with-selector.js$": "<WORKSPACE>/packages/use-sync-external-store/with-selector.js",
        }
      `)
  })

  it('should handle macros', () => {
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])

    expect(decodedResult['custom-sections']['utils']).toContain(
      'log("defineDCE",{isMainThread:!1,isLepus:!1,isBackground:!0}',
    )
    expect(decodedResult['custom-sections']['utils__main-thread']).toContain(
      'log("defineDCE",{isMainThread:!0,isLepus:!0,isBackground:!1}',
    )

    expect(decodedResult['custom-sections']['utils']).toContain(
      'log("define",{isDev:!1,isProfile:!0}',
    )
    expect(decodedResult['custom-sections']['utils__main-thread']).toContain(
      'log("define",{isDev:!1,isProfile:!0}',
    )

    expect(decodedResult['custom-sections']['utils']).toContain(
      'log("process.env.NODE_ENV",{NODE_ENV:"test"}',
    )
    expect(decodedResult['custom-sections']['utils__main-thread']).toContain(
      'log("process.env.NODE_ENV",{NODE_ENV:"test"}',
    )
  })
})
