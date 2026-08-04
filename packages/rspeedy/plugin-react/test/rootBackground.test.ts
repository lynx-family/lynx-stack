// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from '@rstest/core'

import {
  entryHasBackground,
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

  test('detects an aliased binding, whatever the element is called', () => {
    // The scan asks about the *binding*, not the element name: the fold
    // follows the import binding, so an alias defers exactly as much as the
    // plain name does. Answering `false` here would leave the main thread
    // with nothing to compile — a blank first screen, not a missed
    // optimization.
    expect(sourceHasBackground(`
      import { Background as Boundary } from '@lynx-js/react'
      export const x = <Boundary fallback={<view/>}><App/></Boundary>
    `)).toBe(true)
  })

  test('detects a namespace import — the namespace carries Background', () => {
    expect(sourceHasBackground(`
      import * as ReactLynx from '@lynx-js/react'
      export const x = (
        <ReactLynx.Background fallback={<view/>}><App/></ReactLynx.Background>
      )
    `)).toBe(true)
  })

  test('detects a re-export, which is how a barrel module passes it on', () => {
    expect(sourceHasBackground(`
      export { Background } from '@lynx-js/react'
    `)).toBe(true)
  })

  test('detects an export-star of the runtime', () => {
    expect(sourceHasBackground(`
      export * from '@lynx-js/react'
    `)).toBe(true)
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

  test('does not let a Background from elsewhere bind to a runtime import', () => {
    // `[^{}]*` keeps a braced match inside one `{ … }`, so the two statements
    // below cannot be spliced into a single match.
    expect(sourceHasBackground(`
      import { Background } from './my-background.js'
      import { root } from '@lynx-js/react'
      root.render(<Background><App/></Background>)
    `)).toBe(false)
  })

  test('detects a binding that is only re-exported, never rendered here', () => {
    // A false positive costs close to nothing — the entry compiles as it
    // would have, and the assembly subtracts what the main-thread bundle
    // already owns — while a false negative costs the whole first frame.
    expect(sourceHasBackground(`
      import { Background } from '@lynx-js/react'
      export { Background }
    `)).toBe(true)
  })

  test('ignores a module with no Background at all', () => {
    expect(sourceHasBackground(`
      import { root } from '@lynx-js/react'
      root.render(<App/>)
    `)).toBe(false)
  })
})

describe('entryHasBackground', () => {
  test('finds a boundary in the entry itself', () => {
    expect(entryHasBackground(fixture('root-background.jsx'))).toBe(true)
  })

  test('finds one reachable only through a relative import', () => {
    expect(entryHasBackground(fixture('entry-importing-middle.jsx'))).toBe(true)
  })

  test('stays false for an app that defers nothing', () => {
    expect(entryHasBackground(fixture('no-background.jsx'))).toBe(false)
  })

  test('stays false for an unreadable entry', () => {
    expect(entryHasBackground('@lynx-js/react/refresh')).toBe(false)
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
