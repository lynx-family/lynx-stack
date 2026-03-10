// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

vi
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

describe('shake dataProcessor', () => {
  test('should shake lynx.registerDataProcessors in background', async () => {
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')

    const rsbuild = await createRspeedy({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rspeedyConfig: {
        source: {
          entry: {
            main: './fixtures/dataProcessor/index.tsx',
          },
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    await rsbuild.build()

    const {
      output,
    } = await rsbuild.initConfigs().then(configs => {
      return configs[0]!
    })

    if (!output?.path) {
      throw new Error('distPath.root is undefined')
    }

    const tasmPath = join(output.path, '.rspeedy/main/tasm.json')
    const tasmContent = JSON.parse(readFileSync(tasmPath, 'utf-8')) as {
      lepusCode: {
        root: string
      }
      manifest: Record<string, string>
    }

    for (const key in tasmContent.manifest) {
      if (!key.includes('background')) continue
      const backgroundContent = tasmContent.manifest[key]
      expect(backgroundContent).not.toContain('dataProcessor-default')
      expect(backgroundContent).not.toContain('dataProcessor-a')
      // cannot shake dataProcessorB in background
      expect(backgroundContent).toContain('dataProcessor-b')
    }
    const mainThreadContent = tasmContent.lepusCode.root
    expect(mainThreadContent).toContain('dataProcessor-default')
    expect(mainThreadContent).toContain('dataProcessor-a')
    expect(mainThreadContent).toContain('dataProcessor-b')
  })
})
