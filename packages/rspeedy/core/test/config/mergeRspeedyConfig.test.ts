// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { describe, expect, it } from 'vitest'

import { mergeRspeedyConfig } from '../../src/config/mergeRspeedyConfig.js'

describe('mergeRspeedyConfig', () => {
  it('should override Rsbuild config', () => {
    const config = mergeRspeedyConfig({
      source: { entry: './src/index.tsx' },
    }, {
      source: { entry: './src/index2.tsx' },
    })

    expect(config).toEqual({
      source: { entry: './src/index2.tsx' },
    })
  })

  it('should merge Rsbuild config array', () => {
    const config = mergeRspeedyConfig({
      source: { entry: ['./src/index.tsx'] },
    }, {
      source: { entry: ['./src/index2.tsx'] },
    })

    expect(config).toEqual({
      source: { entry: ['./src/index.tsx', './src/index2.tsx'] },
    })
  })

  it('should merge Rsbuild config object', () => {
    const config = mergeRspeedyConfig({
      source: { define: { FOO: 'true' } },
    }, {
      source: { define: { BAR: 'false' } },
    })

    expect(config).toEqual({
      source: { define: { FOO: 'true', BAR: 'false' } },
    })
  })

  it('should merge Rsbuild config object and array', () => {
    const config = mergeRspeedyConfig({
      source: { entry: ['./src/index.tsx'] },
    }, {
      source: { define: { BAR: 'false' } },
    })

    expect(config).toEqual({
      source: { entry: ['./src/index.tsx'], define: { BAR: 'false' } },
    })
  })

  it('should merge Rspeedy custom config', () => {
    const config = mergeRspeedyConfig({
      output: {
        filename: 'foo.bundle',
      },
    }, {
      output: {
        filename: {
          bundle: 'bundle2.js',
        },
      },
    })

    expect(config).toEqual({
      output: {
        filename: {
          bundle: 'bundle2.js',
        },
      },
    })
  })
})
