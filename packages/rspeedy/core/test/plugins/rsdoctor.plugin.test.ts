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

  test('validates current and legacy Rsdoctor options', async () => {
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
    ).toBe(true)
  })

  test('migrates legacy Rsdoctor options before plugin construction', async () => {
    rstest.stubEnv('RSDOCTOR', 'true')
    const { createStubRspeedy } = await import('../createStubRspeedy.js')
    const rsbuild = await createStubRspeedy({
      tools: {
        rsdoctor: {
          port: 3300,
          mode: 'brief',
          brief: { writeDataJson: true },
          experiments: { enableNativePlugin: false },
          supports: { generateTileGraph: true },
        },
      },
    })
    const compiler = await rsbuild.createCompiler() as Rspack.Compiler
    const { options } = compiler.options.plugins?.find(
      (plugin) => (typeof plugin === 'object'
        && plugin?.['isRsdoctorPlugin'] === true),
    ) as RsdoctorRspackPlugin<[]>

    expect(options.server.port).toBe(3300)
    expect(options.output).toMatchObject({
      mode: 'brief',
      options: { type: ['html', 'json'] },
    })
    expect(options).not.toHaveProperty('experiments')
    expect(options.supports).not.toHaveProperty('generateTileGraph')
  })

  test('prefers current options over legacy options and preserves defaults', async () => {
    rstest.stubEnv('RSDOCTOR', 'true')
    const { createStubRspeedy } = await import('../createStubRspeedy.js')
    const rsdoctor = {
      port: 3300,
      server: { port: 4400 },
      mode: 'brief' as const,
      output: { mode: 'normal' as const },
    }
    const original = structuredClone(rsdoctor)
    const rsbuild = await createStubRspeedy({ tools: { rsdoctor } })
    const compiler = await rsbuild.createCompiler() as Rspack.Compiler
    const plugin = compiler.options.plugins.find(
      plugin =>
        typeof plugin === 'object' && plugin?.['isRsdoctorPlugin'] === true,
    ) as RsdoctorRspackPlugin<[]>

    expect(plugin.options.server.port).toBe(4400)
    expect(plugin.options.output.mode).toBe('normal')
    expect(plugin.options.supports.banner).toBe(true)
    expect(plugin.options.linter.rules['ecma-version-check']).toEqual([
      'Warn',
      { ecmaVersion: 2019 },
    ])
    expect(rsdoctor).toEqual(original)
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
