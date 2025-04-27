#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
// @ts-check
import nodeModule from 'node:module'

import { tryStartLocalRspeedy } from '../dist/cli/start.js'

// See: https://nodejs.org/id/blog/release/v22.8.0
// eslint-disable-next-line n/no-unsupported-features/node-builtins
const { enableCompileCache } = nodeModule
if (enableCompileCache && !process.env['NODE_DISABLE_COMPILE_CACHE']) {
  try {
    enableCompileCache()
  } catch {
    // ignore errors
  }
}

try {
  process.title = 'node (Rspeedy)'
} catch {
  // ignore error
}

if (tryStartLocalRspeedy() === false) {
  // A project rspeedy dependency was not found, so launch the unmanaged version.
  const { main } = await import('../dist/cli/main.js')

  await main(process.argv)
}
