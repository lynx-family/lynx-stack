// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  copyFile,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy } from '../createStubRspeedy.js'

const SCRIPT_REGEXP = /\.(?:js|jsx|mjs|cjs|ts|tsx|mts|cts)$/
const PNG_FIXTURE = fileURLToPath(
  new URL(
    './fixtures/hello-world/logo.png',
    import.meta.url,
  ),
)

describe('Plugins - Optimization', () => {
  test('concatenateModules production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    // We use the default value of Rspack(`true` for production)
    expect(config.optimization?.concatenateModules).toBeUndefined()
  })

  test('concatenateModules development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    // We use the default value of Rspack(`false` for development)
    expect(config.optimization?.concatenateModules).toBeUndefined()
  })

  test('realContentHash', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    // We use the default value of Rspack(`true` for production)
    expect(config.optimization?.realContentHash).toBeUndefined()
  })

  test('overrideStrict', async () => {
    const rsbuild = await createStubRspeedy({})

    const config = await rsbuild.unwrapConfig()

    const javascriptRules = config.module?.rules?.filter(rule =>
      rule && rule !== '...' && rule.type?.includes('javascript')
    )

    expect(javascriptRules?.length).toBeGreaterThan(0)

    expect(
      javascriptRules?.some(rule =>
        rule
        && rule !== '...'
        && rule.parser?.['overrideStrict'] === 'strict'
        && rule.include === undefined
        && (rule.test as RegExp | undefined)?.toString()
          === SCRIPT_REGEXP.toString()
      ),
    ).toBeTruthy()
  })

  test('overrideStrict should not parse png as JavaScript without ReactLynx plugin', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const root = await mkdtemp(path.join(tmpdir(), 'rspeedy-png-asset-'))
    try {
      await mkdir(path.join(root, 'src'))
      await writeFile(
        path.join(root, 'src/index.js'),
        'import logo from \'./logo.png\';\nconsole.info(logo);\n',
      )
      await copyFile(PNG_FIXTURE, path.join(root, 'src/logo.png'))

      const rspeedy = await createStubRspeedy({}, root)
      const result = await rspeedy.build()
      await result.close()

      await expect(
        readdir(path.join(root, 'dist/static/image')),
      ).resolves.toContainEqual(expect.stringMatching(/^logo\..+\.png$/))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('avoidEntryIife production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.avoidEntryIife).toBe(true)
  })

  test('avoidEntryIife development', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const rspeedy = await createStubRspeedy({})

    const config = await rspeedy.unwrapConfig()

    expect(config.optimization?.avoidEntryIife).toBeUndefined()
  })
})
