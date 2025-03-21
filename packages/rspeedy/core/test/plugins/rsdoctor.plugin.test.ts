// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'
import type { RsdoctorRspackPlugin } from '@rsdoctor/rspack-plugin'
import { describe, expect, test, vi } from 'vitest'

describe('Plugins - Rsdoctor', () => {
  test('defaults', async () => {
    vi.stubEnv('RSDOCTOR', 'true')

    const { createStubRspeedy } = await import('../createStubRspeedy.js')

    const rsbuild = await createStubRspeedy({})

    const compiler = await rsbuild.createCompiler<Rspack.Compiler>()

    const { options } = compiler.options.plugins.find(
      (plugin) => (typeof plugin === 'object'
        && plugin?.['isRsdoctorPlugin'] === true),
    ) as RsdoctorRspackPlugin<[]>

    expect(options.linter.rules).toEqual({
      'ecma-version-check': [
        'Warn',
        { ecmaVersion: 2019 },
      ],
    })

    expect(options.supports.banner).toBe(true)
  })

  test('linter.rules.ecma-version-check', async () => {
    vi.stubEnv('RSDOCTOR', 'true')

    const { createStubRspeedy } = await import('../createStubRspeedy.js')

    const rsbuild = await createStubRspeedy({
      tools: {
        rsdoctor: {
          linter: {
            rules: {
              'ecma-version-check': ['Error', { ecmaVersion: 2019 }],
            },
          },
        },
      },
    })

    const compiler = await rsbuild.createCompiler<Rspack.Compiler>()

    const { options } = compiler.options.plugins.find(
      (plugin) => (typeof plugin === 'object'
        && plugin?.['isRsdoctorPlugin'] === true),
    ) as RsdoctorRspackPlugin<[]>

    expect(options.linter.rules).toEqual({
      'ecma-version-check': [
        'Error',
        { ecmaVersion: 2019 },
        // We are using `mergeRsbuildConfig` to merge Rsdoctor options.
        // So the options of linter.rules will come twice :)
        // But it should just work.
        'Error',
        { ecmaVersion: 2019 },
      ],
    })
  })

  test('linter.rules.cross-chunks-package', async () => {
    vi.stubEnv('RSDOCTOR', 'true')

    const { createStubRspeedy } = await import('../createStubRspeedy.js')

    const rsbuild = await createStubRspeedy({
      tools: {
        rsdoctor: {
          linter: {
            rules: {
              'cross-chunks-package': [
                'Error',
                {
                  ignore: ['react'],
                },
              ],
            },
          },
        },
      },
    })

    const compiler = await rsbuild.createCompiler<Rspack.Compiler>()

    const { options } = compiler.options.plugins.find(
      (plugin) => (typeof plugin === 'object'
        && plugin?.['isRsdoctorPlugin'] === true),
    ) as RsdoctorRspackPlugin<[]>

    expect(options.linter.rules).toEqual({
      'cross-chunks-package': [
        'Error',
        { ignore: ['react'] },
      ],
      'ecma-version-check': [
        'Warn',
        { ecmaVersion: 2019 },
      ],
    })
  })

  test('supports.banner', async () => {
    vi.stubEnv('RSDOCTOR', 'true')

    const { createStubRspeedy } = await import('../createStubRspeedy.js')

    const rsbuild = await createStubRspeedy({
      tools: {
        rsdoctor: {
          supports: {
            banner: false,
          },
        },
      },
    })

    const compiler = await rsbuild.createCompiler<Rspack.Compiler>()

    const { options } = compiler.options.plugins.find(
      (plugin) => (typeof plugin === 'object'
        && plugin?.['isRsdoctorPlugin'] === true),
    ) as RsdoctorRspackPlugin<[]>

    expect(options.supports.banner).toBe(false)
  })
})
