// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { EnvironmentContext } from '@rsbuild/core'

export function isLynx(environment: EnvironmentContext | string): boolean {
  return typeof environment === 'string'
    ? environment === 'lynx'
    : environment.name === 'lynx'
}
