// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { glob, mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'
import { SourceMapConsumer } from 'source-map'
import type { RawSourceMap } from 'source-map'
import { beforeAll, describe, expect, test, vi } from 'vitest'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

const functionNames = [
  'functionThatThrows',
  'innerFunction',
  'function renderComponent',
]

describe('Sourcemap', async () => {
  const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-test'))
  beforeAll(async () => {
    vi.stubEnv('DEBUG', 'rspeedy')

    const { pluginReactLynx } = await import('../src/index.js')

    const rsbuild = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL('./fixtures/sourcemap/index.tsx', import.meta.url)
              .pathname,
          },
        },
        output: {
          distPath: {
            root: tmp,
          },
          filenameHash: false,
          minify: false,
        },
        plugins: [
          pluginReactLynx(),
          // This is to simulate cases that there
          // are other loaders before our @lynx-js/react/transform
          // we can pass the sourcemap from previous loaders to our transform
          {
            name: 'swc-loader-before-swc-transform',
            setup(api) {
              api.modifyBundlerChain((chain) => {
                const rule = chain.module.rule(
                  'swc-loader-before-swc-transform',
                )
                rule
                  .test(/\.[jt]sx$/)
                  .use('swc-loader-before-swc-transform')
                  .loader('builtin:swc-loader')
                  .options({
                    jsc: {
                      parser: {
                        syntax: 'typescript',
                        tsx: true,
                      },
                      transform: {
                        react: {
                          runtime: 'automatic',
                        },
                      },
                    },
                    sourceMaps: true,
                  })
                  .end()
              })
            },
          } as RsbuildPlugin,
        ],
      },
    })

    const result = await rsbuild.build()
    await result.close()
  })

  test('sourcemap should map from compiled code to original source code', async () => {
    // find all `*.js.map` files inside tmp
    const sourceMapFiles = []
    for await (
      const file of glob([
        path.join(tmp, '**/*.js.map'),
        // for files inside `.rspeedy`
        path.join(tmp, '.*/**/*.js.map'),
      ])
    ) {
      sourceMapFiles.push(path.relative(tmp, file))
    }

    expect(sourceMapFiles).toMatchInlineSnapshot(`
      [
        ".rspeedy/main/background.js.map",
        ".rspeedy/main/main-thread.js.map",
        "static/js/async/lazy-bundle-comp.jsx-react__background.js.map",
        "static/js/async/lazy-bundle-comp.jsx-react__main-thread.js.map",
      ]
    `)

    const backgroundSource = await readFile(
      path.join(tmp, '.rspeedy/main/background.js'),
      'utf-8',
    )
    const backgroundSourceMap = JSON.parse(
      await readFile(
        path.join(tmp, '.rspeedy/main/background.js.map'),
        'utf-8',
      ),
    ) as RawSourceMap

    const consumer = await new SourceMapConsumer(backgroundSourceMap)
    const functionName2Source: Record<string, string | null> = {}
    functionNames.forEach((name) => {
      const backgroundSourceLines = backgroundSource.split('\n')
      let line = -1, column = -1
      backgroundSourceLines.forEach((lineContent, index) => {
        if (lineContent.includes(name)) {
          line = index + 1
          column = lineContent.indexOf(name) + 1
        }
      })
      functionName2Source[name] = consumer
        .originalPositionFor({
          line,
          column,
        })
    })
    expect(functionName2Source).toMatchInlineSnapshot(`
      {
        "function renderComponent": {
          "column": 0,
          "line": 296,
          "name": null,
          "source": "webpack:///node_modules/<PNPM_INNER>/@hongzhiyuan/preact/dist/preact.mjs",
        },
        "functionThatThrows": {
          "column": 0,
          "line": 18,
          "name": null,
          "source": "webpack:///fixtures/sourcemap/index.tsx",
        },
        "innerFunction": {
          "column": 0,
          "line": 13,
          "name": null,
          "source": "webpack:///fixtures/sourcemap/index.tsx",
        },
      }
    `)
  })
})
