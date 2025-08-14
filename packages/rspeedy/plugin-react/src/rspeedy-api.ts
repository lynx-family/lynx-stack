// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import invariant from 'tiny-invariant'

import type { ExposedAPI, RsbuildPluginAPI } from '@lynx-js/rspeedy'

export function getRspeedyAPI(api: RsbuildPluginAPI): ExposedAPI {
  const rspeedyAPI = api.useExposed<ExposedAPI>(
    Symbol.for('rspeedy.api'),
  )!
  invariant(rspeedyAPI, 'Should have rspeedy.api')
  return rspeedyAPI
}
