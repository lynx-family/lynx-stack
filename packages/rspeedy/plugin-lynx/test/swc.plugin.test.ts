// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

import type { RsbuildPluginAPI, Rspack } from '@rsbuild/core'
import { describe, expect, onTestFinished, test } from '@rstest/core'

import { createStubRsbuild } from './createStubRsbuild.js'
import { getLoaderOptions } from './getLoaderOptions.js'
import {
  ES_ENV_TARGETS,
  getESVersionEnvInclude,
} from '../src/utils/getESVersionTarget.js'

describe('pluginSwc', () => {
  test('defaults', async () => {
    const rsbuild = await createStubRsbuild({ mode: 'production' })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.env?.targets).toEqual(ES_ENV_TARGETS)
    expect(loaderOptions?.env?.include).toEqual([
      'transform-block-scoping',
      ...getESVersionEnvInclude(),
      'es.object.has-own',
    ])
  })

  test.each([false, true])(
    'builtin compatibility with explicit exclusion %s',
    async excluded => {
      const rsbuild = await createStubRsbuild({
        source: { preEntry: './bootstrap.js', exclude: [/vendor/] },
        ...excluded
          ? { tools: { swc: { env: { exclude: ['es.object.has-own'] } } } }
          : {},
      })
      const options = getLoaderOptions<Rspack.SwcLoaderOptions>(
        await rsbuild.unwrapConfig(),
        'builtin:swc-loader',
      )
      expect(options?.env?.include?.includes('es.object.has-own')).toBe(
        !excluded,
      )
      const config = rsbuild.getNormalizedConfig().environments['lynx']!
      expect(config.source.preEntry).toEqual(['./bootstrap.js'])
      expect(config.source.exclude?.[0]).toEqual(/vendor/)
      expect(
        config.source.exclude?.some(rule =>
          rule instanceof RegExp
          && rule.test(
            '/project/node_modules/core-js/modules/es.object.has-own.js',
          )
        ),
      ).toBe(true)
    },
  )

  test('builtin compatibility only applies to Lynx environments', async () => {
    const rsbuild = await createStubRsbuild({
      environments: { 'lynx-app': {}, web: {} },
    })
    for (const config of await rsbuild.initConfigs()) {
      const options = getLoaderOptions<Rspack.SwcLoaderOptions>(
        config,
        'builtin:swc-loader',
      )
      expect(options?.env?.include?.includes('es.object.has-own')).toBe(
        config.name === 'lynx-app',
      )
      expect(
        rsbuild.getNormalizedConfig().environments[config.name!]!.source
          .preEntry,
      ).toEqual([])
    }
  })

  test.each([false, true])(
    'standalone application without core-js, exclusion=%s',
    async excluded => {
      const projectPath = await mkdtemp(path.join(tmpdir(), 'lynx-has-own-'))
      onTestFinished(() => rm(projectPath, { recursive: true, force: true }))
      const entry = path.join(projectPath, 'index.js')
      await writeFile(
        entry,
        await readFile(
          new URL('./fixtures/object-has-own.js', import.meta.url),
        ),
      )
      const rsbuild = await createStubRsbuild({
        mode: 'production',
        splitChunks: false,
        source: { entry: { main: entry } },
        output: {
          distPath: { root: path.join(projectPath, 'dist'), js: '' },
          filename: { js: 'main.js' },
          filenameHash: false,
          minify: false,
          sourceMap: false,
        },
        tools: {
          // Only search the isolated application's empty dependency directory.
          rspack: {
            resolve: { modules: [path.join(projectPath, 'node_modules')] },
          },
          ...excluded
            ? { swc: { env: { exclude: ['es.object.has-own'] } } }
            : {},
        },
      }, projectPath)
      await rsbuild.build()
      const code = await readFile(
        path.join(projectPath, 'dist/main.js'),
        'utf8',
      )
      const context = {}
      runInNewContext(`delete Object.hasOwn;\n${code}`, context)
      expect(runInNewContext('__hasOwnAtEntry', context)).toBe(!excluded)
      if (excluded) {
        expect(runInNewContext('typeof Object.hasOwn', context)).toBe(
          'undefined',
        )
        return
      }
      expect(runInNewContext('__checkHasOwn()', context)).toEqual([
        true,
        false,
        true,
        true,
        true,
        true,
      ])
    },
  )

  test('user-configured jsc.target throws (target is managed via env)', async () => {
    const rsbuild = await createStubRsbuild({
      tools: {
        swc: {
          jsc: {
            target: 'es5',
          },
        },
      },
    })

    await expect(rsbuild.unwrapConfig()).rejects.toThrowError(
      /Rspeedy manages the SWC compilation target via `env`/,
    )
  })

  test('user can opt out of transform-block-scoping via env.exclude', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      tools: {
        swc: {
          env: {
            exclude: ['transform-block-scoping'],
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.env?.exclude).toEqual(['transform-block-scoping'])
    expect(loaderOptions?.env?.include).toContain(
      'transform-async-generator-functions',
    )
  })

  test('user-configured env.include is merged onto the baseline', async () => {
    const rsbuild = await createStubRsbuild({
      mode: 'production',
      tools: {
        swc: {
          env: {
            include: ['transform-spread'],
          },
        },
      },
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.env?.include).toContain('transform-spread')
    expect(loaderOptions?.env?.include).toContain('transform-block-scoping')
    expect(loaderOptions?.env?.include).toContain(
      'transform-async-generator-functions',
    )
    expect(loaderOptions?.env?.targets).toEqual(ES_ENV_TARGETS)
  })

  test('modify swc config from plugin', async () => {
    const rsbuild = await createStubRsbuild({
      plugins: [
        {
          name: 'test:swc',
          setup(api: RsbuildPluginAPI) {
            api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
              return mergeRsbuildConfig(config, {
                tools: {
                  swc(config) {
                    config.minify = true
                    return config
                  },
                },
              })
            })
          },
        },
      ],
    })

    const config = await rsbuild.unwrapConfig()
    const loaderOptions = getLoaderOptions<Rspack.SwcLoaderOptions>(
      config,
      'builtin:swc-loader',
    )

    expect(loaderOptions?.minify).toBe(true)
    expect(loaderOptions?.env?.targets).toEqual(ES_ENV_TARGETS)
    expect(loaderOptions?.env?.include).toContain('transform-block-scoping')
  })
})
