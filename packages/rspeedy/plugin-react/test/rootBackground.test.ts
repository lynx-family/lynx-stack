// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from '@rstest/core'

import {
  resolveEnableMTSRendering,
  rootBackgroundFallbackHasUserComponent,
  sourceHasRootBackground,
} from '../src/mtsRendering.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixture = (name: string) =>
  path.resolve(__dirname, 'fixtures/root-background-detect', name)

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

  test('\'auto\' does not detect a nested <Background>', () => {
    expect(
      resolveEnableMTSRendering('auto', true, [
        fixture('nested-background.jsx'),
      ]),
    ).toBe(true)
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

describe('rootBackgroundFallbackHasUserComponent', () => {
  test('flags a user component in the root <Background> fallback', () => {
    expect(rootBackgroundFallbackHasUserComponent(`
      import { Background, root } from '@lynx-js/react'
      root.render(
        <Background fallback={<Spinner />}>
          <App/>
        </Background>,
      )
    `)).toBe(true)
  })

  test('flags a user component nested under host elements in the fallback', () => {
    expect(rootBackgroundFallbackHasUserComponent(`
      import { Background, root } from '@lynx-js/react'
      root.render(
        <Background fallback={<view><text>Loading</text><Brand.Logo/></view>}>
          <App/>
        </Background>,
      )
    `)).toBe(true)
  })

  test('accepts a host-element-only fallback', () => {
    expect(rootBackgroundFallbackHasUserComponent(`
      import { Background, root } from '@lynx-js/react'
      root.render(
        <Background fallback={<view><text>Loading…</text></view>}>
          <App/>
        </Background>,
      )
    `)).toBe(false)
  })

  test('stays silent without a root <Background>', () => {
    expect(rootBackgroundFallbackHasUserComponent(`
      import { root } from '@lynx-js/react'
      root.render(<App/>)
    `)).toBe(false)
  })

  test('stays silent without an inline fallback element', () => {
    expect(rootBackgroundFallbackHasUserComponent(`
      import { Background, root } from '@lynx-js/react'
      root.render(<Background fallback={fallbackFromElsewhere}><App/></Background>)
    `)).toBe(false)
  })

  test('does not read a later fallback attribute as the root one', () => {
    expect(rootBackgroundFallbackHasUserComponent(`
      import { Background, root } from '@lynx-js/react'
      root.render(<Background><App fallback={<Spinner/>}/></Background>)
    `)).toBe(false)
  })
})
