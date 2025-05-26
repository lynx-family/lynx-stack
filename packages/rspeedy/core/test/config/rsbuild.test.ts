// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { toRsbuildConfig } from '../../src/config/rsbuild/index.js'

describe('Config - toRsBuildConfig', () => {
  describe('Dev', () => {
    test('transform empty dev', () => {
      const rsbuildConfig = toRsbuildConfig({
        dev: void 0,
      })
      expect(rsbuildConfig.dev).toMatchInlineSnapshot(`
        {
          "progressBar": true,
          "watchFiles": undefined,
          "writeToDisk": true,
        }
      `)
    })

    test('transform dev.watchFiles', () => {
      const rsbuildConfig = toRsbuildConfig({
        dev: {
          watchFiles: {
            paths: [],
          },
        },
      })
      expect(rsbuildConfig.dev?.watchFiles).toHaveProperty('paths', [])
    })

    test('transform dev.writeToDisk: false', () => {
      const rsbuildConfig = toRsbuildConfig({
        dev: {
          writeToDisk: false,
        },
      })
      expect(rsbuildConfig.dev?.writeToDisk).toBe(false)
    })

    test('transform dev.writeToDisk: function', () => {
      const rsbuildConfig = toRsbuildConfig({
        dev: {
          writeToDisk: (p) => p.includes('foo'),
        },
      })
      expect(rsbuildConfig.dev?.writeToDisk).toStrictEqual(expect.any(Function))
    })
  })

  describe('Define', () => {
    test('transform empty define', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: { define: void 0 },
      })
      expect(rsbuildConfig.source?.define).toStrictEqual(undefined)
    })

    test('transform define', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          define: {
            foo: 'foo',
            bar: JSON.stringify({ bar: 0 }),
            baz: {
              bar: 0,
              baz: JSON.stringify(1),
            },

            'typeof window': JSON.stringify('undefined'),

            foo1: 0,
            bar1: undefined,
            'typeof windows': false,
          },
        },
      })
      expect(rsbuildConfig.source?.define).toMatchInlineSnapshot(`
        {
          "bar": "{"bar":0}",
          "bar1": undefined,
          "baz": {
            "bar": 0,
            "baz": "1",
          },
          "foo": "foo",
          "foo1": 0,
          "typeof window": ""undefined"",
          "typeof windows": false,
        }
      `)
    })
  })

  describe('Entry', () => {
    test('transform empty entry', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: { entry: void 0 },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "main": "./src/index.js",
        }
      `)
    })

    test('transform single entry', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: { entry: './src/pages/main/index.js' },
      })
      expect(rsbuildConfig.source?.entry).toStrictEqual(
        {
          main: './src/pages/main/index.js',
        },
      )
    })

    test('transform singe entry with multiple entry modules', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: { entry: ['src/prefetch.js', 'src/index.js'] },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "main": [
            "src/prefetch.js",
            "src/index.js",
          ],
        }
      `)
    })

    test('transform single entry in object format', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            main: './src/index.js',
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "import": "./src/index.js",
          },
        }
      `)
    })

    test('transform multiple entries', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            foo: './src/foo.js',
            bar: './src/bar.js',
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "import": "./src/bar.js",
          },
          "foo": {
            "import": "./src/foo.js",
          },
        }
      `)
    })

    test('transform multiple entries with multiple entry modules', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            foo: ['prefetch.js', './src/foo.js'],
            bar: './src/bar.js',
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "import": "./src/bar.js",
          },
          "foo": {
            "import": [
              "prefetch.js",
              "./src/foo.js",
            ],
          },
        }
      `)
    })

    test('transform single entry in entry description format', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            main: {
              import: './src/index.js',
            },
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "import": "./src/index.js",
          },
        }
      `)
    })

    test('transform single entry in entry description format without import', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            main: {
              publicPath: 'https://example.com/',
            },
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "main": {
            "import": "./src/index.js",
            "publicPath": "https://example.com/",
          },
        }
      `)
    })

    test('transform multiple entries in entry description format', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            bar: {
              import: ['prefetch.ts', 'src/pages/bar/index.js'],
            },
            baz: {
              publicPath: 'https://example.com/baz/',
            },
            foo: {
              import: ['prefetch.ts', 'src/index.js'],
              publicPath: 'https://example.com/foo/',
            },
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "import": [
              "prefetch.ts",
              "src/pages/bar/index.js",
            ],
          },
          "baz": {
            "import": "./src/index.js",
            "publicPath": "https://example.com/baz/",
          },
          "foo": {
            "import": [
              "prefetch.ts",
              "src/index.js",
            ],
            "publicPath": "https://example.com/foo/",
          },
        }
      `)
    })

    test('transform multiple entries in different format', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          entry: {
            bar: ['prefetch.ts', 'src/pages/bar/index.js'],
            baz: 'src/index.js',
            foo: {
              import: ['prefetch.ts', 'src/index.js'],
              publicPath: 'https://example.com/foo/',
            },
          },
        },
      })
      expect(rsbuildConfig.source?.entry).toMatchInlineSnapshot(`
        {
          "bar": {
            "import": [
              "prefetch.ts",
              "src/pages/bar/index.js",
            ],
          },
          "baz": {
            "import": "src/index.js",
          },
          "foo": {
            "import": [
              "prefetch.ts",
              "src/index.js",
            ],
            "publicPath": "https://example.com/foo/",
          },
        }
      `)
    })
  })

  describe('Environments', () => {
    test('with default lynx environment', () => {
      const rsbuildConfig = toRsbuildConfig({})

      expect(rsbuildConfig.environments?.['lynx']).toStrictEqual({})
    })

    test('with web-only environment', () => {
      const rsbuildConfig = toRsbuildConfig({
        environments: {
          web: {},
        },
      })

      expect(rsbuildConfig.environments).toHaveProperty('web')
      expect(rsbuildConfig.environments).not.toHaveProperty('lynx')
    })

    test('with web and lynx environments', () => {
      const rsbuildConfig = toRsbuildConfig({
        environments: {
          web: { output: { distPath: { root: 'web' } } },
          lynx: {},
        },
      })

      expect(rsbuildConfig.environments).toHaveProperty('web')
      expect(rsbuildConfig.environments?.['web']?.output?.distPath?.root).toBe(
        'web',
      )
      expect(rsbuildConfig.environments).toHaveProperty('lynx')
    })
  })

  describe('Output', () => {
    test('transform empty output', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: void 0,
      })
      expect(rsbuildConfig.output).toMatchInlineSnapshot(`
        {
          "assetPrefix": undefined,
          "charset": "utf8",
          "cleanDistPath": undefined,
          "copy": undefined,
          "cssModules": undefined,
          "dataUriLimit": 2048,
          "distPath": undefined,
          "filenameHash": undefined,
          "inlineScripts": undefined,
          "legalComments": "none",
          "polyfill": "off",
          "sourceMap": undefined,
        }
      `)
    })

    test('transform output.assetPrefix', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: {
          assetPrefix: '/foo/bar/',
        },
      })
      expect(rsbuildConfig.output?.assetPrefix).toBe('/foo/bar/')
    })

    test('transform output.cleanDistPath', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: {
          cleanDistPath: false,
        },
      })

      expect(rsbuildConfig.output?.cleanDistPath).toBe(false)
    })

    test('transform output.dataUriLimit', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: {
          dataUriLimit: 1000,
        },
      })

      expect(rsbuildConfig.output?.dataUriLimit).toBe(1000)
    })

    test('transform output.distPath', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: {
          distPath: {
            root: 'foo',
          },
        },
      })

      expect(rsbuildConfig.output?.distPath?.root).toBe('foo')
    })

    test('transform output.inlineScripts', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: {
          inlineScripts: false,
        },
      })
      expect(rsbuildConfig.output?.inlineScripts).toMatchInlineSnapshot(
        `false`,
      )
    })

    test('transform output.legalComments', () => {
      const rsbuildConfig = toRsbuildConfig({
        output: {
          legalComments: 'inline',
        },
      })

      expect(rsbuildConfig.output?.legalComments).toBe('inline')
    })
  })

  describe('Performance', () => {
    test('transform performance.profile', () => {
      const rsbuildConfig = toRsbuildConfig({
        performance: { profile: true },
      })
      expect(rsbuildConfig.performance?.profile).toBe(true)
    })

    test('transform performance.removeConsole true', () => {
      const rsbuildConfig = toRsbuildConfig({
        performance: { removeConsole: true },
      })
      expect(rsbuildConfig.performance?.removeConsole).toStrictEqual([
        'log',
        'warn',
        'error',
        'info',
        'debug',
        'profile',
        'profileEnd',
      ])
    })

    test('transform performance.removeConsole string[]', () => {
      const rsbuildConfig = toRsbuildConfig({
        performance: { removeConsole: ['log', 'warn', 'error'] },
      })
      expect(rsbuildConfig.performance?.removeConsole).toStrictEqual([
        'log',
        'warn',
        'error',
      ])
    })

    test('transform performance.removeConsole false', () => {
      const rsbuildConfig = toRsbuildConfig({
        performance: { removeConsole: false },
      })
      expect(rsbuildConfig.performance?.removeConsole).toBe(false)
    })

    test('transform performance.printFileSize false', () => {
      const rsbuildConfig = toRsbuildConfig({
        performance: { printFileSize: false },
      })
      expect(rsbuildConfig.performance?.printFileSize).toBe(
        false,
      )
    })

    test('transform performance.printFileSize', () => {
      const printFileSizeOptions = {
        total: false,
        detail: false,
        compressed: true,
        include: (_: { name: string, size: number }) => false,
        exclude: (_: { name: string, size: number }) => false,
      }
      const rsbuildConfig = toRsbuildConfig({
        performance: {
          printFileSize: printFileSizeOptions,
        },
      })
      const printFileSize = rsbuildConfig.performance
        ?.printFileSize as typeof printFileSizeOptions
      expect(printFileSize.total).toBe(false)
      expect(printFileSize.detail).toBe(false)
      expect(printFileSize.compressed).toBe(true)
      expect(printFileSize.include?.({ name: '', size: 1 })).toEqual(false)
      expect(printFileSize.exclude?.({ name: '', size: 1 })).toEqual(false)
    })
  })

  describe('Plugins', () => {
    test('transform empty plugins', () => {
      const rsbuildConfig = toRsbuildConfig({
        plugins: void 0,
      })
      expect(rsbuildConfig.plugins).toStrictEqual(
        void 0,
      )
    })

    test('transform plugins', () => {
      const rsbuildConfig = toRsbuildConfig({
        plugins: [
          {
            name: 'test',
            setup(api) {
              api.onAfterBuild(() => void 0)
            },
          } satisfies RsbuildPlugin,
        ],
      })
      expect(rsbuildConfig.plugins).toStrictEqual(
        [expect.objectContaining({ name: 'test' })],
      )
    })
  })

  describe('Resolve', () => {
    test('transform empty resolve config', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {},
      })
      expect(rsbuildConfig.source?.alias).toStrictEqual(
        undefined,
      )
      expect(rsbuildConfig.source?.tsconfigPath).toMatchInlineSnapshot(
        `undefined`,
      )
    })

    test('transform source.tsconfigPath', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          tsconfigPath: 'tsconfig.custom.json',
        },
      })
      expect(rsbuildConfig.source?.tsconfigPath).toMatchInlineSnapshot(
        `"tsconfig.custom.json"`,
      )
    })

    test('transform empty resolve.alias', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          alias: {},
        },
      })
      expect(rsbuildConfig.source?.alias).toStrictEqual(
        {},
      )
    })

    test('transform source.alias', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          alias: {
            foo: 'bar',
          },
        },
      })
      expect(rsbuildConfig.source?.alias).toStrictEqual(
        { foo: 'bar' },
      )
      expect(rsbuildConfig.source?.alias).not.toStrictEqual({
        foo: 'baz',
      })
    })
  })

  describe('Source', () => {
    test('source.decorators', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          decorators: {
            version: 'legacy',
          },
        },
      })

      expect(rsbuildConfig.source?.decorators).toStrictEqual({
        version: 'legacy',
      })
    })

    test('source.exclude', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          exclude: ['foo/bar'],
        },
      })

      expect(rsbuildConfig.source?.exclude).toStrictEqual(['foo/bar'])
    })

    test('source.include', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          include: ['foo/bar'],
        },
      })

      expect(rsbuildConfig.source?.include).toStrictEqual(['foo/bar'])
    })

    test('source.transformImport: []', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [],
        },
      })

      expect(rsbuildConfig.source?.transformImport).toStrictEqual([])
    })

    test('source.transformImport defaults', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [{ libraryName: 'foo' }],
        },
      })

      expect(rsbuildConfig.source?.transformImport).toMatchInlineSnapshot(`
        [
          {
            "libraryName": "foo",
          },
        ]
      `)
    })

    test('source.transformImports multiple', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [
            {
              libraryName: 'foo',
              customName: 'foo/{{ member }}/{{ member }}',
            },
            {
              libraryName: 'bar',
            },
          ],
        },
      })
      expect(rsbuildConfig.source?.transformImport).toMatchInlineSnapshot(`
        [
          {
            "customName": "foo/{{ member }}/{{ member }}",
            "libraryName": "foo",
          },
          {
            "libraryName": "bar",
          },
        ]
      `)
    })

    test('source.transformImport customName', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [{
            libraryName: 'foo',
            customName: 'foo/{{ member }}/{{ member }}',
          }],
        },
      })

      expect(rsbuildConfig.source?.transformImport).toMatchInlineSnapshot(`
        [
          {
            "customName": "foo/{{ member }}/{{ member }}",
            "libraryName": "foo",
          },
        ]
      `)
    })

    test('source.transformImport libraryDirectory', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [{
            libraryName: 'foo',
            libraryDirectory: 'bar',
          }],
        },
      })

      expect(rsbuildConfig.source?.transformImport).toMatchInlineSnapshot(`
        [
          {
            "libraryDirectory": "bar",
            "libraryName": "foo",
          },
        ]
      `)
    })

    test('source.transformImport camelToDashComponentName', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [{
            libraryName: 'foo',
            camelToDashComponentName: true,
          }],
        },
      })

      expect(rsbuildConfig.source?.transformImport).toMatchInlineSnapshot(`
        [
          {
            "camelToDashComponentName": true,
            "libraryName": "foo",
          },
        ]
      `)
    })

    test('source.transformImport transformToDefaultImport', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          transformImport: [{
            libraryName: 'foo',
            transformToDefaultImport: true,
          }],
        },
      })

      expect(rsbuildConfig.source?.transformImport).toMatchInlineSnapshot(`
        [
          {
            "libraryName": "foo",
            "transformToDefaultImport": true,
          },
        ]
      `)
    })

    test('source.assetsInclude string', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          assetsInclude: 'json5',
        },
      })

      expect(rsbuildConfig.source?.assetsInclude).toMatchInlineSnapshot(
        `"json5"`,
      )
    })

    test('source.assetsInclude RegExp', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          assetsInclude: /\.json5$/,
        },
      })

      expect(rsbuildConfig.source?.assetsInclude).toMatchInlineSnapshot(
        `/\\\\\\.json5\\$/`,
      )
    })

    test('source.assetsInclude RuleSetCondition[]', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          assetsInclude: [/\.json5$/, /\.pdf$/],
        },
      })

      expect(rsbuildConfig.source?.assetsInclude).toMatchInlineSnapshot(`
        [
          /\\\\\\.json5\\$/,
          /\\\\\\.pdf\\$/,
        ]
      `)
    })

    test('source.assetsInclude Function', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          assetsInclude: (value: string) => value.endsWith('.json5'),
        },
      })

      expect(rsbuildConfig.source?.assetsInclude).toMatchInlineSnapshot(
        `[Function]`,
      )
    })

    test('source.assetsInclude RuleSetLogicalConditions', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          assetsInclude: {
            not: /\.json5$/,
          },
        },
      })

      expect(rsbuildConfig.source?.assetsInclude).toMatchInlineSnapshot(`
        {
          "not": /\\\\\\.json5\\$/,
        }
      `)
    })

    test('source.preEntry string', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          preEntry: './src/polyfill.ts',
        },
      })

      expect(rsbuildConfig.source?.preEntry).toMatchInlineSnapshot(
        `"./src/polyfill.ts"`,
      )
    })

    test('source.preEntry string[]', () => {
      const rsbuildConfig = toRsbuildConfig({
        source: {
          preEntry: ['./src/polyfill-a.ts', './src/polyfill-b.ts'],
        },
      })

      expect(rsbuildConfig.source?.preEntry).toMatchInlineSnapshot(
        `
        [
          "./src/polyfill-a.ts",
          "./src/polyfill-b.ts",
        ]
      `,
      )
    })
  })
})
