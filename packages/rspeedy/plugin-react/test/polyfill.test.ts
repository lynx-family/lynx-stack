// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'

import { describe, expect, onTestFinished, test } from '@rstest/core'

import { createStubRspeedy } from './createRspeedy.js'
import { pluginReactLynx } from '../src/index.js'

describe('Object.hasOwn compatibility polyfills', () => {
  test.each(
    [
      [true, false],
      [false, false],
      [true, true],
      [false, true],
    ] as const,
  )(
    'Object.hasOwn: used=%s, excluded=%s',
    async (used, excluded) => {
      const injected = !excluded
      const distPath = await mkdtemp(
        path.join(tmpdir(), 'react-lynx-polyfill-'),
      )
      onTestFinished(() => rm(distPath, { recursive: true, force: true }))
      const rsbuild = await createStubRspeedy({
        rspeedyConfig: {
          mode: 'production',
          source: {
            entry: {
              main: fileURLToPath(
                new URL(
                  `../../plugin-lynx/test/fixtures/${
                    used ? 'object-has-own' : 'no-object-has-own'
                  }.js`,
                  import.meta.url,
                ),
              ),
            },
          },
          output: {
            distPath: { root: distPath },
            filenameHash: false,
            minify: false,
            sourceMap: false,
          },
          ...excluded
            ? { tools: { swc: { env: { exclude: ['es.object.has-own'] } } } }
            : {},
          plugins: [pluginReactLynx()],
        },
      })
      await rsbuild.build()
      for (const thread of ['main-thread', 'background']) {
        const code = await readFile(
          path.join(distPath, '.lynx', 'main', `${thread}.js`),
          'utf8',
        )
        // Each thread gets a separate global object without Node's native API.
        const factories = new Map<string, (...args: unknown[]) => void>()
        const tt = {
          define(name: string, factory: (...args: unknown[]) => void) {
            factories.set(name, factory)
          },
          require(name: string) {
            const mockModule = { exports: {} }
            const args: unknown[] = Array(18).fill(undefined)
            args[1] = mockModule
            args[2] = mockModule.exports
            args[9] = tt
            args[10] = console
            args[16] = {}
            factories.get(name)!(...args)
            return mockModule.exports
          },
        }
        const context = { tt }
        runInNewContext(`delete Object.hasOwn;\n${code}`, context)
        const nativeContext = { tt }
        runInNewContext(
          `globalThis.__nativeHasOwn = Object.hasOwn;\n${code}`,
          nativeContext,
        )
        expect(
          runInNewContext('Object.hasOwn === __nativeHasOwn', nativeContext),
        )
          .toBe(true)
        if (!used) {
          expect(runInNewContext('__entryLoaded', context)).toBe(true)
          // Explicit builtin includes force imports even in unused modules.
          expect(runInNewContext('typeof Object.hasOwn', context)).toBe(
            injected ? 'function' : 'undefined',
          )
          continue
        }
        expect(runInNewContext('__hasOwnAtEntry', context)).toBe(injected)
        if (injected) {
          expect(runInNewContext('__checkHasOwn()', context)).toEqual([
            true,
            false,
            true,
            true,
            true,
            true,
          ])
        } else {
          expect(runInNewContext('typeof Object.hasOwn', context)).toBe(
            'undefined',
          )
        }
      }
    },
  )
})
