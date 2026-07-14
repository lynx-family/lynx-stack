// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from '@rstest/core'

import {
  resolveStripAllComponents,
  sourceHasRootBackground,
} from '../src/stripComponents.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  path.resolve(__dirname, 'fixtures/strip-detect', name)

describe('sourceHasRootBackground', () => {
  test('detects a root-level <Background> in render position', () => {
    expect(sourceHasRootBackground(`
      import { Background, root } from '@lynx-js/react'
      root.render(<Background fallback={<view/>}><App/></Background>)
    `)).toBe(true)
  })

  test('detects it across multiple lines', () => {
    expect(sourceHasRootBackground(`
      import { Background, root } from '@lynx-js/react'
      root.render(
        <Background fallback={<view><text>Loading…</text></view>}>
          <App/>
        </Background>,
      )
    `)).toBe(true)
  })

  test('detects a subpath import of Background', () => {
    expect(sourceHasRootBackground(`
      import { root } from '@lynx-js/react'
      import { Background } from '@lynx-js/react/internal'
      root.render(<Background fallback={<view/>}><App/></Background>)
    `)).toBe(true)
  })

  test('detects a self-closing root <Background/>', () => {
    expect(sourceHasRootBackground(`
      import { Background, root } from '@lynx-js/react'
      root.render(<Background fallback={<view/>}/>)
    `)).toBe(true)
  })

  test('ignores a <Background> nested inside the app (a partial opt-out)', () => {
    expect(sourceHasRootBackground(`
      import { Background, root } from '@lynx-js/react'
      function App() {
        return <view><Background fallback={<text/>}><Feed/></Background></view>
      }
      root.render(<App/>)
    `)).toBe(false)
  })

  test('ignores a <Background> not imported from @lynx-js/react', () => {
    expect(sourceHasRootBackground(`
      import { Background } from './my-background.js'
      import { root } from '@lynx-js/react'
      root.render(<Background><App/></Background>)
    `)).toBe(false)
  })

  test('ignores a plain root.render(<App/>)', () => {
    expect(sourceHasRootBackground(`
      import { root } from '@lynx-js/react'
      root.render(<App/>)
    `)).toBe(false)
  })
})

describe('resolveStripAllComponents', () => {
  test('an explicit `true` wins, without reading any file', () => {
    expect(resolveStripAllComponents(true, [fixture('no-background.jsx')]))
      .toBe(true)
  })

  test('an explicit `false` wins even when a root <Background> exists', () => {
    expect(resolveStripAllComponents(false, [fixture('root-background.jsx')]))
      .toBe(false)
  })

  test('auto-detects a root <Background> from the entry files', () => {
    expect(
      resolveStripAllComponents(undefined, [fixture('root-background.jsx')]),
    )
      .toBe(true)
  })

  test('does not auto-detect a nested <Background>', () => {
    expect(
      resolveStripAllComponents(undefined, [fixture('nested-background.jsx')]),
    ).toBe(false)
  })

  test('does not auto-detect a plain entry', () => {
    expect(resolveStripAllComponents(undefined, [fixture('no-background.jsx')]))
      .toBe(false)
  })

  test('skips unreadable paths (bare specifiers, virtual entries)', () => {
    expect(
      resolveStripAllComponents(undefined, [
        '@lynx-js/react/refresh',
        fixture('root-background.jsx'),
      ]),
    ).toBe(true)
  })

  test('returns false when no entry file declares a root <Background>', () => {
    expect(
      resolveStripAllComponents(undefined, [
        fixture('no-background.jsx'),
        fixture('nested-background.jsx'),
      ]),
    ).toBe(false)
  })
})
