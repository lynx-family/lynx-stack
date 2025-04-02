#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable n/no-unpublished-bin */
// @ts-check

try {
  process.title = 'node (Rspeedy)'
} catch {
  // ignore error
}
const { main } = await import('../lib/cli/main.js')

await main(process.argv)

export {}
