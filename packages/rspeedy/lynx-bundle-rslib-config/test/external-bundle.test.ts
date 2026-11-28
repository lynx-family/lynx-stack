// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

import { createRslib } from '@rslib/core'
import type { RslibConfig, Rspack, rsbuild } from '@rslib/core'
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  onTestFinished,
  rstest,
} from '@rstest/core'

import { LAYERS, pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { pluginLynx } from '@lynx-js/rsbuild-plugin'
import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin'

import { decodeTemplate } from './utils.js'
import {
  LAYERS as DEFAULT_LAYERS,
  defineExternalBundleRslibConfig,
} from '../src/index.js'
import {
  ExternalBundleSectionMapPlugin,
  sectionNaming,
} from '../src/webpack/ExternalBundleSectionMapPlugin.js'

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
  const cacheDirectory = await mkdtemp(
    path.join(tmpdir(), 'external-bundle-cache-'),
  )
  onTestFinished(() => rm(cacheDirectory, { recursive: true, force: true }))
  // Different compilers in this suite must not share a cache transaction.
  rslibConfig = {
    ...rslibConfig,
    lib: rslibConfig.lib.map(lib => ({
      ...lib,
      performance: {
        ...lib.performance,
        buildCache: lib.performance?.buildCache === false ? false : {
          ...(typeof lib.performance?.buildCache === 'object'
            ? lib.performance.buildCache
            : {}),
          cacheDirectory,
        },
      },
    })),
  }
  const rslib = await createRslib({
    config: rslibConfig,
    cwd: __dirname,
  })
  const result = await rslib.build()
  await result.close()
  return result
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

describe('re-evaluation entry support', () => {
  it('registers background-only eager view snapshots before returning exports', async () => {
    const fixtureDir = path.join(__dirname, './fixtures/background-view')
    const distRoot = path.join(fixtureDir, 'dist')
    await build(defineExternalBundleRslibConfig({
      id: 'background-view',
      source: { entry: { component: path.join(fixtureDir, 'eager.ts') } },
      output: {
        distPath: { root: distRoot },
        minify: false,
        globalObject: 'lynx',
        externalsPresets: { reactlynx: true },
      },
      plugins: [pluginReactLynx()],
    }, { enableJsBytecode: false }))

    const decoded = await decodeTemplate(
      path.join(distRoot, 'background-view.lynx.bundle'),
    )
    const snapshots: string[] = []
    const internal = {
      snapshotCreatorMap: {} as Record<string, (id: string) => void>,
      createSnapshot: (id: string) => snapshots.push(id),
    }
    const result = runInNewContext(
      decoded['custom-sections']['component__main-thread']!,
      {
        lynx: {
          [Symbol.for('__LYNX_EXTERNAL_GLOBAL__')]: {
            ReactLynx: { ReactInternal: internal },
          },
        },
      },
    ) as { marker: number }
    expect(result.marker).toBe(42)
    for (const [id, create] of Object.entries(internal.snapshotCreatorMap)) {
      create(id)
    }
    expect(snapshots.length).toBeGreaterThan(0)
  })

  it('does not let external libraries mark the consumer entry', async () => {
    const fixtureDir = path.join(__dirname, './fixtures/utils-lib')
    const distRoot = path.join(fixtureDir, 'dist', 're-eval-entry-support')
    await build(defineExternalBundleRslibConfig({
      id: 'utils-re-eval',
      source: { entry: { utils: path.join(fixtureDir, 'index.ts') } },
      output: { distPath: { root: distRoot }, minify: false },
      plugins: [pluginReactLynx({ experimental_reEvalJSOnReload: true })],
    }, { enableJsBytecode: false }))

    const decoded = await decodeTemplate(
      path.join(distRoot, 'utils-re-eval.lynx.bundle'),
    )
    const entryMarker =
      /Symbol\.for\(['"]__LYNX_ENTRY_SUPPORTS_RE_EVAL__['"]\)\]\s*=(?!=)/
    for (const name of ['utils', 'utils__main-thread']) {
      const source = decoded['custom-sections'][name]
      expect(source).toBeTypeOf('string')
      expect(source).not.toMatch(entryMarker)
    }
  })
})

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

  it('should not wrap a main-thread entry with the background runtime wrapper', async () => {
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: {
            import: path.join(__dirname, './fixtures/utils-lib/index.ts'),
            layer: LAYERS.MAIN_THREAD,
          },
        },
      },
      id: 'utils-m-plain',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-m-plain'),
        },
      },
      plugins: [pluginReactLynx()],
    }, {
      enableJsBytecode: false,
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(
        fixtureDir,
        'dist',
        'utils-m-plain',
        'utils-m-plain.lynx.bundle',
      ),
    )
    const mainThreadSection = decodedResult['custom-sections']['utils']
    expect(mainThreadSection).toBeTypeOf('string')
    expect(mainThreadSection).not.toContain('.define(')
  })

  it('should mark a chunk by its main-thread modules rather than its name', async () => {
    const marked: Record<string, boolean> = {}
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          utils: path.join(fixtureDir, 'index.ts'),
          helpers: path.join(fixtureDir, 'index.ts'),
        },
      },
      id: 'utils-shared-mt',
      output: {
        distPath: {
          root: path.join(fixtureDir, 'dist', 'utils-shared-mt'),
        },
      },
      tools: {
        rspack: {
          optimization: {
            splitChunks: {
              chunks: 'all',
              minSize: 0,
              cacheGroups: {
                default: false,
                defaultVendors: false,
                mainThread: {
                  name: 'shared-mt',
                  test: (module: { layer?: string | null }) =>
                    module.layer === LAYERS.MAIN_THREAD,
                  enforce: true,
                },
              },
            },
          },
        },
      },
      plugins: [
        pluginReactLynx(),
        {
          name: 'test:read-marks',
          setup(api) {
            api.processAssets(
              { stage: 'report' },
              ({ compilation }) => {
                for (const asset of compilation.getAssets()) {
                  if (asset.name.endsWith('.js')) {
                    marked[asset.name] = asset.info['lynx:main-thread'] === true
                  }
                }
              },
            )
          },
        } satisfies rsbuild.RsbuildPlugin,
      ],
    }, {
      enableJsBytecode: false,
    })

    await build(rslibConfig)

    expect(marked).toStrictEqual({
      'shared-mt.js': true,
      '.lynx/utils-shared-mt/utils__main-thread.js': true,
      '.lynx/utils-shared-mt/helpers__main-thread.js': true,
      '.lynx/utils-shared-mt/utils.js': false,
      '.lynx/utils-shared-mt/helpers.js': false,
    })
  })

  it('should wrap a main-thread entry named like a path', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'utils-path-name')
    const rslibConfig = defineExternalBundleRslibConfig({
      source: {
        entry: {
          './utils.js': path.join(fixtureDir, 'index.ts'),
        },
      },
      id: 'utils-path-name',
      output: {
        distPath: {
          root: distRoot,
        },
      },
      plugins: [pluginReactLynx()],
    }, {
      enableJsBytecode: false,
    })

    await build(rslibConfig)

    const decodedResult = await decodeTemplate(
      path.join(distRoot, 'utils-path-name.lynx.bundle'),
    )
    const mainThreadSection =
      decodedResult['custom-sections']['./utils.js__main-thread']
    expect(mainThreadSection).toBeTypeOf('string')
    // The wrapper survives minification as an IIFE that returns the module.
    expect(mainThreadSection).toMatch(/^\(function\s*\(\)\s*\{/)
    expect(mainThreadSection!.trimEnd()).toMatch(
      /\}\)\(\);?(\n\/\/# sourceMappingURL=\S*)?$/,
    )
    expect(mainThreadSection).toMatch(/\{\s*exports\s*:\s*\{\s*\}\s*\}/)
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
    const intermediate = path.join(distRoot, '.lynx', bundleId)
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
        "@lynx-js/react/worklet-runtime/init$": "<ROOT>/packages/react/runtime/lib/worklet-runtime/index.js",
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

    const metadataPath = path.join(
      distRoot,
      '.lynx',
      'utils-debug-metadata',
      'debug-metadata.json',
    )
    expect(fs.existsSync(metadataPath)).toBe(true)

    // A devtool looks an artifact up by the name a stack frame carries, which
    // for a bundle assembled from custom sections is the section name.
    const metadata = JSON.parse(
      await fs.promises.readFile(metadataPath, 'utf-8'),
    ) as {
      artifacts: {
        kind: string
        filename: string
        path: string
        tasmSection?: string[]
      }[]
    }
    const mainThreadArtifact = metadata.artifacts.find(a =>
      a.kind === 'main-thread'
    )
    expect(mainThreadArtifact?.tasmSection).toEqual([
      'customSections',
      'utils__main-thread',
    ])
    expect(mainThreadArtifact?.filename).toBe('utils__main-thread')
    expect(mainThreadArtifact?.path).toBe(
      '.lynx/utils-debug-metadata/utils__main-thread.js',
    )

    // The release banner has to sit inside the module wrapper, which is what
    // `lynx.loadScript` takes the section's value from.
    const mainThread = await fs.promises.readFile(
      path.join(
        distRoot,
        '.lynx',
        'utils-debug-metadata',
        'utils__main-thread.js',
      ),
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
        fs.readFileSync(
          path.join(distRoot, '.lynx', 'utils-dbg-outside', 'tasm.json'),
          'utf-8',
        ),
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

describe('intermediate directory', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  // A `development` build (`DEBUG` unset — `lynxRstestConfig` otherwise sets
  // `DEBUG=rspeedy`) is the case that used to leak: `LynxEncodePlugin` skips
  // its own cleanup for `NODE_ENV=development`, so the raw entry chunks stay
  // on disk. Their directory is what this test checks.
  it('keeps the raw entry chunks out of dist root, the way a page build does', async () => {
    const debug = process.env['DEBUG']
    const nodeEnv = process.env['NODE_ENV']
    delete process.env['DEBUG']
    process.env['NODE_ENV'] = 'development'
    const distRoot = path.join(fixtureDir, 'dist', 'utils-intermediate-dir')
    try {
      await build(defineExternalBundleRslibConfig({
        source: { entry: { utils: path.join(fixtureDir, 'index.ts') } },
        id: 'utils-intermediate-dir',
        output: { distPath: { root: distRoot } },
        plugins: [pluginReactLynx()],
      }))
    } finally {
      if (debug === undefined) delete process.env['DEBUG']
      else process.env['DEBUG'] = debug
      if (nodeEnv === undefined) delete process.env['NODE_ENV']
      else process.env['NODE_ENV'] = nodeEnv
    }

    const rootEntries = await fs.promises.readdir(distRoot)
    expect(rootEntries.sort()).toStrictEqual([
      '.lynx',
      'utils-intermediate-dir.lynx.bundle',
    ])
    expect(
      await fs.promises.readdir(
        path.join(distRoot, '.lynx', 'utils-intermediate-dir'),
      ),
    ).toStrictEqual(
      expect.arrayContaining(['utils.js', 'utils__main-thread.js']),
    )
  })
})

describe('without a DSL plugin', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  it('builds with `pluginLynx` alone', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'plain-engine')

    await build(defineExternalBundleRslibConfig({
      source: {
        entry: {
          './utils.js': {
            import: path.join(fixtureDir, 'index.ts'),
            layer: DEFAULT_LAYERS.BACKGROUND,
          },
        },
      },
      id: 'plain-engine',
      output: { distPath: { root: distRoot } },
      plugins: [pluginLynx()],
    }))

    const decodedResult = await decodeTemplate(
      path.join(distRoot, 'plain-engine.lynx.bundle'),
    )

    // The entry picks one layer, so the bundle carries one section.
    expect(Object.keys(decodedResult['custom-sections'])).toStrictEqual([
      './utils.js',
    ])

    // `lynx.loadScript` returns the completion value of the section, which the
    // runtime wrapper provides. Without it the bundle still builds, and fails
    // to load on device.
    expect(decodedResult['custom-sections']['./utils.js'])
      .toMatch(/^\(function\s*\(\)\s*\{/)
  })

  it('compiles LynXML entries with optional background scripts and styles', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'lynxml-external-'))
    onTestFinished(() => rm(root, { recursive: true, force: true }))
    const minimal = path.join(root, 'minimal.lynxml')
    await fs.promises.writeFile(
      minimal,
      `<lynx engine-version="3.9">
      <script thread="main">export const marker = "minimal";</script>
    </lynx>`,
    )

    await build(defineExternalBundleRslibConfig({
      source: {
        entry: {
          math: path.resolve(
            __dirname,
            '../../../../examples/lynxml-external/math.lynxml',
          ),
          minimal,
        },
      },
      id: 'resources',
      plugins: [pluginLynx()],
      output: { distPath: { root: path.join(root, 'dist') } },
    }, { engineVersion: '3.9', enableJsBytecode: false }))

    const decoded = await decodeTemplate(
      path.join(root, 'dist/resources.lynx.bundle'),
    )
    const sections = decoded['custom-sections']
    expect(Object.keys(sections).sort()).toEqual([
      'math',
      'math:CSS',
      'math__main-thread',
      'minimal',
      'minimal__main-thread',
    ])
    expect(sections['math:CSS']).toEqual(
      expect.arrayContaining([expect.any(Number)]),
    )
    const host = {}
    const script = sections['math__main-thread']!
    const math = runInNewContext(script, host) as {
      add(a: number, b: number): number
    }
    expect(math.add(6, 7)).toBe(13)
    // A second evaluation in the same host must not redeclare any globals.
    expect(() => {
      runInNewContext(script, host)
    }).not.toThrow()
    expect(runInNewContext(sections['minimal__main-thread']!, host))
      .toMatchObject({
        marker: 'minimal',
      })
  })

  it('builds a web bundle with `pluginLynx` alone', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'plain-engine-web')

    await build(defineExternalBundleRslibConfig({
      source: {
        entry: {
          './utils.js': {
            import: path.join(fixtureDir, 'index.ts'),
            layer: DEFAULT_LAYERS.BACKGROUND,
          },
        },
      },
      id: 'plain-engine-web',
      output: { distPath: { root: distRoot } },
      plugins: [pluginLynx()],
    }, { target: 'web', engineVersion: '3.5' }))

    expect(fs.existsSync(path.join(distRoot, 'plain-engine-web.web.bundle')))
      .toBe(true)
  })
})

describe('hashSectionNames', () => {
  const fixtureDir = path.join(__dirname, './fixtures/utils-lib')

  const readTasmSectionMap = (distRoot: string, bundleName: string) => {
    const tasmJson = JSON.parse(
      fs.readFileSync(
        path.join(distRoot, '.lynx', bundleName, 'tasm.json'),
        'utf-8',
      ),
    ) as {
      customSections: Record<string, { content: unknown }>
    }
    return tasmJson.customSections['__sectionMap']?.content as
      | Record<string, string>
      | undefined
  }

  it('hashes background section names and emits __sectionMap while leaving main-thread and CSS sections unhashed', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'hash-section-names')
    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      await build(defineExternalBundleRslibConfig({
        source: {
          entry: {
            utils: path.join(fixtureDir, 'index.ts'),
          },
        },
        id: 'utils-hashed',
        output: {
          distPath: {
            root: distRoot,
          },
        },
        plugins: [pluginReactLynx()],
      }, {
        hashSectionNames: true,
      }))
    } finally {
      rstest.unstubAllEnvs()
    }

    const sectionMap = readTasmSectionMap(distRoot, 'utils-hashed')
    expect(sectionMap).toBeDefined()
    expect(Object.keys(sectionMap!)).toStrictEqual(['utils'])
    expect(sectionMap!['utils']).toMatch(/^utils\.[0-9a-f]{8}$/)

    const hashedName = sectionMap!['utils']!
    const bundlePath = path.join(distRoot, 'utils-hashed.lynx.bundle')
    const bundleBuffer = await fs.promises.readFile(bundlePath)
    // `decode_napi`'s `SerializeCustomSections` omits table-valued custom
    // sections, so also verify the encoded binary carries `__sectionMap`.
    expect(bundleBuffer.includes(Buffer.from('__sectionMap'))).toBe(true)

    const decodedResult = await decodeTemplate(bundlePath)
    expect(Object.keys(decodedResult['custom-sections']).sort()).toStrictEqual([
      hashedName,
      'utils__main-thread',
    ].sort())
    expect(decodedResult['custom-sections']['utils']).toBeUndefined()
    expect(decodedResult['custom-sections'][hashedName]).toBeTypeOf('string')
    expect(
      Array.isArray(decodedResult['custom-sections']['utils__main-thread']),
    )
      .toBe(true)
  })

  it('produces a deterministic hash for identical input and a different hash when content changes', async () => {
    const tempDir = await fs.promises.mkdtemp(
      path.join(fixtureDir, 'dist-hash-change-'),
    )
    const entryFile = path.join(tempDir, 'entry.ts')
    const distA = path.join(tempDir, 'dist-a')
    const distB = path.join(tempDir, 'dist-b')
    const distC = path.join(tempDir, 'dist-c')

    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      await fs.promises.writeFile(entryFile, 'export const version = "0.7.2"\n')
      const buildBundle = async (distRoot: string) => {
        await build(defineExternalBundleRslibConfig({
          source: { entry: { dil: entryFile } },
          id: 'dil-bundle',
          output: { distPath: { root: distRoot } },
          performance: { buildCache: false },
          plugins: [pluginLynx()],
        }, { hashSectionNames: true }))
        return readTasmSectionMap(distRoot, 'dil-bundle')!
      }

      const mapA = await buildBundle(distA)
      const mapB = await buildBundle(distB)
      expect(mapA['dil']).toBe(mapB['dil'])

      await fs.promises.writeFile(entryFile, 'export const version = "0.7.6"\n')
      const mapC = await buildBundle(distC)
      expect(mapC['dil']).toMatch(/^dil\.[0-9a-f]{8}$/)
      expect(mapC['dil']).not.toBe(mapA['dil'])
    } finally {
      rstest.unstubAllEnvs()
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('omits __sectionMap for main-thread-only bundles', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'hash-mt-only')
    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      await build(defineExternalBundleRslibConfig({
        source: {
          entry: {
            utils: {
              import: path.join(fixtureDir, 'index.ts'),
              layer: LAYERS.MAIN_THREAD,
            },
          },
        },
        id: 'utils-mt-only',
        output: { distPath: { root: distRoot } },
        plugins: [pluginReactLynx()],
      }, {
        hashSectionNames: true,
      }))
    } finally {
      rstest.unstubAllEnvs()
    }

    expect(readTasmSectionMap(distRoot, 'utils-mt-only')).toBeUndefined()
    const decodedResult = await decodeTemplate(
      path.join(distRoot, 'utils-mt-only.lynx.bundle'),
    )
    expect(Object.keys(decodedResult['custom-sections'])).toStrictEqual([
      'utils',
    ])
  })

  it('records the hashed background section name in debug-metadata.json', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'hash-debug-metadata')
    rstest.stubEnv('CI', '1')
    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      await build(defineExternalBundleRslibConfig({
        source: { entry: { utils: path.join(fixtureDir, 'index.ts') } },
        id: 'utils-hashed-debug',
        output: { distPath: { root: distRoot } },
        plugins: [pluginReactLynx()],
      }, {
        hashSectionNames: true,
      }))
    } finally {
      rstest.unstubAllEnvs()
    }

    const sectionMap = readTasmSectionMap(distRoot, 'utils-hashed-debug')!
    const hashedName = sectionMap['utils']!

    const metadata = JSON.parse(
      await fs.promises.readFile(
        path.join(
          distRoot,
          '.lynx',
          'utils-hashed-debug',
          'debug-metadata.json',
        ),
        'utf-8',
      ),
    ) as {
      artifacts: {
        kind: string
        filename: string
        tasmSection?: string[]
      }[]
    }
    const bgArtifact = metadata.artifacts.find(a => a.kind === 'background')
    expect(bgArtifact?.tasmSection).toEqual(['customSections', hashedName])
  })

  it('ignores hashSectionNames on the web target', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'hash-web-target')

    await build(defineExternalBundleRslibConfig({
      source: { entry: { utils: path.join(fixtureDir, 'index.ts') } },
      id: 'utils-hashed-web',
      output: { distPath: { root: distRoot } },
      plugins: [pluginReactLynx()],
    }, {
      target: 'web',
      engineVersion: '3.5',
      hashSectionNames: true,
    }))

    expect(fs.existsSync(path.join(distRoot, 'utils-hashed-web.web.bundle')))
      .toBe(true)
  })

  it('rejects a main-thread entry named __sectionMap when hashSectionNames is enabled', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'hash-reserved-mt')
    const compilationErrors: string[] = []

    await expect(
      build(defineExternalBundleRslibConfig({
        source: {
          entry: {
            __sectionMap: {
              import: path.join(fixtureDir, 'index.ts'),
              layer: LAYERS.MAIN_THREAD,
            },
            utils: {
              import: path.join(fixtureDir, 'index.ts'),
              layer: LAYERS.BACKGROUND,
            },
          },
        },
        id: 'utils-reserved-mt',
        output: { distPath: { root: distRoot } },
        plugins: [pluginReactLynx()],
        tools: {
          bundlerChain(chain) {
            chain.plugin('test:collect-errors').use({
              apply(compiler: Rspack.Compiler) {
                compiler.hooks.done.tap('test:collect-errors', stats => {
                  for (const err of stats.compilation.errors) {
                    compilationErrors.push(err.message)
                  }
                })
              },
            })
          },
        },
      }, {
        hashSectionNames: true,
      })),
    ).rejects.toThrow()

    expect(compilationErrors.join('\n')).toMatch(
      /Entry name "__sectionMap" is reserved when `hashSectionNames` is enabled\./,
    )
  })

  it('scopes hashed background section names per encode when multiple templates share a compilation', async () => {
    const distRoot = path.join(fixtureDir, 'dist', 'hash-multi-template')
    rstest.stubEnv('DEBUG', 'rspeedy')
    try {
      await build(defineExternalBundleRslibConfig({
        source: {
          entry: {
            alpha: {
              import: path.join(fixtureDir, 'index.ts'),
              layer: LAYERS.BACKGROUND,
            },
            beta: {
              import: path.join(fixtureDir, 'index.ts'),
              layer: LAYERS.BACKGROUND,
            },
          },
        },
        id: 'multi-alpha',
        output: { distPath: { root: distRoot } },
        plugins: [pluginReactLynx()],
        tools: {
          bundlerChain(chain) {
            // Restrict the primary template to `alpha` and attach a second
            // template + section-map plugin for `beta` in the same compilation,
            // plus an async `beforeEncode` tap so both encodes interleave.
            chain
              .plugin(LynxTemplatePlugin.name)
              .tap(([options]: [Record<string, unknown>]) => [{
                ...options,
                chunks: ['alpha'],
              }])
            chain
              .plugin('test:beta-section-map')
              .use(ExternalBundleSectionMapPlugin, [
                LynxTemplatePlugin,
                'multi-beta.lynx.bundle',
              ])
            chain
              .plugin('test:beta-template')
              .use(LynxTemplatePlugin, [{
                ...LynxTemplatePlugin.defaultOptions,
                filename: 'multi-beta.lynx.bundle',
                intermediate: '.lynx/multi-beta',
                chunks: ['beta'],
                customSectionNaming: compilation =>
                  sectionNaming(compilation, { reserveSectionMap: true }),
                appType: 'DynamicComponent',
                enableSectionBytecode: false,
                targetSdkVersion: '3.5',
                debugInfoOutside: true,
                enableCSSInvalidation: true,
              }])
            chain.plugin('test:interleave-before-encode').use({
              apply(compiler: Rspack.Compiler) {
                compiler.hooks.thisCompilation.tap(
                  'test:interleave-before-encode',
                  compilation => {
                    LynxTemplatePlugin
                      .getLynxTemplatePluginHooks(compilation)
                      .beforeEncode
                      .tapPromise(
                        { name: 'test:interleave-before-encode', stage: 2000 },
                        async args => {
                          await new Promise(resolve => setTimeout(resolve, 20))
                          return args
                        },
                      )
                  },
                )
              },
            })
          },
        },
      }, {
        hashSectionNames: true,
        enableJsBytecode: false,
      }))
    } finally {
      rstest.unstubAllEnvs()
    }

    const alphaMap = readTasmSectionMap(distRoot, 'multi-alpha')
    const betaMap = readTasmSectionMap(distRoot, 'multi-beta')
    expect(alphaMap?.['alpha']).toMatch(/^alpha\.[0-9a-f]{8}$/)
    expect(betaMap?.['beta']).toMatch(/^beta\.[0-9a-f]{8}$/)

    const alphaDecoded = await decodeTemplate(
      path.join(distRoot, 'multi-alpha.lynx.bundle'),
    )
    const betaDecoded = await decodeTemplate(
      path.join(distRoot, 'multi-beta.lynx.bundle'),
    )
    expect(Object.keys(alphaDecoded['custom-sections'])).toStrictEqual([
      alphaMap!['alpha'],
    ])
    expect(Object.keys(betaDecoded['custom-sections'])).toStrictEqual([
      betaMap!['beta'],
    ])
  })
})
