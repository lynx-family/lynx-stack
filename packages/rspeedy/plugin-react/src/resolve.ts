// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createLazyResolver } from '@lynx-js/react-alias-rsbuild-plugin'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export const resolve: (request: string) => Promise<string> = createLazyResolver(
  __dirname,
  ['import'],
)

export const resolveMainThread: (request: string) => Promise<string> =
  createLazyResolver(
    __dirname,
    ['lepus'],
  )
