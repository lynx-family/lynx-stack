// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rsbuild/core'

import type { ReactCompileResult } from '@lynx-js/react-webpack-plugin'

/**
 * Versioned React compilation-result exposure retrieved with
 * `api.useExposed(Symbol.for('@lynx-js/react/internal:compile-result'))`.
 *
 * @public
 */
export interface ReactCompileResultExposureV1 {
  /** The exposure protocol version. */
  version: 1
  /**
   * Read semantic runtime requirements from the supplied compilations.
   *
   * @param stats - Original Stats or MultiStats objects, read before the build
   * is closed. Serialized Stats JSON is not supported; callers must handle
   * absent stats and build errors before calling this method.
   * @returns A known result, or `undefined` if any compilation has no compatible
   * semantic producer. An explicit `false` remains distinct from unknown.
   * @remarks
   * MultiStats combines all child requirements with OR only when every child
   * has a compatible result. Pass a single environment's Stats to read its
   * result independently in a mixed-environment build.
   */
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
