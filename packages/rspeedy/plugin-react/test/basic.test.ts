// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test, vi } from 'vitest'

import { createRspeedy } from '@lynx-js/rspeedy'

import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

vi
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'development')

describe('ReactLynx rsbuild', () => {
  test('basic usage', async () => {
    // TODO(react-refresh): support refresh
    vi.stubEnv('NODE_ENV', 'production')
    const { pluginReactLynx } = await import('../src/index.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          tsconfigPath: new URL('./tsconfig.json', import.meta.url).pathname,
          entry: {
            main: new URL('./fixtures/basic.tsx', import.meta.url).pathname,
          },
        },
        tools: {
          rspack: {
            context: dirname(fileURLToPath(import.meta.url)),
            resolve: {
              extensionAlias: {
                '.js': ['.ts', '.js'],
                '.jsx': ['.tsx', '.jsx'],
              },
            },
          },
        },
        plugins: [
          pluginReactLynx(),
          pluginStubRspeedyAPI(),
        ],
      },
    })

    await rsbuild.build()

    expect(1).toBe(1)
  })

  test('special var name', async () => {
    const { pluginReactLynx } = await import('../src/index.js')
    vi.stubEnv('NODE_ENV', 'production')

    const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-test'))

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        source: {
          tsconfigPath: new URL('./tsconfig.json', import.meta.url).pathname,
          entry: {
            main: new URL(
              './fixtures/special-var-name/index.jsx',
              import.meta.url,
            ).pathname,
          },
        },
        output: {
          distPath: {
            root: tmp,
          },
          filenameHash: false,
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    const result = await rspeedy.build()

    await result.close()

    const backgroundJSPath = path.resolve(tmp, '.rspeedy/main/background.js')
    expect(existsSync(backgroundJSPath)).toBe(true)

    const define = vi.fn()

    Object.assign(globalThis, {
      tt: {
        define,
        require: vi.fn(),
      },
    })
    await expect(import(backgroundJSPath)).resolves.not.toThrow()
    expect(define).toHaveBeenCalledWith('background.js', expect.any(Function))
  })
})
