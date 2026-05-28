// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// eslint-disable-next-line n/no-unsupported-features/node-builtins
import { glob, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin } from '@rsbuild/core'
import { SourceMapConsumer } from 'source-map'
import type { NullableMappedPosition, RawSourceMap } from 'source-map'
import { afterAll, afterEach, describe, expect, test, vi } from 'vitest'

import type { Output } from '@lynx-js/rspeedy'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

const functionNames = [
  'functionThatThrows',
  'innerFunction',
  'function renderComponent',
]
const tempDirs: string[] = []

afterAll(async () => {
  await Promise.all(tempDirs.map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})
afterEach(() => {
  vi.unstubAllEnvs()
})
async function buildSourcemapFixture(
  sourceMap: Output['sourceMap'] = undefined,
) {
  const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-test'))
  tempDirs.push(tmp)

  vi.stubEnv('DEBUG', 'rspeedy')

  const { pluginReactLynx } = await import('../src/index.js')

  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      source: {
        entry: {
          main: fileURLToPath(
            new URL('./fixtures/sourcemap/index.tsx', import.meta.url),
          ),
        },
      },
      output: {
        distPath: {
          root: tmp,
        },
        filenameHash: false,
        minify: false,
        sourceMap,
      },
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
              rule.loader(
                // add .ts suffix to ignore-css-loader
                // this workaround is needed because vitest
                // runs on our ts files.
                rule.get('loader') as string + '.ts',
              )
            })
          },
        } as RsbuildPlugin,
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

  return tmp
}

async function getSourceMapFiles(tmp: string) {
  const sourceMapFiles: string[] = []
  for await (
    const file of glob([
      path.join(tmp, '**/*.map'),
      // for files inside `.rspeedy`
      path.join(tmp, '.*/**/*.map'),
    ])
  ) {
    sourceMapFiles.push(normalizeSlashes(path.relative(tmp, file)))
  }

  return sourceMapFiles.sort()
}

describe('Sourcemap', () => {
  test('getSourceMapFiles returns sorted map paths', async () => {
    const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-test'))
    tempDirs.push(tmp)

    await mkdir(path.join(tmp, '.rspeedy/main'), { recursive: true })
    await mkdir(path.join(tmp, 'static/js/async'), { recursive: true })
    await writeFile(path.join(tmp, 'static/js/async/z-last.map'), '')
    await writeFile(path.join(tmp, '.rspeedy/main/a-first.map'), '')
    await writeFile(path.join(tmp, 'static/js/async/m-middle.map'), '')

    expect(await getSourceMapFiles(tmp)).toEqual([
      '.rspeedy/main/a-first.map',
      'static/js/async/m-middle.map',
      'static/js/async/z-last.map',
    ])
  })

  test('js sourcemaps are emitted by default', async () => {
    const tmp = await buildSourcemapFixture(undefined)
    const sourceMapFiles = await getSourceMapFiles(tmp)

    expect(sourceMapFiles).toEqual([
      '.rspeedy/main/background.js.map',
      '.rspeedy/main/main-thread.js.map',
      '.rspeedy/main/main.css.map',
      'static/js/async/lazy-bundle-comp.jsx-react__background.js.map',
      'static/js/async/lazy-bundle-comp.jsx-react__main-thread.js.map',
    ])
  }, 25_000)

  test(
    'debug-metadata injects a per-chunk source-map release banner',
    async () => {
      const tmp = await buildSourcemapFixture(undefined)
      const mainThread = await readFile(
        path.join(tmp, '.rspeedy/main/main-thread.js'),
        'utf-8',
      )
      const background = await readFile(
        path.join(tmp, '.rspeedy/main/background.js'),
        'utf-8',
      )

      const mtRelease = releaseOf(mainThread)
      const btRelease = releaseOf(background)

      // `minify: false` keeps the banner var name, so the release is greppable.
      // The release is `debugmetadata:` + a 160-bit sha1 over the chunk's
      // modules; the bare hash equals the source-map artifact `key`
      // reverse-resolution locates the container by.
      expect(mtRelease, 'main-thread should declare a release').toMatch(
        /^debugmetadata:[0-9a-f]+$/,
      )
      expect(btRelease, 'background should declare a release').toMatch(
        /^debugmetadata:[0-9a-f]+$/,
      )
      // The injected runtime registers the release with the Lynx engine.
      expect(mainThread).toContain('_SetSourceMapRelease')
      expect(background).toContain('_SetSourceMapRelease')
      // Per-chunk: main-thread and background carry their own (distinct) hash.
      expect(mtRelease).not.toBe(btRelease)
    },
    25_000,
  )

  test(
    'sourcemap should map from compiled code to original source code',
    async () => {
      const tmp = await buildSourcemapFixture({ css: true })

      // find all `*.map` files inside tmp
      const sourceMapFiles = await getSourceMapFiles(tmp)

      expect(sourceMapFiles).toMatchInlineSnapshot(`
      [
        ".rspeedy/main/background.js.map",
        ".rspeedy/main/main-thread.js.map",
        ".rspeedy/main/main.css.map",
        "static/js/async/lazy-bundle-comp.jsx-react__background.js.map",
        "static/js/async/lazy-bundle-comp.jsx-react__main-thread.js.map",
      ]
    `)
      expect(sourceMapFiles).toContain('.rspeedy/main/main.css.map')

      const cssSource = await readFile(
        path.join(tmp, '.rspeedy/main/main.css'),
        'utf-8',
      )
      const cssSourceMap = JSON.parse(
        await readFile(
          path.join(tmp, '.rspeedy/main/main.css.map'),
          'utf-8',
        ),
      ) as RawSourceMap
      const cssConsumer = await new SourceMapConsumer(cssSourceMap)
      const cssLine = cssSource
        .split('\n')
        .findIndex(line => line.includes('.app')) + 1
      const cssColumn = cssSource
        .split('\n')
        .at(cssLine - 1)!
        .indexOf('.app') + 1
      const cssSourcePosition = cssConsumer.originalPositionFor({
        line: cssLine,
        column: cssColumn,
      })

      expect(path.basename(cssSourcePosition.source ?? '')).toBe('index.css')

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
      const functionName2Source: Record<string, NullableMappedPosition> = {}
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
        if (functionName2Source[name].source) {
          functionName2Source[name].source = path.basename(
            functionName2Source[name].source,
          )
        }
      })
      expect(functionName2Source).toMatchInlineSnapshot(`
        {
          "function renderComponent": {
            "column": 0,
            "line": 296,
            "name": null,
            "source": "preact.mjs",
          },
          "functionThatThrows": {
            "column": 2,
            "line": 19,
            "name": "functionThatThrows",
            "source": "index.tsx",
          },
          "innerFunction": {
            "column": 2,
            "line": 14,
            "name": "innerFunction",
            "source": "index.tsx",
          },
        }
      `)
      // clean
      cssConsumer.destroy()
      consumer.destroy()
    },
    25_000,
  )
})

function normalizeSlashes(file: string) {
  return file.replaceAll(path.win32.sep, '/')
}

function releaseOf(src: string): string | undefined {
  return (/var __DEBUG_METADATA_RELEASE__ = "([^"]+)"/.exec(src))?.[1]
}
