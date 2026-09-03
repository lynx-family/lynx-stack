// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRslib } from '@rslib/core'
import type { RslibConfig, Rspack, rsbuild } from '@rslib/core'
import { afterAll, beforeAll, describe, expect, it, rstest } from '@rstest/core'

import { LAYERS, pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import { LynxEncodePlugin } from '@lynx-js/template-webpack-plugin'

import { decodeTemplate } from './utils.js'
import { defineExternalBundleRslibConfig } from '../src/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function inspectRspackConfig(
  rslibConfig: RslibConfig,
): Promise<Rspack.Configuration> {
  // Resolving a config makes Rsbuild write the mode back to `NODE_ENV`.
  const prevNodeEnv = process.env['NODE_ENV']
  try {
    const rslib = await createRslib({ config: rslibConfig, cwd: __dirname })
    const { origin } = await rslib.inspectConfig()
    return origin.bundlerConfigs[0]!
  } finally {
    process.env['NODE_ENV'] = prevNodeEnv
  }
}

async function build(rslibConfig: RslibConfig) {
  const rslib = await createRslib({
    config: rslibConfig,
    cwd: __dirname,
  })
  return await rslib.build()
}

function resolveExternal(
  rslibConfig: RslibConfig,
  request: string,
) {
  const externalsResolver = rslibConfig.lib[0]?.output?.externals as
    | ((
      data: { request?: string },
      callback: (error?: Error, result?: unknown) => void,
    ) => void)
    | undefined

  return new Promise<unknown>((resolve, reject) => {
    if (!externalsResolver) {
      reject(new Error('Expected output.externals to be configured'))
      return
    }

    externalsResolver({ request }, (error, result) => {
      if (error) {
        reject(error)
        return
      }
      resolve(result)
    })
  })
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

  it('should resolve with the Lynx conditions of the build engine', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    const { resolve } = await inspectRspackConfig(rslibConfig)

    expect(resolve?.conditionNames).toContain('lynx')
    expect(resolve?.mainFields).toContain('lynx')
    expect(resolve?.mainFiles).toContain('index.lynx')
  })

  it('should compile with the SWC transforms of the build engine', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    const { module: mod } = await inspectRspackConfig(rslibConfig)

    const swcOptions: { env?: { include?: string[] } }[] = []
    const collect = (rule: unknown): void => {
      if (!rule || typeof rule !== 'object') return
      if (Array.isArray(rule)) {
        for (const nested of rule) {
          collect(nested)
        }
        return
      }
      const { use, oneOf, rules, loader, options } = rule as Record<
        string,
        unknown
      >
      collect(use)
      collect(oneOf)
      collect(rules)
      if (typeof loader === 'string' && loader.includes('swc')) {
        swcOptions.push(options as { env?: { include?: string[] } })
      }
    }
    collect(mod?.rules)

    expect(swcOptions.length).toBeGreaterThan(0)
    for (const options of swcOptions) {
      expect(options.env?.include).toContain('transform-block-scoping')
    }
  })

  it('should override default lib config', () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      syntax: 'es2019',
    })
    expect(rslibConfig.lib[0]?.syntax).toBe('es2019')
  })

  it('leaves the minify options to the engine', async () => {
    for (const output of [{}, { minify: true }] as const) {
      const rslibConfig = defineExternalBundleRslibConfig({
        source: {
          entry: {
            utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
          },
        },
        output,
        plugins: [pluginReactLynx()],
      })
      expect(rslibConfig.lib[0]?.output?.minify).toBe(true)

      const { optimization } = await inspectRspackConfig(rslibConfig)
      const [minimizer] = optimization!.minimizer as [
        {
          _args: [{ minimizerOptions: { compress: { negate_iife?: boolean } } }]
        },
      ]
      // The wrapper IIFE has to keep its shape, or a section evaluates to a
      // boolean instead of `module.exports`.
      expect(minimizer._args[0].minimizerOptions.compress.negate_iife).toBe(
        false,
      )
    }
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
          root: path.join(fixtureDir, 'dist', 'utils-dual'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist', 'utils-dual', 'utils-dual.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
  })

  it('should build every main-thread entry into external bundle', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'utils-multi')
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          a: path.join(__dirname, './fixtures/utils-lib/index.ts'),
          b: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-multi',
      output: {
        distPath: {
          root: distRoot,
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(distRoot, 'utils-multi.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'a',
      'a__main-thread',
      'b',
      'b__main-thread',
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
          root: path.join(fixtureDir, 'dist', 'utils-m'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist', 'utils-m', 'utils-m.lynx.bundle'),
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
          root: path.join(fixtureDir, 'dist', 'utils-b'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist', 'utils-b', 'utils-b.lynx.bundle'),
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
          root: path.join(fixtureDir, 'dist', 'utils-engineVersion-35'),
        },
      },
      plugins: [pluginReactLynx()],
    }, {
      engineVersion: '3.5',
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(
        fixtureDir,
        'dist',
        'utils-engineVersion-35',
        'utils-engineVersion-35.lynx.bundle',
      ),
    )
    expect(decodedResult['engine-version']).toBe('3.5')
  })

  it('should build css into external bundle', async () => {
    const fixtureDir = path.join(__dirname, './fixtures/css-lib')
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          index: path.join(fixtureDir, 'index.ts'),
        },
      },
      id: 'css-bundle',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'css-bundle'),
        },
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(fixtureDir, 'dist', 'css-bundle', 'css-bundle.lynx.bundle'),
    )

    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'index',
      'index:CSS',
      'index__main-thread',
    ])

    expect(Array.isArray(decodedResult['custom-sections']['index:CSS'])).toBe(
      true,
    )
    expect(decodedResult['custom-sections']['index:CSS']![0]).toBeTypeOf(
      'number',
    )

    expect(decodedResult['custom-sections']['index']).toBeTypeOf('string')

    // MTS should be bytecode
    expect(
      Array.isArray(decodedResult['custom-sections']['index__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['index__main-thread']![0])
      .toBeTypeOf('number')
  })
})

describe('JsBytecode encoding', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  const buildAndDecode = async (
    id: string,
    encodeOptions?: { enableJsBytecode?: boolean },
    nodeEnv?: 'development' | 'production',
  ) => {
    const prevNodeEnv = process.env['NODE_ENV']
    if (nodeEnv) {
      process.env['NODE_ENV'] = nodeEnv
    }
    try {
      const rslibConfig = defineExternalBundleRslibConfig({
        source: {
          entry: {
            utils: path.join(fixtureDir, 'index.ts'),
          },
        },
        id,
        output: {
          distPath: {
            root: path.join(fixtureDir, 'dist', id),
          },
        },
        plugins: [pluginReactLynx()],
      }, encodeOptions)
      await build(rslibConfig)
      return await decodeTemplate(
        path.join(fixtureDir, 'dist', id, `${id}.lynx.bundle`),
      )
    } finally {
      process.env['NODE_ENV'] = prevNodeEnv
    }
  }

  it('should emit plain JS for main thread chunks when enableJsBytecode is false', async () => {
    const decodedResult = await buildAndDecode('utils-no-bytecode', {
      enableJsBytecode: false,
    })

    expect(decodedResult['custom-sections']['utils__main-thread']).toBeTypeOf(
      'string',
    )
    expect(decodedResult['custom-sections']['utils']).toBeTypeOf('string')
  })

  it('should not compile main thread chunks to bytecode in development by default', async () => {
    const decodedResult = await buildAndDecode(
      'utils-dev-no-bytecode',
      undefined,
      'development',
    )

    expect(decodedResult['custom-sections']['utils__main-thread']).toBeTypeOf(
      'string',
    )
  })

  it('should compile main thread chunks to bytecode when explicitly enabled in development', async () => {
    const decodedResult = await buildAndDecode(
      'utils-dev-bytecode',
      { enableJsBytecode: true },
      'development',
    )

    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['utils__main-thread']![0])
      .toBeTypeOf('number')
  })
})

describe('NODE_ENV configuration', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  const buildWithNodeEnv = async (
    nodeEnv: 'development' | 'production',
    id: string,
  ) => {
    const prevNodeEnv = process.env['NODE_ENV']
    process.env['NODE_ENV'] = nodeEnv
    try {
      const config = defineExternalBundleRslibConfig({
        source: {
          entry: {
            utils: path.join(fixtureDir, 'index.ts'),
          },
        },
        id,
        output: {
          distPath: { root: path.join(fixtureDir, 'dist', id) },
        },
        plugins: [pluginReactLynx()],
      })
      await build(config)
      return await decodeTemplate(
        path.join(fixtureDir, 'dist', id, `${id}.lynx.bundle`),
      )
    } finally {
      process.env['NODE_ENV'] = prevNodeEnv
    }
  }

  it('should output different artifacts for development and production NODE_ENV', async () => {
    const devResult = await buildWithNodeEnv('development', 'utils-dev')
    const prodResult = await buildWithNodeEnv('production', 'utils-prod')

    const devMainThread = devResult['custom-sections']['utils__main-thread']!
    const prodMainThread = prodResult['custom-sections']['utils__main-thread']!

    // The produced artifacts should be different
    expect(devMainThread).not.toBe(prodMainThread)

    const devBackground = devResult['custom-sections']['utils']!
    const prodBackground = prodResult['custom-sections']['utils']!

    expect(devBackground).not.toBe(prodBackground)
    // __DEV__ macro should be replaced differently
    expect(devBackground).toMatch(/isDev:\s*(!0|true)/)
    expect(prodBackground).toMatch(/isDev:\s*(!1|false)/)
  })
})

describe('debug mode artifacts', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const distRoot = path.join(fixtureDir, 'lib')

  const bundleId = 'utils-debug-flag'

  // The template intermediates go into the `.lynx` directory, the same way an
  // application build emits them.
  const getFiles = () => {
    const intermediate = path.join(distRoot, '.lynx')
    return fs.existsSync(intermediate) ? fs.readdirSync(intermediate) : []
  }

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
    rstest.stubEnv('DEBUG', undefined)
    try {
      await buildBundle()
      expect(getFiles()).not.toContain('tasm.json')
    } finally {
      rstest.unstubAllEnvs()
    }
  })

  it('emits template intermediates when DEBUG is set', async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      await buildBundle()
      expect(getFiles()).toEqual(
        expect.arrayContaining(['tasm.json']),
      )
    } finally {
      rstest.unstubAllEnvs()
    }
  })
})

describe('mount externals library', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  it('should mount externals library to lynx by default', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-reactlynx'),
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
      path.join(
        fixtureDir,
        'dist',
        'utils-reactlynx',
        'utils-reactlynx.lynx.bundle',
      ),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
    expect(decodedResult['custom-sections']['utils']).toContain(
      'lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )
    // MTS should be bytecode
    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['utils__main-thread']![0])
      .toBeTypeOf('number')
  })

  it('emits a `commonjs2` module.exports assignment, not a static export copy', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-cjs2',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-reactlynx-cjs2'),
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
      path.join(
        fixtureDir,
        'dist',
        'utils-reactlynx-cjs2',
        'utils-reactlynx-cjs2.lynx.bundle',
      ),
    )
    const backgroundSection = decodedResult['custom-sections']['utils']!

    // `commonjs2` assigns the whole namespace, so an async-external entry can
    // expose its exports Promise for consumers to await.
    expect(backgroundSection).toContain('module.exports = __webpack_exports__')
    // The default `commonjs-static` per-name copy would read `undefined` off a
    // pending async-external entry Promise, so it must not be emitted.
    expect(backgroundSection).not.toContain('for(var __rspack_i')
  })

  it('should apply reactlynx externals preset to the final bundle', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-preset',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-reactlynx-preset'),
        },
        externalsPresets: {
          reactlynx: true,
        },
        minify: false,
        globalObject: 'globalThis',
      },
      plugins: [pluginReactLynx()],
    })

    await expect(resolveExternal(rslibConfig, 'react')).resolves
      .toEqual([
        'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]',
        'ReactLynx',
        'React',
      ])
    await expect(resolveExternal(rslibConfig, '@lynx-js/react')).resolves
      .toEqual([
        'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]',
        'ReactLynx',
        'React',
      ])

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(
        fixtureDir,
        'dist',
        'utils-reactlynx-preset',
        'utils-reactlynx-preset.lynx.bundle',
      ),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
    expect(decodedResult['custom-sections']['utils']).toContain(
      'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )

    // MTS should be bytecode
    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['utils__main-thread']![0])
      .toBeTypeOf('number')
  })

  it('should let explicit externals override the reactlynx preset', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-preset-override',
      output: {
        distPath: {
          root: path.join(
            fixtureDir,
            'dist',
            'utils-reactlynx-preset-override',
          ),
        },
        externalsPresets: {
          reactlynx: true,
        },
        externals: {
          '@lynx-js/react': ['CustomRuntime', 'React'],
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
        'dist',
        'utils-reactlynx-preset-override',
        'utils-reactlynx-preset-override.lynx.bundle',
      ),
    )
    expect(decodedResult['custom-sections']['utils']).toContain(
      'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].CustomRuntime.React',
    )
    expect(decodedResult['custom-sections']['utils']).not.toContain(
      'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )
    // MTS should be bytecode
    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['utils__main-thread']![0])
      .toBeTypeOf('number')
  })

  it('should allow extending the built-in reactlynx preset', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-custom-extend',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-reactlynx-custom-extend'),
        },
        externalsPresets: {
          reactlynxPlus: true,
        },
        externalsPresetDefinitions: {
          reactlynxPlus: {
            extends: 'reactlynx',
            externals: {
              '@lynx-js/react': ['CustomRuntime', 'React'],
            },
          },
        },
        minify: false,
        globalObject: 'globalThis',
      },
      plugins: [pluginReactLynx()],
    })
    await expect(resolveExternal(rslibConfig, '@lynx-js/react')).resolves
      .toEqual([
        'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]',
        'CustomRuntime',
        'React',
      ])
    await expect(resolveExternal(rslibConfig, '@lynx-js/react/jsx-runtime'))
      .resolves.toEqual([
        'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]',
        'ReactLynx',
        'ReactJSXRuntime',
      ])
  })

  it('should allow custom externals presets that are not built in', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-custom-preset',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-custom-preset'),
        },
        externalsPresets: {
          lynxUi: true,
        },
        externalsPresetDefinitions: {
          lynxUi: {
            externals: {
              '@lynx-js/react': ['LynxUI', 'React'],
              '@lynx-js/react/jsx-runtime': ['LynxUI', 'ReactJSXRuntime'],
            },
          },
        },
        minify: false,
        globalObject: 'globalThis',
      },
      plugins: [pluginReactLynx()],
    })
    await expect(resolveExternal(rslibConfig, '@lynx-js/react')).resolves
      .toEqual([
        'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]',
        'LynxUI',
        'React',
      ])
    await expect(resolveExternal(rslibConfig, '@lynx-js/react/jsx-runtime'))
      .resolves.toEqual([
        'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]',
        'LynxUI',
        'ReactJSXRuntime',
      ])
  })

  it('should mount externals library to globalThis', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-globalThis',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-reactlynx-globalThis'),
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
        'dist',
        'utils-reactlynx-globalThis',
        'utils-reactlynx-globalThis.lynx.bundle',
      ),
    )
    expect(Object.keys(decodedResult['custom-sections']).sort()).toEqual([
      'utils',
      'utils__main-thread',
    ])
    expect(decodedResult['custom-sections']['utils']).toContain(
      'globalThis[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")].ReactLynx.React',
    )

    // MTS should be bytecode
    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['utils__main-thread']![0])
      .toBeTypeOf('number')
  })

  it('should emit promise externals for async externals with subpaths', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(__dirname, './fixtures/utils-lib/index.ts'),
        },
      },
      id: 'utils-reactlynx-async',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-reactlynx-async'),
        },
        externals: {
          // Multi-level subpath: every segment after the mount key must be
          // picked after the mounted namespace promise resolves.
          '@lynx-js/react': {
            libraryName: ['ReactLynx', 'Nested', 'React'],
            async: true,
          },
        },
        minify: false,
      },
      plugins: [pluginReactLynx()],
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(
        fixtureDir,
        'dist',
        'utils-reactlynx-async',
        'utils-reactlynx-async.lynx.bundle',
      ),
    )
    expect(decodedResult['custom-sections']['utils']).toContain(
      'Promise.resolve(lynx[Symbol.for("__LYNX_EXTERNAL_GLOBAL__")]["ReactLynx"])'
        + '.then(function (m) { return m["Nested"]["React"]; })',
    )
    // No synchronous property access on the pending promise.
    expect(decodedResult['custom-sections']['utils']).not.toContain(
      '["ReactLynx"]["Nested"]',
    )
  })
})

describe('pluginReactLynx', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const bundleId = 'utils-reactlynx'
  const distRoot = path.join(fixtureDir, 'dist', bundleId)

  let rslib!: Awaited<ReturnType<typeof createRslib>>
  let decodedResult!: Awaited<ReturnType<typeof decodeTemplate>>

  beforeAll(async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')

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
      path.join(
        fixtureDir,
        'dist',
        'utils-reactlynx',
        'utils-reactlynx.lynx.bundle',
      ),
    )
  })

  afterAll(() => {
    rstest.unstubAllEnvs()
  })

  it('should handle alias', async () => {
    const config = await rslib.inspectConfig()
    const alias = Object.fromEntries(
      Object.entries(config.origin.bundlerConfigs[0]!.resolve!.alias!).map((
        [key, value],
      ) => {
        if (typeof value === 'string' && key.startsWith('preact')) {
          // Simplify the path to only keep the part starting from 'preact/'
          return [
            key,
            value.replaceAll(path.sep, '/').replace(/.*(preact\/.*)/, '$1'),
          ]
        }
        return [key, value]
      }),
    )
    expect(alias).toMatchInlineSnapshot(`
      {
        "@lynx-js/preact-devtools$": false,
        "@lynx-js/react$": "<ROOT>/packages/react/runtime/lib/index.js",
        "@lynx-js/react/compat$": "<ROOT>/packages/react/runtime/compat/index.js",
        "@lynx-js/react/debug$": false,
        "@lynx-js/react/experimental/lazy/import$": "<ROOT>/packages/react/runtime/lazy/import.js",
        "@lynx-js/react/internal$": "<ROOT>/packages/react/runtime/lib/internal.js",
        "@lynx-js/react/jsx-dev-runtime": "<ROOT>/packages/react/runtime/jsx-dev-runtime/index.js",
        "@lynx-js/react/jsx-runtime": "<ROOT>/packages/react/runtime/jsx-runtime/index.js",
        "@lynx-js/react/legacy-react-runtime$": "<ROOT>/packages/react/runtime/lib/core/compat/legacy-react-runtime.js",
        "@lynx-js/react/runtime-components$": "<ROOT>/packages/react/components/lib/index.js",
        "@lynx-js/react/worklet-runtime/bindings$": "<ROOT>/packages/react/runtime/lib/worklet-runtime/bindings/index.js",
        "@swc/helpers": "<PNPM_INNER>/@swc/helpers",
        "preact$": "preact/dist/preact.mjs",
        "preact/compat$": "preact/compat/dist/compat.mjs",
        "preact/compat/client$": "preact/compat/client.mjs",
        "preact/compat/jsx-dev-runtime$": "preact/compat/jsx-dev-runtime.mjs",
        "preact/compat/jsx-runtime$": "preact/compat/jsx-runtime.mjs",
        "preact/compat/scheduler$": "preact/compat/scheduler.mjs",
        "preact/compat/server$": "preact/compat/server.mjs",
        "preact/debug$": "preact/debug/dist/debug.mjs",
        "preact/devtools$": "preact/devtools/dist/devtools.mjs",
        "preact/jsx-dev-runtime$": "preact/jsx-runtime/dist/jsxRuntime.mjs",
        "preact/jsx-runtime$": "preact/jsx-runtime/dist/jsxRuntime.mjs",
        "preact/test-utils$": "preact/test-utils/dist/testUtils.mjs",
        "react$": "<ROOT>/packages/react/runtime/lib/index.js",
        "react-compiler-runtime": "<PNPM_INNER>/react-compiler-runtime",
        "use-sync-external-store$": "<ROOT>/packages/use-sync-external-store/index.js",
        "use-sync-external-store/shim$": "<ROOT>/packages/use-sync-external-store/index.js",
        "use-sync-external-store/shim/with-selector$": "<ROOT>/packages/use-sync-external-store/with-selector.js",
        "use-sync-external-store/shim/with-selector.js$": "<ROOT>/packages/use-sync-external-store/with-selector.js",
        "use-sync-external-store/with-selector$": "<ROOT>/packages/use-sync-external-store/with-selector.js",
        "use-sync-external-store/with-selector.js$": "<ROOT>/packages/use-sync-external-store/with-selector.js",
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

    expect(decodedResult['custom-sections']['utils']).toContain(
      'log("define",{isDev:!1,isProfile:!0}',
    )

    expect(decodedResult['custom-sections']['utils']).toContain(
      'log("process.env.NODE_ENV",{NODE_ENV:"test"}',
    )

    // MTS should be bytecode
    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    ).toBe(true)
    expect(decodedResult['custom-sections']['utils__main-thread']![0])
      .toBeTypeOf('number')
  })
})

describe('DSL plugin without layer loaders', () => {
  const fixtureDir = path.join(__dirname, './fixtures/plain-lib')

  it('should build when the DSL plugin does not register layer loaders', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          plain: path.join(fixtureDir, 'index.ts'),
        },
      },
      id: 'plain-no-layer-loaders',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'plain-no-layer-loaders'),
        },
      },
      plugins: [
        {
          // Mimics a DSL plugin (e.g. TTML) that exposes LAYERS without
          // registering the ReactLynx layer loaders. The `isExternalBundle`
          // tap must not create a loader-less use entry in this case, which
          // Rspack >= 2.0.8 rejects.
          name: 'test:dsl-without-layer-loaders',
          setup(api) {
            api.expose(Symbol.for('LAYERS'), LAYERS)
            // A DSL plugin registers the encoder, the way `pluginReactLynx` does.
            api.modifyBundlerChain(chain => {
              chain.plugin(LynxEncodePlugin.name).use(LynxEncodePlugin, [])
            })
          },
        } satisfies rsbuild.RsbuildPlugin,
        ...pluginLynx(),
      ],
    })

    await expect(build(rslibConfig)).resolves.toBeDefined()
  })
})

describe('debug metadata', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const distRoot = path.join(fixtureDir, 'dist', 'debug-metadata')

  it('emits the metadata a devtool remaps an external bundle with', async () => {
    rstest.stubEnv('CI', '1')
    try {
      await build(defineExternalBundleRslibConfig({
        source: { entry: { utils: path.join(fixtureDir, 'index.ts') } },
        id: 'utils-debug-metadata',
        output: { distPath: { root: distRoot } },
        plugins: [pluginReactLynx()],
      }))
    } finally {
      rstest.unstubAllEnvs()
    }

    expect(
      fs.existsSync(path.join(distRoot, '.lynx', 'debug-metadata.json')),
    ).toBe(true)

    // The release banner has to sit inside the module wrapper, which is what
    // `lynx.loadScript` takes the section's value from.
    const mainThread = await fs.promises.readFile(
      path.join(distRoot, 'utils__main-thread.js'),
      'utf-8',
    )
    expect(mainThread).toMatch(/^\(function\s*\(\)\s*\{/)
    expect(mainThread).toContain('debugmetadata:')
  })
})

describe('license comments', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
  const distRoot = path.join(fixtureDir, 'dist', 'license-comments')

  it('does not emit a license file a Lynx bundle cannot link to', async () => {
    await build(defineExternalBundleRslibConfig({
      source: { entry: { utils: path.join(fixtureDir, 'index.ts') } },
      id: 'utils-legal-comments',
      output: { distPath: { root: distRoot } },
      plugins: [pluginReactLynx()],
    }))

    const emitted = await fs.promises.readdir(distRoot)

    expect(emitted.filter(name => name.includes('LICENSE'))).toEqual([])
  })
})

describe('debug info outside', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  it('should keep bytecode debug info out of the tasm bundle', async () => {
    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      const distRoot = path.join(fixtureDir, 'dist', 'utils-dbg-outside')
      await build(defineExternalBundleRslibConfig({
        source: {
          entry: {
            utils: path.join(fixtureDir, 'index.ts'),
          },
        },
        id: 'utils-dbg-outside',
        output: {
          distPath: {
            root: distRoot,
          },
        },
        plugins: [pluginReactLynx()],
      }))
      const tasmJson = JSON.parse(
        fs.readFileSync(path.join(distRoot, '.lynx', 'tasm.json'), 'utf-8'),
      ) as {
        compilerOptions: Record<string, unknown>
        sourceContent: Record<string, unknown>
      }
      expect(tasmJson.compilerOptions['debugInfoOutside']).toBe(true)
      // The style sheet lands after the elements exist.
      expect(tasmJson.compilerOptions['enableCSSInvalidation']).toBe(true)
      // An external bundle is loaded by an application, not rendered as one.
      expect(tasmJson.sourceContent['appType']).toBe('DynamicComponent')
    } finally {
      rstest.unstubAllEnvs()
    }
  })
})
