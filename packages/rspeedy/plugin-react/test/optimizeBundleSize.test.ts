// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import type { RspeedyInstance } from '@lynx-js/rspeedy'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

async function getCode(rsbuild: RspeedyInstance, entryName: string) {
  try {
    await rsbuild.build()
  } catch (_error) {
    expect.fail('build should succeed')
  }

  const mainThreadPath = path.join(
    rsbuild.context.distPath,
    '.rspeedy',
    entryName,
    'main-thread.js',
  )
  const backgroundPath = path.join(
    rsbuild.context.distPath,
    '.rspeedy',
    entryName,
    'background.js',
  )

  if (!existsSync(mainThreadPath) || !existsSync(backgroundPath)) {
    expect.fail('expected main-thread and background outputs to exist')
  }

  const mainThreadCode = readFileSync(mainThreadPath, 'utf8')
  const backgroundCode = readFileSync(backgroundPath, 'utf8')
  return { mainThreadCode, backgroundCode }
}
describe('optimizeBundleSize', () => {
  test('basic usage', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    vi.stubEnv('NODE_ENV', 'production')
    const entryName = 'optimizeBundleSize-0'
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            [entryName]:
              new URL('./fixtures/pure-funcs/basic.js', import.meta.url)
                .pathname,
          },
        },
        output: {
          filenameHash: false,
          minify: {
            js: true,
          },
          cleanDistPath: false,
        },
        environments: {
          lynx: {},
        },
        plugins: [pluginReactLynx({
          optimizeBundleSize: true,
        })],
      },
    })

    const [config] = await rsbuild.initConfigs()
    expect(config?.optimization?.minimizer).toMatchSnapshot()
    const { mainThreadCode, backgroundCode } = await getCode(rsbuild, entryName)

    expect(mainThreadCode).not.toContain('background-only')
    expect(mainThreadCode).toContain('main-thread-only')
    expect(mainThreadCode).toContain('default console.info')
    expect(mainThreadCode).toContain('default console.warn')

    expect(backgroundCode).toContain('background-only')
    expect(backgroundCode).not.toContain('main-thread-only')
    expect(backgroundCode).toContain('default console.info')
    expect(backgroundCode).toContain('default console.warn')
  })

  test('optimize background code', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    vi.stubEnv('NODE_ENV', 'production')

    const entryName = 'optimizeBundleSize-1'
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            [entryName]:
              new URL('./fixtures/pure-funcs/basic.js', import.meta.url)
                .pathname,
          },
        },
        output: {
          filenameHash: false,
          cleanDistPath: false,
          minify: {
            js: true,
            jsOptions: {
              minimizerOptions: {
                compress: {
                  pure_funcs: ['console.info'],
                },
              },
            },
          },
        },
        environments: {
          lynx: {},
        },
        plugins: [pluginReactLynx({
          optimizeBundleSize: {
            background: true,
          },
        })],
      },
    })

    const [config] = await rsbuild.initConfigs()
    expect(config?.optimization?.minimizer).toMatchSnapshot()

    const { mainThreadCode, backgroundCode } = await getCode(rsbuild, entryName)
    expect(mainThreadCode).toContain('background-only')
    expect(mainThreadCode).toContain('main-thread-only')
    expect(mainThreadCode).not.toContain('default console.info')
    expect(mainThreadCode).toContain('default console.warn')

    expect(backgroundCode).toContain('background-only')
    expect(backgroundCode).not.toContain('main-thread-only')
    expect(backgroundCode).not.toContain('default console.info')
    expect(backgroundCode).toContain('default console.warn')
  })

  test('optimize main-thread code', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    vi.stubEnv('NODE_ENV', 'production')
    const entryName = 'optimizeBundleSize-2'
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            [entryName]:
              new URL('./fixtures/pure-funcs/basic.js', import.meta.url)
                .pathname,
          },
        },
        output: {
          filenameHash: false,
          cleanDistPath: false,
          minify: {
            js: true,
            jsOptions: {
              minimizerOptions: {
                compress: {
                  pure_funcs: ['console.info'],
                },
              },
            },
          },
        },
        environments: {
          lynx: {},
        },
        plugins: [pluginReactLynx({
          optimizeBundleSize: {
            mainThread: true,
          },
        })],
      },
    })

    const { mainThreadCode, backgroundCode } = await getCode(rsbuild, entryName)

    expect(mainThreadCode).not.toContain('background-only')
    expect(mainThreadCode).toContain('main-thread-only')
    expect(mainThreadCode).not.toContain('default console.info')
    expect(mainThreadCode).toContain('default console.warn')

    expect(backgroundCode).toContain('background-only')
    expect(backgroundCode).toContain('main-thread-only')
    expect(backgroundCode).not.toContain('default console.info')
    expect(backgroundCode).toContain('default console.warn')
  })

  test('merge backgroundOptions and mainThreadOptions', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    vi.stubEnv('NODE_ENV', 'production')

    const entryName = 'optimizeBundleSize-3'
    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            [entryName]:
              new URL('./fixtures/pure-funcs/basic.js', import.meta.url)
                .pathname,
          },
        },
        output: {
          filenameHash: false,
          cleanDistPath: false,
          minify: {
            js: true,
            mainThreadOptions: {
              minimizerOptions: {
                compress: {
                  pure_funcs: ['console.info'],
                },
              },
            },
            backgroundOptions: {
              minimizerOptions: {
                compress: {
                  pure_funcs: ['console.warn'],
                },
              },
            },
          },
        },
        environments: {
          lynx: {},
        },
        plugins: [pluginReactLynx({
          optimizeBundleSize: true,
        })],
      },
    })

    const { mainThreadCode, backgroundCode } = await getCode(rsbuild, entryName)
    expect(mainThreadCode).not.toContain('background-only')
    expect(mainThreadCode).toContain('main-thread-only')
    expect(mainThreadCode).not.toContain('default console.info')
    expect(mainThreadCode).toContain('default console.warn')

    expect(backgroundCode).toContain('background-only')
    expect(backgroundCode).not.toContain('main-thread-only')
    expect(backgroundCode).toContain('default console.info')
    expect(backgroundCode).not.toContain('default console.warn')
  })
})
