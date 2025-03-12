// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { fs, vol } from 'memfs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { main } from '../src/main.js'

vi.mock('node:fs')

beforeEach(() => {
  vol.reset()
})

describe('main', () => {
  test('install-rspeedy', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          devDependencies: {
            '@lynx-js/rspeedy': '0.0.0',
          },
        }),
      },
      '/tmp',
    )
    await main('/tmp', ['node', 'upgrade-rspeedy'])

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `
      "{"devDependencies":{"@lynx-js/rspeedy":"workspace:*"}}
      "
    `,
    )
  })
})
