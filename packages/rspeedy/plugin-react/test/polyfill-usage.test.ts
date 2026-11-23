// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { runInNewContext } from 'node:vm'

import { describe, expect, onTestFinished, test } from '@rstest/core'

import { createStubRspeedy } from './createRspeedy.js'
import { pluginReactLynx } from '../src/index.js'

describe('polyfill usage', () => {
  test.each(['off', 'usage'] as const)(
    'builds both threads with %s',
    async polyfill => {
      const dir = await mkdtemp(path.join(tmpdir(), 'lynx-polyfill-'))
      onTestFinished(() => rm(dir, { recursive: true, force: true }))
      const entry = path.join(dir, 'index.js')
      await mkdir(path.join(dir, 'node_modules'))
      await symlink(
        path.dirname(
          createRequire(import.meta.url).resolve('core-js/package.json'),
        ),
        path.join(dir, 'node_modules', 'core-js'),
        'dir',
      )
      await writeFile(
        entry,
        `
      globalThis.result = [Object.hasOwn({}, 'x'), [1, 2].findLast(Boolean),
        [2, 1].toSorted(), Object.groupBy([1], String), Promise.withResolvers()];
      globalThis.mapResult = new Map().has('x');
      globalThis.setResult = new Set().delete('x');
    `,
      )
      const rsbuild = await createStubRspeedy({
        rspeedyConfig: {
          mode: 'production',
          performance: { profile: true },
          source: { entry: { main: entry } },
          output: {
            polyfill,
            distPath: { root: path.join(dir, 'dist') },
            filenameHash: false,
            minify: false,
            sourceMap: false,
          },
          plugins: [pluginReactLynx()],
        },
      })
      await rsbuild.build()
      const stats = await readFile(path.join(dir, 'dist', 'stats.json'), 'utf8')
      expect(stats).not.toContain('web.url-search-params')
      expect(stats).not.toContain('web.url.can-parse')
      for (const thread of ['main-thread', 'background']) {
        const code = await readFile(
          path.join(dir, 'dist', '.lynx', 'main', `${thread}.js`),
          'utf8',
        )
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
            args[16] = context.lynx
            factories.get(name)!(...args)
            return mockModule.exports
          },
        }
        const context = { tt, lynx: { Promise: undefined as unknown } }
        const setup = `delete Object.hasOwn; delete Array.prototype.findLast;
          delete Array.prototype.toSorted; delete Object.groupBy;
          delete Promise.withResolvers; lynx.Promise = Promise;`
        if (polyfill === 'usage') {
          runInNewContext(`${setup}\n${code}`, context)
          expect(runInNewContext('result[0]', context)).toBe(false)
          expect(runInNewContext('result[1]', context)).toBe(2)
          expect(runInNewContext('result[2].join()', context)).toBe('1,2')
          expect(runInNewContext('result[3]["1"][0]', context)).toBe(1)
          expect(runInNewContext('typeof result[4].resolve', context)).toBe(
            'function',
          )
        } else {
          expect(() => {
            runInNewContext(`${setup}\n${code}`, context)
          }).toThrow(/Object\.hasOwn/)
        }
      }
    },
  )
})
