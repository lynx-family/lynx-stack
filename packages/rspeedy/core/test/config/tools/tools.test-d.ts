// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'
import { assertType, describe, expectTypeOf, test } from 'vitest'

import type { Tools } from '../../../src/index.js'

describe('Config - Tools', () => {
  test('tools.bundlerChain', () => {
    // Chain
    assertType<Tools>({
      bundlerChain(chain) {
        expectTypeOf(chain)
          .toHaveProperty('devtool')
          .toBeCallableWith('cheap-source-map')

        expectTypeOf(chain.resolve)
          .toHaveProperty('alias')
          .toHaveProperty('set')
          .toBeCallableWith('foo', 'bar')

        expectTypeOf(chain.module)
          .toHaveProperty('rule')
          .toBeCallableWith('js')

        expectTypeOf(chain.module.rule('foo'))
          .toHaveProperty('test')
          .toBeCallableWith(/foo/)

        expectTypeOf(chain.module.rule('foo'))
          .toHaveProperty('use')
          .toBeCallableWith('bar')

        expectTypeOf(chain.module.rule('foo').use('bar'))
          .toHaveProperty('loader')
          .toBeCallableWith('css-loader')

        expectTypeOf(chain.module.rule('foo').use('bar'))
          .toHaveProperty('options')
          .toBeCallableWith({})
      },
    })

    // Utils
    assertType<Tools>({
      bundlerChain(_, utils) {
        expectTypeOf(utils)
          .toHaveProperty('CHAIN_ID')
          .toHaveProperty('RULE')
          .toHaveProperty('JS')

        expectTypeOf(utils)
          .toHaveProperty('isDev')
          .toBeBoolean()

        expectTypeOf(utils)
          .toHaveProperty('target')
          .toBeString()
      },
    })
  })
  test('tools.cssExtract', () => {
    assertType<Tools>({
      cssExtract: {},
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {},
        pluginOptions: {},
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {
          esModule: true,
        },
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {
          esModule: false,
        },
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {},
        pluginOptions: {
          ignoreOrder: false,
        },
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {},
        pluginOptions: {
          ignoreOrder: true,
        },
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {},
        pluginOptions: {
          pathinfo: true,
        },
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {},
        pluginOptions: {
          pathinfo: false,
        },
      },
    })

    assertType<Tools>({
      cssExtract: {
        loaderOptions: {
          // @ts-expect-error we do not provide all native options
          filename: 'foo',
        },
        pluginOptions: {
          pathinfo: false,
        },
      },
    })
  })

  test('tools.cssLoader', () => {
    assertType<Tools>({})
    assertType<Tools>({
      cssLoader: {},
    })
    assertType<Tools>({
      cssLoader: {
        importLoaders: 0,
      },
    })
    assertType<Tools>({
      cssLoader: {
        importLoaders: 1,
      },
    })

    assertType<Tools>({
      cssLoader: {
        importLoaders: 2,
      },
    })
  })

  test('tools.rsdoctor', () => {
    assertType<Tools>({
      rsdoctor: {},
    })

    assertType<Tools>({
      rsdoctor: {
        experiments: {
          enableNativePlugin: true,
        },
      },
    })

    assertType<Tools>({
      rsdoctor: {
        experiments: {
          enableNativePlugin: false,
        },
      },
    })
  })

  test('tools.rspack', () => {
    // Object
    assertType<Tools>({
      rspack: {},
    })
    assertType<Tools>({
      rspack: {
        entry: '123',
      },
    })
    assertType<Tools>({
      rspack: {
        devtool: false,
      },
    })
    assertType<Tools>({
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
    })

    // Function
    assertType<Tools>({
      rspack(config, { addRules }) {
        addRules({ loader: 'foo' })
        return config
      },
    })
    assertType<Tools>({
      rspack(config, { rspack, appendPlugins }) {
        appendPlugins(new rspack.BannerPlugin({ banner: 'hello' }))
        return config
      },
    })
    assertType<Tools>({
      rspack(config, { rspack, appendPlugins }) {
        // @ts-expect-error testing error
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        appendPlugins(rspack.BannerPlugin({ banner: 'hello' }))
        return config
      },
    })

    // Array
    assertType<Tools>({
      rspack: [
        (config, { addRules }) => {
          addRules({ loader: 'foo' })
          return config
        },
        {
          devtool: false,
        },
      ],
    })
  })

  test('tools.swc', () => {
    // Object
    assertType<Tools>({
      swc: {},
    })
    assertType<Tools>({
      swc: {
        jsc: {
          experimental: {
            plugins: [
              ['remove-console', {}],
            ],
          },
        },
      },
    })
    assertType<Tools>({
      swc: {
        jsc: {
          target: 'es2021',
        },
      },
    })
    assertType<Tools>({
      // @ts-expect-error testing error
      swc: {
        jsc: {
          target: 'es6',
        },
      },
    })
    assertType<Tools>({
      swc: {
        minify: true,
      },
    })
    assertType<Tools>({
      swc: {
        test: 'foo',
      },
    })

    // Function
    assertType<Tools>({
      swc(config) {
        delete config.env

        expectTypeOf(config).toHaveProperty('sourceMaps')
          .exclude(undefined)
          .exclude('inline')
          .toBeBoolean()

        expectTypeOf(config).toHaveProperty('inlineSourcesContent')
          .exclude(undefined)
          .toBeBoolean()

        expectTypeOf(config).toHaveProperty('isModule')
          .toEqualTypeOf<boolean | 'unknown' | undefined>()

        return config
      },
    })

    // Array
    assertType<Tools>({
      swc: [],
    })
    assertType<Tools>({
      swc: [
        { module: { type: 'es6', strict: true } },
      ],
    })
  })
})
