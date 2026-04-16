// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, test } from 'vitest'

import type { Output } from '../../src/index.js'

describe('Config - minify', () => {
  type Minify = Output['minify']

  test('empty', () => {
    assertType<Minify>(void 0)
    assertType<Minify>(false)
    assertType<Minify>(true)
    assertType<Minify>({})
  })

  test('minify.compress', () => {
    assertType<Minify>({
      jsOptions: { minimizerOptions: { compress: false } },
    })

    assertType<Minify>({
      jsOptions: { minimizerOptions: { compress: true } },
    })

    assertType<Minify>({
      jsOptions: {
        minimizerOptions: {
          compress: {
            expression: false,

            inline: 1,

            pure_funcs: ['console.log'],

            negate_iife: true,

            dead_code: true,
          },
        },
      },
    })
  })

  test('minify.mangle', () => {
    assertType<Minify>({
      jsOptions: { minimizerOptions: { mangle: true } },
    })
    assertType<Minify>({
      jsOptions: { minimizerOptions: { mangle: false } },
    })
    assertType<Minify>({
      jsOptions: { minimizerOptions: { mangle: {} } },
    })
    assertType<Minify>({
      jsOptions: {
        minimizerOptions: {
          mangle: {
            props: {},

            toplevel: true,

            reserved: ['foo', 'lynx'],

            keep_classnames: false,
          },
        },
      },
    })
  })

  test('minify.format', () => {
    assertType<Minify>({
      jsOptions: { minimizerOptions: { format: {} } },
    })
    assertType<Minify>({
      jsOptions: {
        minimizerOptions: {
          format: {
            ascii_only: true,
            asciiOnly: false,
            preserve_annotations: true,
          },
        },
      },
    })
  })

  test('minify.threadOptions', () => {
    assertType<Minify>({
      mainThreadOptions: {
        minimizerOptions: {
          compress: {
            pure_funcs: ['lynx.getJSModule'],
          },
        },
      },
      backgroundOptions: {
        minimizerOptions: {
          compress: {
            pure_funcs: ['lynx.registerDataProcessors'],
          },
        },
      },
    })
  })

  test('minify.extractComments', () => {
    assertType<Minify>({
      jsOptions: { extractComments: false },
    })

    assertType<Minify>({
      jsOptions: { extractComments: {} },
    })

    assertType<Minify>({
      jsOptions: { extractComments: /@license/ },
    })

    assertType<Minify>({
      jsOptions: {
        extractComments: {
          condition: false,
          banner: false,
        },
      },
    })

    assertType<Minify>({
      jsOptions: {
        extractComments: {
          condition: /^@keep/,
          banner: 'foo',
        },
      },
    })
  })

  test('minify.css', () => {
    assertType<Minify>({
      css: false,
    })

    assertType<Minify>({
      css: true,
    })
  })
})
