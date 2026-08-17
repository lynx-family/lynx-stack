// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import { pluginStubRspeedyAPI } from './stub-rspeedy-api.plugin.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

describe('directive inference builds', () => {
  for (const lazy of [false, true]) {
    test(`${lazy ? 'lazy' : 'normal'} dual compilation discovers package manifests`, async () => {
      const { pluginReactLynx } = await import('../src/index.js')
      const output = await fs.mkdtemp(
        path.join(tmpdir(), `rspeedy-directive-inference-${lazy}-`),
      )

      try {
        const rsbuild = await createRspeedy({
          rspeedyConfig: {
            source: {
              entry: {
                main: fileURLToPath(
                  new URL(
                    './fixtures/directive-inference/index.tsx',
                    import.meta.url,
                  ),
                ),
              },
            },
            output: {
              distPath: { root: output },
            },
            plugins: [
              pluginReactLynx({
                experimental_isLazyBundle: lazy,
              }),
              pluginStubRspeedyAPI(),
            ],
          },
        })

        const result = await rsbuild.build()
        expect(result.stats?.hasWarnings()).toBe(false)
        await result.close()

        const report = JSON.parse(
          await fs.readFile(
            path.join(output, 'directive-inference.json'),
            'utf8',
          ),
        ) as {
          protocolVersion: number
          sites: Record<string, unknown>[]
        }
        expect(report).toEqual({
          protocolVersion: 1,
          sites: [
            expect.objectContaining({
              package: '@lynx-js/react',
              packageVersion: '0.124.0',
              source: '@lynx-js/react',
              export: 'mainThread',
              path: 'marker.0',
              manifest: 'directive-inference.json',
            }),
            expect.objectContaining({
              package: '@lynx-js/motion',
              packageVersion: '0.0.6',
              source: '@lynx-js/motion',
              export: 'motion.div',
              path: 'props.transition.ease.0',
              manifest: 'directive-inference.json',
            }),
            expect.objectContaining({
              package: '@lynx-js/motion',
              packageVersion: '0.0.6',
              source: '@lynx-js/motion',
              export: 'motion.div',
              path: 'props.transition.ease.1',
              manifest: 'directive-inference.json',
            }),
            expect.objectContaining({
              package: '@lynx-js/motion',
              packageVersion: '0.0.6',
              source: '@lynx-js/motion',
              export: 'motion.div',
              path: 'props.transformTemplate',
              manifest: 'directive-inference.json',
            }),
          ],
        })
      } finally {
        await fs.rm(output, { recursive: true, force: true })
      }
    })
  }
})
