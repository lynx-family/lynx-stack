#!/usr/bin/env node

// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/* eslint-disable n/no-unpublished-bin */
// @ts-check

import { existsSync } from 'node:fs'

try {
  process.title = 'node (Rspeedy)'
} catch {
  // ignore error
}
const ciDistEntry = '../dist/cli/main.js'
const localLibEntry = '../lib/cli/main.js'

// CI runs `rslib build` before invoking workspace bins, so use the freshly
// produced dist entry there instead of restored incremental `lib` output.
const entry =
  process.env.CI && existsSync(new URL(ciDistEntry, import.meta.url))
    ? ciDistEntry
    : localLibEntry

const { main } = await import(entry)

await main(process.argv)
