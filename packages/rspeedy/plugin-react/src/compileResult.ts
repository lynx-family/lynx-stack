// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

export interface ReactCompileResult {
  version: 1
  runtimeRequirements: {
    mainThreadProgrammability: boolean
  }
}

export interface ReactCompileResultExposureV1 {
  version: 1
  getCompileResult(
    stats: Rspack.Stats | Rspack.MultiStats,
  ): ReactCompileResult | undefined
}

const REACT_COMPILATION_RESULT: symbol = Symbol.for(
  '@lynx-js/react/internal:compilation-result',
)

export const REACT_COMPILE_RESULT_EXPOSURE: symbol = Symbol.for(
  '@lynx-js/react/internal:compile-result',
)

function isReactCompileResult(value: unknown): value is ReactCompileResult {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  if ((value as { version?: unknown }).version !== 1) {
    return false
  }
  const runtimeRequirements = (value as {
    runtimeRequirements?: unknown
  }).runtimeRequirements
  return typeof runtimeRequirements === 'object'
    && runtimeRequirements !== null
    && typeof (runtimeRequirements as {
        mainThreadProgrammability?: unknown
      }).mainThreadProgrammability === 'boolean'
}

function getCompilationResult(
  stats: Rspack.Stats,
): ReactCompileResult | undefined {
  const compilation = stats.compilation as unknown as Record<symbol, unknown>
  const result = compilation[REACT_COMPILATION_RESULT]
  return isReactCompileResult(result) ? result : undefined
}

export const reactCompileResultExposure: ReactCompileResultExposureV1 = {
  version: 1,
  getCompileResult(stats) {
    const childStats = 'stats' in stats ? stats.stats : [stats]
    if (childStats.length === 0) {
      return undefined
    }

    let mainThreadProgrammability = false
    for (const childStatsItem of childStats) {
      const result = getCompilationResult(childStatsItem)
      if (result === undefined) {
        return undefined
      }
      mainThreadProgrammability ||=
        result.runtimeRequirements.mainThreadProgrammability
    }

    return {
      version: 1,
      runtimeRequirements: { mainThreadProgrammability },
    }
  },
}
