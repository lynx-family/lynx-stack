// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { assertType, describe, test } from 'vitest'

import type { Config } from '../../src/index.js'

describe('Config - Performance', () => {
  type Performance = Config['performance']

  test('empty', () => {
    assertType<Performance>(void 0)
    assertType<Performance>({})
  })

  test('performance.buildCache', () => {
    assertType<Performance>({
      buildCache: undefined,
    })

    assertType<Performance>({
      buildCache: true,
    })

    assertType<Performance>({
      buildCache: false,
    })

    assertType<Performance>({
      buildCache: {
        cacheDigest: [process.env['SOME_ENV'], undefined],
      },
    })

    assertType<Performance>({
      buildCache: {
        buildDependencies: ['foo.txt'],
      },
    })

    assertType<Performance>({
      buildCache: {
        buildDependencies: ['foo.txt', 'bar.txt'],
      },
    })

    assertType<Performance>({
      buildCache: {
        cacheDirectory: 'foo/.cache',
      },
    })
  })

  test('performance.chunkSplit', () => {
    assertType<Performance>({
      chunkSplit: undefined,
    })
    assertType<Performance>({
      chunkSplit: {},
    })
  })

  test('performance.chunkSplit all-in-one', () => {
    assertType<Performance>({
      chunkSplit: {
        strategy: 'all-in-one',
      },
    })

    assertType<Performance>({
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
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'all-in-one',
        override: {
          maxInitialSize: 100,
        },
      },
    })
  })

  test('performance.chunkSplit single-vendor', () => {
    assertType<Performance>({
      chunkSplit: {
        strategy: 'single-vendor',
      },
    })

    assertType<Performance>({
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
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'single-vendor',
        override: {
          maxInitialSize: 100,
        },
      },
    })
  })

  test('performance.chunkSplit split-by-experience', () => {
    assertType<Performance>({
      chunkSplit: {
        strategy: 'split-by-experience',
      },
    })

    assertType<Performance>({
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
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'split-by-experience',
        override: {
          maxInitialSize: 100,
        },
      },
    })
  })

  test('performance.chunkSplit split-by-size', () => {
    assertType<Performance>({
      chunkSplit: {
        strategy: 'split-by-size',
      },
    })

    assertType<Performance>({
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
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'split-by-size',
        maxSize: 100,
      },
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'split-by-size',
        override: {
          maxInitialSize: 100,
        },
      },
    })
  })

  test('performance.chunkSplit custom', () => {
    assertType<Performance>({
      chunkSplit: {
        strategy: 'custom',
      },
    })

    assertType<Performance>({
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
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'custom',
        splitChunks: {
          chunks: 'initial',
        },
      },
    })

    assertType<Performance>({
      chunkSplit: {
        strategy: 'custom',
        splitChunks: {
          maxInitialSize: 100,
        },
      },
    })
  })

  test('performance.profile', () => {
    assertType<Performance>({
      profile: undefined,
    })

    assertType<Performance>({
      profile: true,
    })

    assertType<Performance>({
      profile: false,
    })
  })

  test('performance.removeConsole true', () => {
    assertType<Performance>({
      removeConsole: true,
    })
  })

  test('performance.removeConsole string[]', () => {
    assertType<Performance>({
      removeConsole: [
        'log',
        'warn',
        'error',
        'info',
        'profile',
        'profileEnd',
      ],
    })
  })

  test('performance.removeConsole false', () => {
    assertType<Performance>({
      removeConsole: false,
    })
  })

  test('performance.printFileSize', () => {
    assertType<Performance>({
      printFileSize: undefined,
    })
    assertType<Performance>({
      printFileSize: {},
    })
    assertType<Performance>({
      printFileSize: true,
    })
    assertType<Performance>({
      printFileSize: false,
    })
    assertType<Performance>({
      printFileSize: {
        detail: false,
      },
    })
    assertType<Performance>({
      printFileSize: {
        total: false,
      },
    })
    assertType<Performance>({
      printFileSize: {
        compressed: false,
      },
    })
    assertType<Performance>({
      printFileSize: {
        include: () => false,
      },
    })
    assertType<Performance>({
      printFileSize: {
        exclude: () => true,
      },
    })
  })
})
