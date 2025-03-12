// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { fs, vol } from 'memfs'
import { beforeEach, describe, expect, test, vi } from 'vitest'

import { install } from '../src/install.js'

vi.mock('node:fs')

beforeEach(() => {
  vol.reset()
})

describe('Install', () => {
  test('no package.json', async () => {
    await expect(() => install('/tmp')).rejects
      .toThrowErrorMatchingInlineSnapshot(
        `[Error: /tmp/package.json not found. Please run upgrade-rspeedy in your Rspeedy project.]`,
      )
  })

  test('invalid package.json', async () => {
    vol.fromJSON(
      {
        'package.json': 'This is a invalid JSON',
      },
      '/tmp',
    )

    await expect(() => install('/tmp')).rejects.toThrowError('Unexpected token')
  })

  test('empty package.json', async () => {
    vol.fromJSON(
      {
        'package.json': '{}',
      },
      '/tmp',
    )

    await expect(() => install('/tmp')).rejects
      .toThrowErrorMatchingInlineSnapshot(`
      [Error: No @lynx-js/rspeedy found in /tmp/package.json.

      Please run upgrade-rspeedy in your Rspeedy project.]
    `)
  })

  test('empty dependencies', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          devDependencies: {
            '@lynx-js/rspeedy': 'workspace:*',
          },
          dependencies: {},
        }),
      },
      '/tmp',
    )

    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `"{"devDependencies":{"@lynx-js/rspeedy":"workspace:*"},"dependencies":{}}"`,
    )
  })

  test('update dependencies', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          dependencies: {
            '@lynx-js/react': '0.20.0',
          },
          devDependencies: {
            '@lynx-js/rspeedy': 'workspace:*',
          },
        }),
      },
      '/tmp',
    )

    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `
      "{"dependencies":{"@lynx-js/react":"workspace:*"},"devDependencies":{"@lynx-js/rspeedy":"workspace:*"}}
      "
    `,
    )
  })

  test('update devDependencies', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          devDependencies: {
            '@lynx-js/react-rsbuild-plugin': '0.20.0',
            '@lynx-js/rspeedy': 'workspace:*',
          },
        }),
      },
      '/tmp',
    )

    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `
      "{"devDependencies":{"@lynx-js/react-rsbuild-plugin":"workspace:*","@lynx-js/rspeedy":"workspace:*"}}
      "
    `,
    )
  })

  test('update dependencies and devDependencies', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify({
          dependencies: {
            '@lynx-js/react': '0.20.0',
          },
          devDependencies: {
            '@lynx-js/rspeedy': '0.100.0',
          },
        }),
      },
      '/tmp',
    )

    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `
      "{"dependencies":{"@lynx-js/react":"workspace:*"},"devDependencies":{"@lynx-js/rspeedy":"workspace:*"}}
      "
    `,
    )
  })

  test('do not update non-public packages', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify(
          {
            devDependencies: {
              '@lynx-js/rspeedy': '0.20.0',
              'memfs': '0.100.0',
            },
          },
          null,
          2,
        ),
      },
      '/tmp',
    )

    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `
      "{
        "devDependencies": {
          "@lynx-js/rspeedy": "workspace:*",
          "memfs": "0.100.0"
        }
      }
      "
    `,
    )
  })

  test('do not update peerDependencies', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify(
          {
            devDependencies: {
              '@lynx-js/rspeedy': 'workspace:*',
            },
            peerDependencies: {
              '@lynx-js/rspeedy': '^0.20.0',
            },
          },
          null,
          2,
        ),
      },
      '/tmp',
    )

    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8')).toMatchInlineSnapshot(
      `
      "{
        "devDependencies": {
          "@lynx-js/rspeedy": "workspace:*"
        },
        "peerDependencies": {
          "@lynx-js/rspeedy": "^0.20.0"
        }
      }"
    `,
    )
  })

  test('update with indent respected', async () => {
    vol.fromJSON(
      {
        'package.json': JSON.stringify(
          {
            devDependencies: {
              '@lynx-js/rspeedy': '0.20.0',
            },
          },
          null,
          4,
        ),
      },
      '/tmp',
    )
    await install('/tmp')

    expect(fs.readFileSync('/tmp/package.json', 'utf-8'))
      .toMatchInlineSnapshot(`
        "{
            "devDependencies": {
                "@lynx-js/rspeedy": "workspace:*"
            }
        }
        "
      `)
  })
})
