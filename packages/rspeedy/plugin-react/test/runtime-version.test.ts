// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function expectRuntimeVersionRegistration(
  source: string | undefined,
  runtimeVersion: string,
): void {
  expect(source).toBeDefined()
  expect(source).toMatch(
    new RegExp(
      String
        .raw`ReactInternal\.registerRuntimeVersion[\s\S]{0,320}\.call\(ReactInternal,[\s\S]{0,80}${
        escapeRegExp(JSON.stringify(runtimeVersion))
      }\)`,
    ),
  )
}

function expectBundledRuntimeVersionRegistration(
  source: string | undefined,
  runtimeVersion: string,
): void {
  expect(source).toBeDefined()
  expect(source).toMatch(
    new RegExp(
      String.raw`registerRuntimeVersion\)?\s*\([\s\S]{0,80}${
        escapeRegExp(JSON.stringify(runtimeVersion))
      }`,
    ),
  )
}

// Assert the runtime-version registration markers we expect to see in each
// artifact category:
//   - Host background: emits the `[ReactLynx] new runtime version` alog and
//     references the shared `__REACT_LYNX_RUNTIME_VERSION__` symbol.
//   - Host main-thread: still calls `registerRuntimeVersion` and references
//     the symbol (so the shared property is defined on lepus too), but the
//     `console.alog` log is gated by `__JS__` and DCE-elided so main-thread
//     stays small.
//   - Inline lazy bundle: shares its host compilation and does not register
//     separately.
//   - Standalone lazy bundle: calls the host's registration API with its own
//     build-time version, without bundling the implementation or symbol.

describe('runtime version bundle markers', () => {
  test('host and inline lazy bundle built together register only the host runtime', async () => {
    rstest.stubEnv('NODE_ENV', 'development')
    const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
    const { version: runtimeVersion } = JSON.parse(
      await fs.readFile(
        new URL('../../../react/package.json', import.meta.url),
        'utf8',
      ),
    ) as { version: string }

    const assets = new Map<string, string>()
    const tmp = await fs.mkdtemp(
      path.join(tmpdir(), 'rspeedy-react-test-runtime-version-host-'),
    )

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: fileURLToPath(
              new URL('./fixtures/lazy-bundle/index.tsx', import.meta.url),
            ),
          },
        },
        output: { distPath: { root: tmp } },
        plugins: [
          pluginReactLynx(),
          {
            name: 'test',
            pre: ['lynx:react'],
            setup(api) {
              api.modifyBundlerChain((chain, { CHAIN_ID }) => {
                const rule = chain.module
                  .rules.get('css:react:main-thread')
                  .uses.get(CHAIN_ID.USE.IGNORE_CSS)
                rule.loader(rule.get('loader')! + '.ts')
              })
            },
          } as RsbuildPlugin,
        ],
        tools: {
          rspack: {
            plugins: [
              {
                name: 'capture-assets',
                apply(compiler) {
                  compiler.hooks.compilation.tap(
                    'capture-assets',
                    compilation => {
                      compilation.hooks.processAssets.tap(
                        'capture-assets',
                        (rawAssets) => {
                          for (const key of Object.keys(rawAssets)) {
                            if (key.endsWith('.js')) {
                              assets.set(
                                key,
                                rawAssets[key]!.source().toString(),
                              )
                            }
                          }
                        },
                      )
                    },
                  )
                },
              } as Rspack.RspackPluginInstance,
            ],
          },
        },
      },
    })

    try {
      await rsbuild.build()

      const hostBackground = [...assets].find(([k]) =>
        /\.lynx[\\/]main[\\/]background\.js$/.test(k)
      )?.[1]
      const hostMainThread = [...assets].find(([k]) =>
        /\.lynx[\\/]main[\\/]main-thread\.js$/.test(k)
      )?.[1]
      const lazyBackground = [...assets].find(([k]) =>
        /lazy-bundle[\\/].*LazyComponent[^\\/]*[\\/]background\.js$/.test(k)
      )?.[1]
      const lazyMainThread = [...assets].find(([k]) =>
        /lazy-bundle[\\/].*LazyComponent[^\\/]*[\\/]main-thread\.js$/.test(k)
      )?.[1]

      expect(hostBackground).toBeDefined()
      expect(hostMainThread).toBeDefined()
      expect(lazyBackground).toBeDefined()
      expect(lazyMainThread).toBeDefined()

      // The host registers the build-time version in both runtimes.
      expect(hostBackground).toContain('[ReactLynx] new runtime version')
      expect(hostBackground).toContain('__REACT_LYNX_RUNTIME_VERSION__')
      expectBundledRuntimeVersionRegistration(hostBackground, runtimeVersion)

      expect(hostMainThread).not.toContain('[ReactLynx] new runtime version')
      expect(hostMainThread).toContain('__REACT_LYNX_RUNTIME_VERSION__')
      expectBundledRuntimeVersionRegistration(hostMainThread, runtimeVersion)

      // Inline lazy bundle (the LazyComponent chunk emitted alongside the
      // host): the host owns the runtime, so the lazy chunk carries no
      // registration copy at all — no alog string, no symbol constant, and
      // no `registerRuntimeVersion` invocation of its own.
      expect(lazyBackground).not.toContain('[ReactLynx] new runtime version')
      expect(lazyBackground).not.toContain('__REACT_LYNX_RUNTIME_VERSION__')
      expect(lazyBackground).not.toContain('registerRuntimeVersion')
      expect(lazyMainThread).not.toContain('[ReactLynx] new runtime version')
      expect(lazyMainThread).not.toContain('__REACT_LYNX_RUNTIME_VERSION__')
      expect(lazyMainThread).not.toContain('registerRuntimeVersion')
    } finally {
      rstest.unstubAllEnvs()
      await fs.rm(tmp, { recursive: true, force: true })
    }
  })

  test.each([
    {
      backend: 'Snapshot',
      experimental_useElementTemplate: false,
      fixture: './fixtures/standalone-lazy-bundle/index.tsx',
    },
    {
      backend: 'Element Template',
      experimental_useElementTemplate: true,
      fixture: './fixtures/standalone-lazy-bundle/element-template.tsx',
    },
  ])(
    'independently built standalone $backend lazy bundle registers its own version via host runtime',
    async ({ experimental_useElementTemplate, fixture }) => {
      rstest.stubEnv('NODE_ENV', 'development')
      const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
      const { version: runtimeVersion } = JSON.parse(
        await fs.readFile(
          new URL('../../../react/package.json', import.meta.url),
          'utf8',
        ),
      ) as { version: string }

      const assets = new Map<string, string>()
      const tmp = await fs.mkdtemp(
        path.join(tmpdir(), 'rspeedy-react-test-runtime-version-standalone-'),
      )

      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: {
            entry: {
              main: fileURLToPath(
                new URL(fixture, import.meta.url),
              ),
            },
          },
          output: { distPath: { root: tmp } },
          plugins: [
            pluginReactLynx({
              experimental_isLazyBundle: true,
              experimental_useElementTemplate,
            }),
          ],
          tools: {
            rspack: {
              plugins: [
                {
                  name: 'capture-assets',
                  apply(compiler) {
                    compiler.hooks.compilation.tap(
                      'capture-assets',
                      compilation => {
                        compilation.hooks.processAssets.tap(
                          'capture-assets',
                          (rawAssets) => {
                            for (const key of Object.keys(rawAssets)) {
                              if (key.endsWith('.js')) {
                                assets.set(
                                  key,
                                  rawAssets[key]!.source().toString(),
                                )
                              }
                            }
                          },
                        )
                      },
                    )
                  },
                } as Rspack.RspackPluginInstance,
              ],
            },
          },
        },
      })

      try {
        await rsbuild.build()

        const background = [...assets].find(([k]) =>
          /background.*?\.js$/.test(k)
        )
          ?.[1]
        const mainThread = [...assets].find(([k]) =>
          /main-thread.*?\.js$/.test(k)
        )?.[1]

        expect(background).toBeDefined()
        expect(mainThread).toBeDefined()

        // The property access proves that the lazy shell invokes the host API;
        // a bare identifier could merely be part of the exports destructuring.
        expect(background).not.toContain('[ReactLynx] new runtime version')
        expect(background).not.toContain('__REACT_LYNX_RUNTIME_VERSION__')
        expectRuntimeVersionRegistration(background, runtimeVersion)

        expect(mainThread).not.toContain('[ReactLynx] new runtime version')
        expect(mainThread).not.toContain('__REACT_LYNX_RUNTIME_VERSION__')
        expectRuntimeVersionRegistration(mainThread, runtimeVersion)
      } finally {
        rstest.unstubAllEnvs()
        await fs.rm(tmp, { recursive: true, force: true })
      }
    },
  )
})
