// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync, readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path, { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

const tempDirs: string[] = []

afterAll(async () => {
  // Runs even when a test fails, so the `NODE_ENV` stub below cannot leak into
  // later suites sharing this worker.
  rstest.unstubAllEnvs()
  await Promise.all(tempDirs.map(async (dir) => {
    await rm(dir, { recursive: true, force: true })
  }))
})

const entry = fileURLToPath(
  new URL('./fixtures/cross-module-worklet/index.tsx', import.meta.url),
)

/**
 * A `'main thread'` function defined in another module is captured into the
 * calling worklet's closure (`this._c`) and resolved at hydration through
 * `lynxWorkletImpl._workletMap[id]`. The main-thread passes shake away the
 * background-only code that surrounds the call site, so the named import is the
 * only thing that could still pull the defining module in — and DCE drops it
 * once it is unreferenced. When that happens the module never reaches the
 * main-thread bundle, `_workletMap[id]` is `undefined`, and hydration throws
 * `Cannot read properties of undefined (reading 'bind')`.
 */
describe('cross-module main thread functions', () => {
  for (const environment of ['lynx', 'web']) {
    test(`registers the worklet on the main thread (${environment})`, async () => {
      rstest.stubEnv('NODE_ENV', 'production')
      const { pluginReactLynx } = await import('../src/index.js')

      const root = await mkdtemp(
        path.join(tmpdir(), `rspeedy-react-cross-module-${environment}-`),
      )
      tempDirs.push(root)

      const entryName = `cross-module-worklet-${environment}`
      const rsbuild = await createRspeedy({
        rspeedyConfig: {
          source: { entry: { [entryName]: entry } },
          output: {
            distPath: { root },
            filenameHash: false,
            cleanDistPath: false,
            minify: false,
          },
          environments: { [environment]: {} },
          tools: {
            rspack: {
              context: dirname(fileURLToPath(import.meta.url)),
              resolve: {
                extensionAlias: {
                  '.js': ['.ts', '.js'],
                  '.jsx': ['.tsx', '.jsx'],
                },
              },
            },
          },
          plugins: [pluginReactLynx()],
        },
      })

      await rsbuild.build()

      // The `lynx` environment hides the intermediate chunks under `.rspeedy`,
      // the `web` one emits them next to the bundle.
      const mainThreadPath = [
        path.join(
          rsbuild.context.distPath,
          '.rspeedy',
          entryName,
          'main-thread.js',
        ),
        path.join(rsbuild.context.distPath, entryName, 'main-thread.js'),
      ].find(candidate => existsSync(candidate))

      if (!mainThreadPath) {
        expect.fail('expected a main-thread output to exist')
      }

      const mainThreadCode = readFileSync(mainThreadPath, 'utf8')
      const backgroundIds = [
        ...readFileSync(
          path.join(dirname(mainThreadPath), 'background.js'),
          'utf8',
        ).matchAll(/_wkltId:\s*"([^"]+)"/g),
      ].map(([, id]) => id)

      expect(backgroundIds.length).toBeGreaterThan(0)
      for (const id of backgroundIds) {
        expect(mainThreadCode).toContain(
          `registerWorkletInternal("main-thread", "${id}"`,
        )
      }
      // The defining module itself, not just the caller.
      expect(mainThreadCode).toContain('setStyleProperty')
    })
  }
})
