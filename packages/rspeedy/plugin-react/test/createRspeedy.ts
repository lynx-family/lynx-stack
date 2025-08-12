// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRspeedy } from '@lynx-js/rspeedy'
import type { CreateRspeedyOptions } from '@lynx-js/rspeedy'

export async function createStubRspeedy(
  options: CreateRspeedyOptions,
): Promise<ReturnType<typeof createRspeedy>> {
  options.cwd ??= path.dirname(fileURLToPath(import.meta.url))
  return await createRspeedy(options)
}
