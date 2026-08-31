// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, it } from '@rstest/core'

import { routeSectionsForWeb } from '../src/webpack/WebExternalBundleEncodePlugin.js'

describe('web section routing', () => {
  it('puts the main thread chunk where the web runtime reads it', () => {
    const { lepusCode, manifest } = routeSectionsForWeb({
      'utils__main-thread': {
        encoding: 'JsBytecode',
        content: 'mts source',
      },
      utils: { content: 'bts source' },
    })

    expect(lepusCode).toStrictEqual({ 'utils__main-thread': 'mts source' })
    // `readScript` looks a background chunk up by path, the way a card carries
    // its own `/app-service.js`.
    expect(manifest).toStrictEqual({ '/utils': 'bts source' })
  })

  it('puts the styles in the StyleInfo section under numeric ids', () => {
    const { styleInfo, lepusCode, manifest } = routeSectionsForWeb({
      'utils:CSS': { encoding: 'CSS', content: { ruleList: [] } },
    })

    expect(styleInfo).toStrictEqual({ 0: [] })
    expect(lepusCode).toStrictEqual({})
    expect(manifest).toStrictEqual({})
  })
})
