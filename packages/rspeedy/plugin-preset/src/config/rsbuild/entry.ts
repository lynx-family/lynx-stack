// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildEntry } from '@rsbuild/core'

import { debug, debugList } from '../../debug.js'
import type { Entry } from '../source/entry.js'

const DEFAULT_ENTRY = './src/index.js'

export function toRsbuildEntry(
  entry: Entry | undefined,
): RsbuildEntry {
  // Default value
  if (entry === undefined) {
    debug(`Using default entry ${DEFAULT_ENTRY}`)
    return {
      main: DEFAULT_ENTRY,
    }
  }

  // Single entry
  if (Array.isArray(entry) || typeof entry === 'string') {
    debug(() => `Using single entry ${[''].concat(entry).join('\n    - ')}`)
    return { main: entry }
  }

  return Object.fromEntries(
    Object.entries(entry).map(([key, value]) => {
      if (Array.isArray(value) || typeof value === 'string') {
        debugList(`Using multiple entries - ${key}`, value)
        return [key, { import: value }]
      }

      debugList(
        `Using multiple entries - ${key}`,
        value.import ?? DEFAULT_ENTRY,
      )

      if (value.import === undefined) {
        return [
          key,
          { ...value, import: DEFAULT_ENTRY } as RsbuildEntry[string],
        ]
      }

      return [key, value as Exclude<RsbuildEntry[string], string | string[]>]
    }),
  )
}
