// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'
import { describe, expect, it } from '@rstest/core'

import { reactCompileResultExposure } from '../src/compileResult.js'

const REACT_COMPILATION_RESULT = Symbol.for(
  '@lynx-js/react/internal:compilation-result',
)

function createStats(
  mainThreadProgrammability: boolean | undefined,
): Rspack.Stats {
  const compilation: Record<symbol, unknown> = {}
  if (mainThreadProgrammability !== undefined) {
    compilation[REACT_COMPILATION_RESULT] = {
      version: 1,
      runtimeRequirements: { mainThreadProgrammability },
    }
  }
  return { compilation } as unknown as Rspack.Stats
}

describe('react compile result exposure', () => {
  it('keeps explicit false distinct from producer absence', () => {
    expect(reactCompileResultExposure.getCompileResult(createStats(false)))
      .toEqual({
        version: 1,
        runtimeRequirements: { mainThreadProgrammability: false },
      })
    expect(reactCompileResultExposure.getCompileResult(createStats(undefined)))
      .toBeUndefined()
  })

  it('aggregates all child compilations in MultiStats', () => {
    const multiStats = {
      stats: [createStats(false), createStats(true)],
    } as unknown as Rspack.MultiStats

    expect(reactCompileResultExposure.getCompileResult(multiStats)).toEqual({
      version: 1,
      runtimeRequirements: { mainThreadProgrammability: true },
    })
  })

  it('returns unknown when any child compilation lacks the producer', () => {
    const multiStats = {
      stats: [createStats(false), createStats(undefined)],
    } as unknown as Rspack.MultiStats

    expect(reactCompileResultExposure.getCompileResult(multiStats))
      .toBeUndefined()
  })
})
