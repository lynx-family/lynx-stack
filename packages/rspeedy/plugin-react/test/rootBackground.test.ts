// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from '@rstest/core'

import {
  entryHasBoundary,
  resolveEnableMTSRendering,
  sourceHasBackground,
} from '../src/mtsRendering.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  path.resolve(__dirname, 'fixtures/root-background-detect', name)

describe('sourceHasBackground', () => {
  test('detects a <Background> at the render root', () => {
    expect(sourceHasBackground(`
      import { Background, root } from '@lynx-js/react'
      root.render(<Background fallback={<view/>}><App/></Background>)
    `)).toBe(true)
  })

  test('detects it through a <page> host wrapper', () => {
    expect(sourceHasBackground(`
      import { Background, root } from '@lynx-js/react'
      root.render(
        <page>
          <Background fallback={<Skeleton />}><App/></Background>
        </page>,
      )
    `)).toBe(true)
  })

  test('detects one nested inside a component — position does not matter', () => {
    expect(sourceHasBackground(`
      import { Background } from '@lynx-js/react'
      export function Middle() {
        return <view><Background fallback={<Sk/>}><Feed/></Background></view>
      }
    `)).toBe(true)
  })

  test('does not see an aliased element name — a known, safe blind spot', () => {
    // The *fold* follows the import binding and handles this correctly; only
    // this config-time scan matches the name literally. Missing it keeps the
    // classic build, which is the harmless direction.
    expect(sourceHasBackground(`
      import { Background as Boundary } from '@lynx-js/react'
      export const x = <Boundary fallback={<view/>}><App/></Boundary>
    `)).toBe(false)
  })

  test('detects a subpath import of Background', () => {
    expect(sourceHasBackground(`
      import { Background } from '@lynx-js/react/internal'
      export const x = <Background fallback={<view/>}><App/></Background>
    `)).toBe(true)
  })

  test('ignores a Background imported from elsewhere', () => {
    expect(sourceHasBackground(`
      import { Background } from './my-background.js'
      export const x = <Background><App/></Background>
    `)).toBe(false)
  })

  test('ignores an import that is never used as an element', () => {
    expect(sourceHasBackground(`
      import { Background } from '@lynx-js/react'
      export { Background }
    `)).toBe(false)
  })

  test('ignores a module with no Background at all', () => {
    expect(sourceHasBackground(`
      import { root } from '@lynx-js/react'
      root.render(<App/>)
    `)).toBe(false)
  })
})

describe('entryHasBoundary', () => {
  test('finds a boundary in the entry itself', () => {
    expect(entryHasBoundary(fixture('root-background.jsx'))).toBe(true)
  })

  test('finds one reachable only through a relative import', () => {
    expect(entryHasBoundary(fixture('entry-importing-middle.jsx'))).toBe(true)
  })

  test('stays false for an app that defers nothing', () => {
    expect(entryHasBoundary(fixture('no-background.jsx'))).toBe(false)
  })

  test('stays false for an unreadable entry', () => {
    expect(entryHasBoundary('@lynx-js/react/refresh')).toBe(false)
  })
})

describe('resolveEnableMTSRendering', () => {
  test('an explicit `true` keeps the classic build, without reading any file', () => {
    expect(
      resolveEnableMTSRendering(true, true, [fixture('root-background.jsx')]),
    ).toBe(true)
  })

  test('an explicit `false` forces the mode even without a root <Background>', () => {
    expect(
      resolveEnableMTSRendering(false, true, [fixture('no-background.jsx')]),
    ).toBe(false)
  })

  test('an explicit `false` forces the mode in development too', () => {
    expect(
      resolveEnableMTSRendering(false, false, [fixture('no-background.jsx')]),
    ).toBe(false)
  })

  test('\'auto\' turns the mode on for a detected root <Background> in production', () => {
    expect(
      resolveEnableMTSRendering('auto', true, [
        fixture('root-background.jsx'),
      ]),
    ).toBe(false)
  })

  test('\'auto\' keeps the classic build in development, even with a root <Background>', () => {
    expect(
      resolveEnableMTSRendering('auto', false, [
        fixture('root-background.jsx'),
      ]),
    ).toBe(true)
  })

  test('\'auto\' turns the mode on for a nested <Background> too', () => {
    // Position does not change the mechanism: the boundary is folded where it
    // sits, and only its own deferred subtree leaves the bundle.
    expect(
      resolveEnableMTSRendering('auto', true, [
        fixture('nested-background.jsx'),
      ]),
    ).toBe(false)
  })

  test('\'auto\' follows relative imports to find a boundary', () => {
    expect(
      resolveEnableMTSRendering('auto', true, [
        fixture('entry-importing-middle.jsx'),
      ]),
    ).toBe(false)
  })

  test('\'auto\' does not detect a plain entry', () => {
    expect(
      resolveEnableMTSRendering('auto', true, [fixture('no-background.jsx')]),
    ).toBe(true)
  })

  test('\'auto\' skips unreadable paths (bare specifiers, virtual entries)', () => {
    expect(
      resolveEnableMTSRendering('auto', true, [
        '@lynx-js/react/refresh',
        fixture('root-background.jsx'),
      ]),
    ).toBe(false)
  })

  test('the default (`undefined`) resolves like \'auto\'', () => {
    expect(
      resolveEnableMTSRendering(undefined, true, [
        fixture('root-background.jsx'),
      ]),
    ).toBe(false)
    expect(
      resolveEnableMTSRendering(undefined, true, [
        fixture('no-background.jsx'),
      ]),
    ).toBe(true)
  })
})
