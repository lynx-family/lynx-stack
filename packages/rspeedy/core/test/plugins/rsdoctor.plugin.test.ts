// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { Rspack } from '@rsbuild/core'
import { RsdoctorRspackPlugin } from '@rsdoctor/core'
import { describe, expect, rstest, test } from '@rstest/core'

describe('Plugins - Rsdoctor', () => {
  test('defaults', async () => {
    rstest.stubEnv('RSDOCTOR', 'true')

    const { createStubRspeedy } = await import('../createStubRspeedy.js')

    const rsbuild = await createStubRspeedy({})

    const compiler = await rsbuild.createCompiler() as Rspack.Compiler

    const { options } = compiler.options.plugins
      ?.find(
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

    expect(options).not.toHaveProperty('experiments.enableNativePlugin')
  })

  test('does not register twice when a custom Rsdoctor 2 plugin is provided', async () => {
    rstest.stubEnv('RSDOCTOR', 'true')

    const { createStubRspeedy } = await import('../createStubRspeedy.js')
    const plugin = new RsdoctorRspackPlugin({ disableClientServer: true })
    const rsbuild = await createStubRspeedy({
      tools: {
        rspack: { plugins: [plugin] },
      },
    })
    const compiler = await rsbuild.createCompiler() as Rspack.Compiler
    const plugins = compiler.options.plugins.filter(
      plugin =>
        typeof plugin === 'object' && plugin?.['isRsdoctorPlugin'] === true,
    )

    expect(plugins).toEqual([plugin])
  })

  test('validates Rsdoctor 2 options and rejects the removed native plugin switch', async () => {
    const { validateConfig } = await import('../../src/config/validate.js')

    expect(
      validateConfig({
        tools: {
          rsdoctor: {
            server: { port: 3300 },
            output: { mode: 'brief' },
            supports: { brotli: { brotliLevel: 4 } },
          },
        },
      }).success,
    ).toBe(true)
    expect(
      validateConfig({
        tools: { rsdoctor: { experiments: { enableNativePlugin: false } } },
      }).success,
    ).toBe(false)
  })

  test('linter.rules.ecma-version-check', async () => {
    rstest.stubEnv('RSDOCTOR', 'true')

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

    const compiler = await rsbuild.createCompiler() as Rspack.Compiler

    const { options } = compiler.options.plugins
      ?.find(
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
    rstest.stubEnv('RSDOCTOR', 'true')

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

    const compiler = await rsbuild.createCompiler() as Rspack.Compiler

    const { options } = compiler.options.plugins
      ?.find(
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
    rstest.stubEnv('RSDOCTOR', 'true')

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

    const compiler = await rsbuild.createCompiler() as Rspack.Compiler

    const { options } = compiler.options.plugins
      ?.find(
        (plugin) => (typeof plugin === 'object'
          && plugin?.['isRsdoctorPlugin'] === true),
      ) as RsdoctorRspackPlugin<[]>

    expect(options.supports.banner).toBe(false)
  })
})
