// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { DistPathConfig } from '@rsbuild/core'

/**
 * {@inheritdoc Output.distPath}
 *
 * @public
 */
export interface DistPath extends DistPathConfig {
  /**
   * The output directory of the intermediate files.
   *
   * @remarks
   *
   * Default value:
   *
   * - `'.rspeedy'`
   */
  intermediate?: string | undefined
}

export const DEFAULT_DIST_PATH_INTERMEDIATE = '.rspeedy'
