// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'
import { describe, expect, test } from 'vitest'

import { validate } from '../../src/config/validate.js'
import type {
  Config,
  Dev,
  Entry,
  Minify,
  Output,
  Performance,
  Server,
  Source,
  Tools,
} from '../../src/index.js'

describe('Config Validation', () => {
  test('unknown property', () => {
    expect(
      () => validate({ unknown: 0 }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: Invalid configuration.

      Unknown property: \`$input.unknown\` in configuration
      ]
    `)

    expect(
      () =>
        validate({
          'long-unknown-function'() {
            return void 0
          },
        }),
    ).toThrowErrorMatchingInlineSnapshot(`
      [Error: Invalid configuration.

      Unknown property: \`$input["long-unknown-function"]\` in configuration
      ]
    `)
  })

  describe('Dev', () => {
    test('valid type', () => {
      const cases: Dev[] = [
        {},
        { assetPrefix: true },
        { assetPrefix: false },
        { assetPrefix: 'example.com' },
        { watchFiles: { paths: '' } },
        { watchFiles: { paths: [] } },
        { watchFiles: { paths: ['foo', 'bar'] } },
        { watchFiles: { paths: '', options: { usePolling: true } } },
        { watchFiles: { paths: '', options: { interval: 1000 } } },
        { writeToDisk: true },
        { writeToDisk: false },
        { writeToDisk: () => false },
        { writeToDisk: (p) => p.includes('foo') },
      ]

      cases.forEach(dev => {
        expect(validate({ dev })).toStrictEqual({ dev })
      })
    })

    test('invalid type', () => {
      expect(() => validate({ dev: { assetPrefix: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.assetPrefix\`.
            - Expect to be (boolean | string | undefined)
            - Got: null
          ]
        `)
      expect(() => validate({ dev: { assetPrefix: ['example.com'] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.assetPrefix\`.
            - Expect to be (boolean | string | undefined)
            - Got: array
          ]
        `)

      expect(() => validate({ dev: { watchFiles: {} } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.watchFiles.paths\`.
            - Expect to be (Array<string> | string)
            - Got: undefined
          ]
        `)

      expect(() => validate({ dev: { watchFiles: { paths: [123] } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.watchFiles.paths[0]\`.
            - Expect to be string
            - Got: number
          ]
        `)

      expect(() => validate({ dev: { watchFiles: { paths: { foo: 'bar' } } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.watchFiles.paths\`.
            - Expect to be (Array<string> | string)
            - Got: object
          ]
        `)

      expect(() =>
        validate({
          dev: { watchFiles: { paths: 'foo', options: { unknown: 123 } } },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Unknown property: \`$input.dev.watchFiles.options.unknown\` in configuration
          ]
        `)

      expect(() =>
        validate({
          dev: { watchFiles: { paths: 'foo', options: { usePolling: 123 } } },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.watchFiles.options.usePolling\`.
            - Expect to be (boolean | undefined)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          dev: { watchFiles: { paths: 'foo', options: { internal: [123] } } },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Unknown property: \`$input.dev.watchFiles.options.internal\` in configuration
          ]
        `)

      expect(() => validate({ dev: { writeToDisk: 'foo' } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.writeToDisk\`.
            - Expect to be (boolean | undefined)
            - Got: string
          ]
        `)

      expect(() => validate({ dev: { writeToDisk: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.dev.writeToDisk\`.
            - Expect to be (boolean | undefined)
            - Got: null
          ]
        `)
    })
  })

  describe('Define', () => {
    test('valid type', () => {
      const cases: Source['define'][] = [
        void 0,
        {},
        {
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
      ]

      cases.forEach(define => {
        expect(validate({ source: { define } })).toStrictEqual({
          source: { define },
        })
      })
    })

    test('invalid type', () => {
      expect(
        () => validate({ source: { define: 0 } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.define\`.
          - Expect to be (Record<string, string | number | boolean | Record<string, unknown> | undefined> | undefined)
          - Got: number
        ]
      `)

      expect(
        () => validate({ source: { define: [] } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.define\`.
          - Expect to be (Record<string, string | number | boolean | Record<string, unknown> | undefined> | undefined)
          - Got: array
        ]
      `)

      expect(
        () => validate({ source: { define: ['foo'] } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.define\`.
          - Expect to be (Record<string, string | number | boolean | Record<string, unknown> | undefined> | undefined)
          - Got: array
        ]
      `)

      expect(
        () => validate({ source: { define: { foo: null } } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.define.foo\`.
          - Expect to be (Record<string, unknown> | boolean | number | string | undefined)
          - Got: null
        ]
      `)

      expect(
        () =>
          validate({
            source: {
              define: {
                bar: function() {
                  return void 0
                },
              },
            },
          }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.define.bar\`.
          - Expect to be (Record<string, unknown> | boolean | number | string | undefined)
          - Got: function
        ]
      `)
    })
  })

  describe('Entry', () => {
    test('valid type', () => {
      const cases: Entry[] = [
        'src/index',
        ['prefetch', 'index'],
        {
          main: 'src/index',
          foo: ['prefetch', 'index'],
          bar: {
            import: ['src'],
          },
          baz: {
            publicPath: 'https://example.com/',
          },
        },
      ]

      cases.forEach(entry => {
        expect(validate({ source: { entry } })).toStrictEqual({
          source: { entry },
        })
      })
    })

    test('invalid type', () => {
      expect(
        () => validate({ source: { entry: 0 } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.entry\`.
          - Expect to be (Array<string> | Record<string, string | string[] | EntryDescription> | string | undefined)
          - Got: number
        ]
      `)

      expect(
        () => validate({ source: { entry: { foo: 0 } } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.entry.foo\`.
          - Expect to be (Array<string> | EntryDescription.o2 | string)
          - Got: number
        ]
      `)

      expect(
        () => validate({ source: { entry: { foo: [undefined] } } }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.entry.foo[0]\`.
          - Expect to be string
          - Got: undefined
        ]
      `)

      expect(
        () =>
          validate({
            source: {
              entry: {
                foo: {
                  unknown: null,
                },
              },
            },
          }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.source.entry.foo.unknown\` in configuration
        ]
      `)

      expect(
        () =>
          validate({
            source: {
              entry: {
                foo: {
                  import: [0, null],
                },
              },
            },
          }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.entry.foo["import"][0]\`.
          - Expect to be string
          - Got: number

        Invalid config on \`$input.source.entry.foo["import"][1]\`.
          - Expect to be string
          - Got: null
        ]
      `)

      expect(
        () =>
          validate({
            source: {
              entry: {
                main: 'valid',
                // @ts-expect-error testing duplicated props
                main: 0,
              },
            },
          }),
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.entry.main\`.
          - Expect to be (Array<string> | EntryDescription.o2 | string)
          - Got: number
        ]
      `)
    })
  })

  describe('Environment', () => {
    test('valid type', () => {
      const cases: Config['environments'][] = [
        {},
        { lynx: {} },
        { lynx: {}, web: {} },
        {
          lynx: {
            output: { distPath: { root: 'root' } },
          },
          web: {},
        },
      ]

      cases.forEach(environments => {
        expect(validate({ environments })).toStrictEqual({
          environments,
        })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          environments: {
            lynx: {
              dev: {
                foo: 'bar',
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.environments.lynx.dev.foo\` in configuration
        ]
      `)

      expect(() =>
        validate({
          environments: {
            lynx: {
              server: {
                port: '3000',
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.environments.lynx.server\` in configuration
        ]
      `)
    })
  })

  describe('Minify', () => {
    test('valid type', () => {
      const cases: Minify[] = [
        {},
        {
          jsOptions: {
            minimizerOptions: {
              compress: true,
              mangle: false,
            },
          },
        },
        {
          jsOptions: {
            minimizerOptions: {
              compress: {
                keep_fnames: true,
              },
              mangle: {
                props: {},
                reserved: ['lynx'],
              },
              format: {
                max_line_len: 1,
              },
            },
            extractComments: {
              banner: 'x',
              condition: /@preserve/i,
            },
          },
        },
        {
          css: false,
        },
        {
          css: true,
        },
      ]

      cases.forEach(minify => {
        expect(validate({ output: { minify } })).toStrictEqual({
          output: { minify },
        })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          output: {
            minify: {
              jsOptions: {
                minimizerOptions: {
                  compress: null,
                },
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.minify.jsOptions.minimizerOptions.compress\`.
          - Expect to be (TerserCompressOptions.o1 | boolean | undefined)
          - Got: null
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              jsOptions: {
                minimizerOptions: {
                  compress: {
                    // Should be `keep_fnames`
                    keep_fname: true,
                  },
                },
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.output.minify.jsOptions.minimizerOptions.compress.keep_fname\` in configuration
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              jsOptions: {
                minimizerOptions: {
                  compress: {
                    // Should be `keep_fnames`
                    keepFnames: true,
                  },
                },
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.output.minify.jsOptions.minimizerOptions.compress.keepFnames\` in configuration
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              jsOptions: {
                minimizerOptions: {
                  mangle: {
                    reserved: [0, null],
                  },
                },
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.minify.jsOptions.minimizerOptions.mangle.reserved[0]\`.
          - Expect to be string
          - Got: number

        Invalid config on \`$input.output.minify.jsOptions.minimizerOptions.mangle.reserved[1]\`.
          - Expect to be string
          - Got: null
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              compress: null,
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.output.minify.compress\` in configuration
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              compress: {
                // Should be `keep_fnames`
                keep_fname: true,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.output.minify.compress\` in configuration
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              compress: {
                // Should be `keep_fnames`
                keep_fname: true,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.output.minify.compress\` in configuration
        ]
      `)

      expect(() =>
        validate({
          minify: {
            mangle: {
              reserved: [0, null],
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.minify\` in configuration
        ]
      `)

      expect(() =>
        validate({
          output: {
            minify: {
              css: {},
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.minify.css\`.
          - Expect to be (boolean | undefined)
          - Got: object
        ]
      `)
    })
  })

  describe('Mode', () => {
    test('valid type', () => {
      const cases: Config[] = [
        {},
        { mode: undefined },
        { mode: 'development' },
        { mode: 'production' },
        { mode: 'none' },
      ]

      cases.forEach(config => {
        expect(validate(config)).toStrictEqual(config)
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          mode: 'foo',
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.mode\`.
          - Expect to be ("development" | "none" | "production" | undefined)
          - Got: string
        ]
      `)

      expect(() =>
        validate({
          mode: null,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.mode\`.
          - Expect to be ("development" | "none" | "production" | undefined)
          - Got: null
        ]
      `)

      expect(() =>
        validate({
          mode: 42,
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.mode\`.
          - Expect to be ("development" | "none" | "production" | undefined)
          - Got: number
        ]
      `)
    })
  })

  describe('Output', () => {
    test('valid type', () => {
      const cases: Output[] = [
        {},
        { assetPrefix: 'foo.com' },
        { copy: [] },
        {
          copy: [
            'assets',
            { from: 'foo' },
            { from: 'foo', to: 'bar' },
            {
              from: 'baz',
              to(pathData) {
                return pathData.context
              },
            },
            { from: 'foo', force: true },
            { from: 'foo', globOptions: { ignore: ['baz'] } },
          ],
        },
        { filename: 'foo.js' },
        { filenameHash: 'fullhash' },
        { filenameHash: 'chunkhash' },
        { filenameHash: 'fullhash:8' },
        { filenameHash: 'chunkhash:8' },
        { filenameHash: false },
        { filenameHash: true },
        { dataUriLimit: 0 },
        { dataUriLimit: Number.NaN },
        { dataUriLimit: Number.POSITIVE_INFINITY },
        { dataUriLimit: Number.MAX_SAFE_INTEGER },
        { cssModules: { auto: true } },
        { cssModules: { auto: false } },
        { cssModules: { auto: /module/ } },
        {
          cssModules: {
            auto(filename) {
              return !filename.includes('node_modules')
            },
          },
        },
        {
          cssModules: {
            exportGlobals: false,
          },
        },
        {
          cssModules: {
            exportGlobals: true,
          },
        },
        {
          cssModules: {
            exportLocalsConvention: 'asIs',
          },
        },
        {
          cssModules: {
            exportLocalsConvention: 'dashesOnly',
          },
        },
        {
          cssModules: {
            localIdentName: '[hash:7]',
          },
        },
        { cleanDistPath: true },
        { cleanDistPath: false },
        { distPath: {} },
        { distPath: { root: 'root' } },
        { legalComments: 'inline' },
        { legalComments: 'none' },
        { legalComments: 'linked' },
      ]

      cases.forEach(output => {
        expect(validate({ output })).toStrictEqual({ output })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          output: {
            filename: null,
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.filename\`.
          - Expect to be (Filename | string | undefined)
          - Got: null
        ]
      `)

      expect(() =>
        validate({
          output: {
            filename: 0,
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.filename\`.
          - Expect to be (Filename | string | undefined)
          - Got: number
        ]
      `)

      expect(() =>
        validate({
          output: {
            filenameHash: 0,
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.filenameHash\`.
          - Expect to be (boolean | string | undefined)
          - Got: number
        ]
      `)

      expect(() =>
        validate({
          output: {
            filenameHash: null,
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.filenameHash\`.
          - Expect to be (boolean | string | undefined)
          - Got: null
        ]
      `)

      expect(() => validate({ output: { assetPrefix: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.assetPrefix\`.
            - Expect to be (string | undefined)
            - Got: null
          ]
        `)
      expect(() => validate({ output: { assetPrefix: 0 } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.assetPrefix\`.
            - Expect to be (string | undefined)
            - Got: number
          ]
        `)
      expect(() => validate({ output: { assetPrefix: ['foo'] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.assetPrefix\`.
            - Expect to be (string | undefined)
            - Got: array
          ]
        `)

      expect(() => validate({ output: { copy: [{}] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.copy[0].from\`.
            - Expect to be string
            - Got: undefined

          Invalid config on \`$input.output.copy.patterns\`.
            - Expect to be Array<string | ({ from: string; } & Partial<RawCopyPattern>)>
            - Got: undefined
          ]
        `)

      expect(() => validate({ output: { copy: [{ from: null }] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.copy[0].from\`.
            - Expect to be string
            - Got: null

          Invalid config on \`$input.output.copy.patterns\`.
            - Expect to be Array<string | ({ from: string; } & Partial<RawCopyPattern>)>
            - Got: undefined
          ]
        `)

      expect(() => validate({ output: { copy: [{ from: undefined }] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.copy[0].from\`.
            - Expect to be string
            - Got: undefined

          Invalid config on \`$input.output.copy.patterns\`.
            - Expect to be Array<string | ({ from: string; } & Partial<RawCopyPattern>)>
            - Got: undefined
          ]
        `)

      expect(() => validate({ output: { copy: [{ src: '' }] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.copy[0].from\`.
            - Expect to be string
            - Got: undefined

          Invalid config on \`$input.output.copy.patterns\`.
            - Expect to be Array<string | ({ from: string; } & Partial<RawCopyPattern>)>
            - Got: undefined
          ]
        `)

      expect(() =>
        validate({ output: { copy: [{ from: 'foo', dist: 'bar' }] } })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Unknown property: \`$input.output.copy[0].dist\` in configuration

          Invalid config on \`$input.output.copy.patterns\`.
            - Expect to be Array<string | ({ from: string; } & Partial<RawCopyPattern>)>
            - Got: undefined
          ]
        `)

      expect(() => validate({ output: { copy: [{ from: '', to: null }] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.copy[0].to\`.
            - Expect to be (string | undefined)
            - Got: null

          Invalid config on \`$input.output.copy.patterns\`.
            - Expect to be Array<string | ({ from: string; } & Partial<RawCopyPattern>)>
            - Got: undefined
          ]
        `)

      expect(() => validate({ output: { dataUriLimit: 'foo' } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.dataUriLimit\`.
            - Expect to be (number | undefined)
            - Got: string
          ]
        `)

      expect(() => validate({ output: { cssModules: { auto: null } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.cssModules.auto\`.
            - Expect to be (RegExp | boolean | undefined)
            - Got: null
          ]
        `)

      expect(() => validate({ output: { cssModules: { auto: 'null' } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.cssModules.auto\`.
            - Expect to be (RegExp | boolean | undefined)
            - Got: string
          ]
        `)

      expect(() =>
        validate({ output: { cssModules: { exportLocalsConvention: 'foo' } } })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.output.cssModules.exportLocalsConvention\`.
          - Expect to be ("asIs" | "camelCase" | "camelCaseOnly" | "dashes" | "dashesOnly" | undefined)
          - Got: string
        ]
      `)

      expect(() => validate({ output: { cssModules: { localIdentName: 0 } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.cssModules.localIdentName\`.
            - Expect to be (string | undefined)
            - Got: number
          ]
        `)

      expect(() => validate({ output: { cleanDistPath: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.cleanDistPath\`.
            - Expect to be (boolean | undefined)
            - Got: null
          ]
        `)

      expect(() => validate({ output: { distPath: { root: 100 } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.distPath.root\`.
            - Expect to be (string | undefined)
            - Got: number
          ]
        `)

      expect(() => validate({ output: { legalComments: [null] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.legalComments\`.
            - Expect to be ("inline" | "linked" | "none" | undefined)
            - Got: array
          ]
        `)

      expect(() => validate({ output: { legalComments: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.legalComments\`.
            - Expect to be ("inline" | "linked" | "none" | undefined)
            - Got: null
          ]
        `)

      expect(() => validate({ output: { legalComments: 'foo' } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.output.legalComments\`.
            - Expect to be ("inline" | "linked" | "none" | undefined)
            - Got: string
          ]
        `)
    })
  })

  describe('Performance', () => {
    test('valid type', () => {
      const cases: Performance[] = [
        {},
        {
          chunkSplit: undefined,
        },
        {
          chunkSplit: {},
        },
        {
          chunkSplit: {
            override: {},
          },
        },
        {
          chunkSplit: {
            strategy: 'all-in-one',
          },
        },
        {
          chunkSplit: {
            strategy: 'all-in-one',
            override: {
              cacheGroups: {
                foo: {
                  minChunks: 3,
                },
              },
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'all-in-one',
            override: {
              maxInitialSize: 100,
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'single-vendor',
          },
        },
        {
          chunkSplit: {
            strategy: 'single-vendor',
            override: {
              cacheGroups: {
                foo: {
                  minChunks: 3,
                },
              },
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'single-vendor',
            override: {
              maxInitialSize: 100,
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-experience',
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-experience',
            override: {
              cacheGroups: {
                foo: {
                  minChunks: 3,
                },
              },
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-experience',
            override: {
              maxInitialSize: 100,
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-size',
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-size',
            override: {
              cacheGroups: {
                foo: {
                  minChunks: 3,
                },
              },
            },
            minSize: 100,
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-size',
            maxSize: 100,
          },
        },
        {
          chunkSplit: {
            strategy: 'split-by-size',
            override: {
              maxInitialSize: 100,
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'custom',
          },
        },
        {
          chunkSplit: {
            strategy: 'custom',
            splitChunks: {
              cacheGroups: {
                foo: {
                  minChunks: 3,
                },
              },
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'custom',
            splitChunks: {
              chunks: 'initial',
            },
          },
        },
        {
          chunkSplit: {
            strategy: 'custom',
            splitChunks: {
              maxInitialSize: 100,
            },
          },
        },
        {
          removeConsole: true,
        },
        {
          removeConsole: ['log', 'warn', 'error'],
        },
        {
          removeConsole: false,
        },
        {
          removeConsole: ['log', 'foo', 'bar'],
        },
      ]

      cases.forEach(performance => {
        expect(validate({ performance })).toStrictEqual({ performance })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              strategy: 'unknown',
              override: {
                maxInitialSize: 100,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.performance.chunkSplit.strategy\`.
          - Expect to be ("all-in-one" | "single-vendor" | "split-by-experience" | "split-by-module" | undefined)
          - Got: string
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              override: {
                maxInitialSizes: 100,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.performance.chunkSplit.override.maxInitialSizes\` in configuration
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              strategy: 'split-by-size',
              maxSize: '100',
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.performance.chunkSplit.maxSize\`.
          - Expect to be (number | undefined)
          - Got: string
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              strategy: 'all-in-one',
              maxSize: 100,
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.performance.chunkSplit.maxSize\` in configuration
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              strategy: 'all-in-one',
              splitChunks: {
                maxInitialSize: 100,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.performance.chunkSplit.splitChunks\` in configuration
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              maxSize: 100,
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.performance.chunkSplit.maxSize\` in configuration
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              strategy: 'custom',
              override: {
                maxInitialSize: 100,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.performance.chunkSplit.override\` in configuration
        ]
      `)

      expect(() =>
        validate({
          performance: {
            chunkSplit: {
              strategy: 'custom',
              override: {
                maxInitialSize: 100,
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.performance.chunkSplit.override\` in configuration
        ]
      `)

      expect(() =>
        validate({
          performance: {
            removeConsole: 'log',
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.performance.removeConsole\`.
          - Expect to be (Array<ConsoleType>.o1 | boolean | undefined)
          - Got: string
        ]
      `)
    })
  })

  describe('Resolve', () => {
    test('valid type', () => {
      const cases: Source[] = [
        {},
        { alias: {} },
        { alias: { foo: 'bar', bar$: 'baz', baz: false } },
        { alias: { foo: 'bar', bar$: ['baz'] } },
        { tsconfigPath: '' },
        { tsconfigPath: void 0 },
        { tsconfigPath: 'foo.json' },
      ]

      cases.forEach(source => {
        expect(validate({ source })).toStrictEqual({ source })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          source: {
            alias: {
              foo: 0,
              bar: null,
              baz: function() {
                return ''
              },
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.alias.foo\`.
          - Expect to be (Array<string> | false | string)
          - Got: number

        Invalid config on \`$input.source.alias.bar\`.
          - Expect to be (Array<string> | false | string)
          - Got: null

        Invalid config on \`$input.source.alias.baz\`.
          - Expect to be (Array<string> | false | string)
          - Got: function
        ]
      `)

      expect(() =>
        validate({
          resolve: {
            aliasFields: 'foo',
            conditionNames: 'lynx',
            extensions: '',
            extensionAlias: '',
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.resolve\` in configuration
        ]
      `)

      expect(() =>
        validate({
          source: {
            tsconfigPath: null,
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.tsconfigPath\`.
          - Expect to be (string | undefined)
          - Got: null
        ]
      `)

      expect(() =>
        validate({
          source: {
            tsconfigPath: function() {
              return ''
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.tsconfigPath\`.
          - Expect to be (string | undefined)
          - Got: function
        ]
      `)

      expect(() =>
        validate({
          source: {
            tsconfigPath: {},
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.tsconfigPath\`.
          - Expect to be (string | undefined)
          - Got: object
        ]
      `)

      expect(() =>
        validate({
          source: {
            tsconfigPath: [],
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.source.tsconfigPath\`.
          - Expect to be (string | undefined)
          - Got: array
        ]
      `)
    })
  })

  describe('Server', () => {
    test('valid type', () => {
      const cases: Server[] = [
        {},
        { base: '/foo' },
        { base: '/bar' },
        { headers: {} },
        { headers: { foo: 'bar' } },
        { headers: { foo: [] } },
        { headers: { foo: ['bar'] } },
        { host: '0.0.0.0' },
        { port: 8000 },
        { host: 'example.com', port: 3000 },
      ]

      cases.forEach(server => {
        expect(validate({ server })).toStrictEqual({ server })
      })
    })

    test('invalid type', () => {
      expect(() => validate({ server: { base: 123 } }))
        .toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.server.base\`.
          - Expect to be (string | undefined)
          - Got: number
        ]
      `)

      expect(() => validate({ server: { base: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.server.base\`.
          - Expect to be (string | undefined)
          - Got: null
        ]
      `)

      expect(() => validate({ server: { headers: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.headers\`.
            - Expect to be (Record<string, string | string[]> | undefined)
            - Got: null
          ]
        `)

      expect(() => validate({ server: { headers: 123 } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.headers\`.
            - Expect to be (Record<string, string | string[]> | undefined)
            - Got: number
          ]
        `)

      expect(() => validate({ server: { headers: { foo: [123] } } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.headers.foo[0]\`.
            - Expect to be string
            - Got: number
          ]
        `)

      expect(() => validate({ server: { host: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.host\`.
            - Expect to be (string | undefined)
            - Got: null
          ]
        `)
      expect(() => validate({ server: { host: () => 'foo.example.com' } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.host\`.
            - Expect to be (string | undefined)
            - Got: function
          ]
        `)
      expect(() => validate({ server: { host: ['example.com', '0.0.0.0'] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.host\`.
            - Expect to be (string | undefined)
            - Got: array
          ]
        `)
      expect(() => validate({ server: { port: null } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.port\`.
            - Expect to be (number | undefined)
            - Got: null
          ]
        `)
      expect(() => validate({ server: { port: () => 3000 } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.server.port\`.
            - Expect to be (number | undefined)
            - Got: function
          ]
        `)
    })
  })

  describe('Source', () => {
    test('valid type', () => {
      const cases: Source[] = [
        {},
        { decorators: {} },
        { decorators: { version: '2022-03' } },
        { decorators: { version: 'legacy' } },
        {
          exclude: [
            'foo',
            'foo/bar',
          ],
        },
        {
          exclude: [
            /foo/,
            /foo\/bar/,
          ],
        },
        {
          exclude: [
            /foo/,
            'foo',
            'foo/bar',
            /foo\/bar/,
          ],
        },
        {
          exclude: [
            { and: ['foo', /bar/], or: [{ not: [{ and: ['baz'] }] }] },
            { or: [/react/] },
            { not: /core-js/ },
          ],
        },
        {
          include: [
            'foo',
            'foo/bar',
          ],
        },
        {
          include: [
            /foo/,
            /foo\/bar/,
          ],
        },
        {
          include: [
            /foo/,
            'foo',
            'foo/bar',
            /foo\/bar/,
          ],
        },
        {
          include: [
            { and: ['foo', /bar/], or: [{ not: [{ and: ['baz'] }] }] },
            { or: [/react/] },
            { not: /core-js/ },
          ],
        },
        { transformImport: [] },
        {
          transformImport: [
            {
              libraryName: 'foo',
            },
            {
              libraryName: 'bar',
              customName: 'bar/{{ camelCase member }}',
            },
          ],
        },
        {
          transformImport: [
            {
              libraryName: 'foo',
              camelToDashComponentName: false,
            },
            {
              libraryName: 'baz',
              transformToDefaultImport: true,
            },
          ],
        },
        {
          assetsInclude: 'json5',
        },
        {
          assetsInclude: /\.json5$/,
        },
        {
          assetsInclude: [/\.json5$/, /\.pdf$/],
        },
        {
          assetsInclude: (value: string) => value.endsWith('.json5'),
        },
        {
          assetsInclude: {
            not: /\.json5$/,
          },
        },
      ]

      cases.forEach(source => {
        expect(validate({ source })).toStrictEqual({ source })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          source: {
            decorators: true,
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.decorators\`.
            - Expect to be (Decorators.o1 | undefined)
            - Got: boolean
          ]
        `)

      expect(() =>
        validate({
          source: {
            decorators: {
              foo: 'unknown',
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Unknown property: \`$input.source.decorators.foo\` in configuration
          ]
        `)

      expect(() =>
        validate({
          source: {
            decorators: {
              version: 1,
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.decorators.version\`.
            - Expect to be ("2022-03" | "legacy" | undefined)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          source: {
            decorators: {
              version: 'unknown-version',
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.decorators.version\`.
            - Expect to be ("2022-03" | "legacy" | undefined)
            - Got: string
          ]
        `)

      expect(() =>
        validate({
          source: {
            exclude: {},
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.exclude\`.
            - Expect to be (Array<RuleSetCondition>.o3 | undefined)
            - Got: object
          ]
        `)

      expect(() =>
        validate({
          source: {
            exclude: [
              { baz: {} },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Unknown property: \`$input.source.exclude[0].baz\` in configuration
          ]
        `)

      expect(() =>
        validate({
          source: {
            exclude: [
              { and: [{ or: [0] }] },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.exclude[0].and[0].or[0]\`.
            - Expect to be (RegExp | RuleSetConditions | RuleSetLogicalConditions | string)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          source: {
            exclude: [
              { and: {} },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.exclude[0].and\`.
            - Expect to be (RuleSetConditions | undefined)
            - Got: object
          ]
        `)

      expect(() =>
        validate({
          source: {
            include: {},
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.include\`.
            - Expect to be (Array<RuleSetCondition>.o3 | undefined)
            - Got: object
          ]
        `)

      expect(() =>
        validate({
          source: {
            include: [
              { baz: {} },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Unknown property: \`$input.source.include[0].baz\` in configuration
          ]
        `)

      expect(() =>
        validate({
          source: {
            include: [
              { and: [{ or: [0] }] },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.include[0].and[0].or[0]\`.
            - Expect to be (RegExp | RuleSetConditions | RuleSetLogicalConditions | string)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          source: {
            include: [
              { and: {} },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.include[0].and\`.
            - Expect to be (RuleSetConditions | undefined)
            - Got: object
          ]
        `)

      expect(() => validate({ source: { transformImport: true } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.transformImport\`.
            - Expect to be (Array<TransformImport> | undefined)
            - Got: boolean
          ]
        `)

      expect(() => validate({ source: { transformImport: {} } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.transformImport\`.
            - Expect to be (Array<TransformImport> | undefined)
            - Got: object
          ]
        `)

      expect(() => validate({ source: { transformImport: [{}] } }))
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.transformImport[0].libraryName\`.
            - Expect to be string
            - Got: undefined
          ]
        `)

      expect(() =>
        validate({
          source: {
            transformImport: [
              {
                libraryName: 'foo',
              },
              {},
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.transformImport[1].libraryName\`.
            - Expect to be string
            - Got: undefined
          ]
        `)

      expect(() =>
        validate({
          source: {
            transformImport: [
              {
                libraryName: 'foo',
                customName: null,
              },
              {
                transformToDefaultImport: 'default',
              },
            ],
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.transformImport[0].customName\`.
            - Expect to be (string | undefined)
            - Got: null

          Invalid config on \`$input.source.transformImport[1].libraryName\`.
            - Expect to be string
            - Got: undefined

          Invalid config on \`$input.source.transformImport[1].transformToDefaultImport\`.
            - Expect to be (boolean | undefined)
            - Got: string
          ]
        `)

      expect(() =>
        validate({
          source: {
            assetsInclude: null,
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.source.assetsInclude\`.
            - Expect to be (RegExp | RuleSetConditions | RuleSetLogicalConditions | string | undefined)
            - Got: null
          ]
        `)
    })
  })

  describe('Tools', () => {
    test('valid type', () => {
      const cases: Tools[] = [
        {},
        {
          bundlerChain() {
            return
          },
        },
        {
          bundlerChain() {
            // @ts-expect-error testing error
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            foo()
            return
          },
        },
        { bundlerChain: [] },
        { bundlerChain: [() => undefined] },
        { cssExtract: {} },

        {
          cssExtract: {
            loaderOptions: {
              esModule: true,
            },
          },
        },

        {
          cssExtract: {
            loaderOptions: {
              esModule: false,
            },
          },
        },

        {
          cssExtract: {
            pluginOptions: {
              ignoreOrder: true,
            },
          },
        },

        {
          cssExtract: {
            pluginOptions: {
              ignoreOrder: false,
            },
          },
        },

        {
          cssExtract: {
            pluginOptions: {
              pathinfo: true,
            },
          },
        },

        { cssLoader: {} },

        {
          cssLoader: {
            importLoaders: 0,
          },
        },

        {
          cssLoader: {
            importLoaders: 1,
          },
        },
        {
          cssLoader: {
            importLoaders: 2,
          },
        },

        {
          cssLoader: {
            modules: false,
          },
        },

        {
          cssLoader: {
            modules: true,
          },
        },

        {
          cssLoader: {
            modules: {
              auto: true,
            },
          },
        },

        {
          cssLoader: {
            modules: {
              auto: () => true,
            },
          },
        },

        {
          cssLoader: {
            modules: {
              namedExport: true,
            },
          },
        },
        {
          cssLoader: {
            modules: {
              namedExport: false,
            },
          },
        },

        {
          cssLoader: {
            modules: {
              exportLocalsConvention: 'camelCase',
            },
          },
        },

        {
          cssLoader: {
            modules: {
              exportLocalsConvention: 'dashesOnly',
            },
          },
        },

        // tools.rspack
        // Objects
        { rspack: {} },
        { rspack: { entry: '123' } },
        { rspack: { devtool: false } },
        {
          rspack: {
            plugins: [
              new class TestPlugin {
                apply(compiler: Rspack.Compiler): void {
                  new compiler.webpack.DefinePlugin({
                    foo: 'bar',
                  }).apply(compiler)
                }
              }(),
            ],
          },
        },
        {
          rspack: {
            plugins: [
              class TestPlugin {
                apply() {
                  return
                }
              },
            ],
          },
        },
        {
          rspack: {
            plugins: [
              (compiler: Rspack.Compiler) =>
                new compiler.webpack.BannerPlugin({
                  banner: 'foo',
                }).apply(compiler),
            ],
          },
        },
        // Functions
        {
          rspack(config) {
            return config
          },
        },
        {
          rspack(config, { addRules }) {
            addRules({ loader: 'foo' })
            return config
          },
        },
        {
          rspack(config, { rspack, appendPlugins }) {
            appendPlugins(new rspack.BannerPlugin({ banner: 'hello' }))
            return config
          },
        },
        // Arrays
        {
          rspack: [
            (config, { addRules }) => {
              addRules({ loader: 'foo' })
              return config
            },
            {
              devtool: false,
            },
          ],
        },

        // tools.swc
        // Objects
        { swc: {} },
        {
          swc: {
            jsc: {
              experimental: {
                plugins: [
                  ['remove-console', {}],
                ],
              },
            },
          },
        },
        {
          swc: {
            jsc: {
              target: 'es2021',
            },
          },
        },
        {
          swc: {
            minify: true,
          },
        },
        {
          swc: {
            test: 'foo',
          },
        },
        // Functions
        {
          swc(config) {
            delete config.env
            return config
          },
        },
        // Array
        {
          swc: [],
        },
        {
          swc: [
            { module: { type: 'es6', strict: true } },
          ],
        },
      ]

      cases.forEach(tools => {
        expect(validate({ tools })).toStrictEqual({ tools })
      })
    })

    test('invalid type', () => {
      expect(() =>
        validate({
          tools: {
            bundlerChain: {
              resolve: {},
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.tools.bundlerChain\`.
            - Expect to be (Array<__type> | undefined)
            - Got: object
          ]
        `)

      expect(() =>
        validate({
          tools: {
            bundlerChain: 1,
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.tools.bundlerChain\`.
            - Expect to be (Array<__type> | undefined)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          tools: {
            cssLoader: {
              importLoaders: 3,
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.tools.cssLoader.importLoaders\`.
            - Expect to be (0 | 1 | 2 | undefined)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          tools: {
            cssLoader: {
              importLoaders: Number.NaN,
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.tools.cssLoader.importLoaders\`.
            - Expect to be (0 | 1 | 2 | undefined)
            - Got: number
          ]
        `)

      expect(() =>
        validate({
          tools: {
            cssLoader: {
              importLoaders: null,
            },
          },
        })
      )
        .toThrowErrorMatchingInlineSnapshot(`
          [Error: Invalid configuration.

          Invalid config on \`$input.tools.cssLoader.importLoaders\`.
            - Expect to be (0 | 1 | 2 | undefined)
            - Got: null
          ]
        `)

      expect(() =>
        validate({
          tools: {
            cssExtract: {
              filename: 'foo',
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.tools.cssExtract.filename\` in configuration
        ]
      `)

      expect(() =>
        validate({
          tools: {
            rspack: {
              unknown: '',
            },
          },
        })
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Unknown property: \`$input.tools.rspack.unknown\` in configuration
        ]
      `)

      expect(() =>
        validate({
          tools: {
            rspack: {
              devtool: 'invalid devtool',
            },
          },
        })
        // cSpell:disable
      ).toThrowErrorMatchingInlineSnapshot(`
        [Error: Invalid configuration.

        Invalid config on \`$input.tools.rspack.devtool\`.
          - Expect to be ("cheap-module-source-map" | "cheap-source-map" | "eval" | "eval-cheap-module-source-map" | "eval-cheap-source-map" | "eval-nosources-cheap-module-source-map" | "eval-nosources-cheap-source-map" | "eval-nosources-source-map" | "eval-source-map" | "hidden-cheap-module-source-map" | "hidden-cheap-source-map" | "hidden-nosources-cheap-module-source-map" | "hidden-nosources-cheap-source-map" | "hidden-nosources-source-map" | "hidden-source-map" | "inline-cheap-module-source-map" | "inline-cheap-source-map" | "inline-nosources-cheap-module-source-map" | "inline-nosources-cheap-source-map" | "inline-nosources-source-map" | "inline-source-map" | "nosources-cheap-module-source-map" | "nosources-cheap-source-map" | "nosources-source-map" | "source-map" | false | undefined)
          - Got: string
        ]
      `)
      // cSpell:enable
    })
  })
})
