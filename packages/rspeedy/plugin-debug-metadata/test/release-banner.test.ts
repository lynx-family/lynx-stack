// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import {
  RELEASE_DEFINE,
  getReleaseDefine,
  getReleaseRuntime,
} from '../src/release-banner.js'

describe('getReleaseDefine', () => {
  test('declares the release define with the chunk hash', () => {
    expect(getReleaseDefine('e0142ec155884fec')).toBe(
      `var ${RELEASE_DEFINE} = "e0142ec155884fec";\n`,
    )
  })

  test('JSON-escapes the release value', () => {
    // A release is normally a hex chunk hash, but never trust it into a string
    // literal unescaped.
    expect(getReleaseDefine('a"b\\c')).toBe(
      `var ${RELEASE_DEFINE} = "a\\"b\\\\c";\n`,
    )
  })

  test('handles an empty release', () => {
    expect(getReleaseDefine('')).toBe(`var ${RELEASE_DEFINE} = "";\n`)
  })
})

describe('getReleaseRuntime', () => {
  const runtime = getReleaseRuntime()

  test('throws the release so the engine can read it off the error', () => {
    expect(runtime).toContain(`throw new Error(${RELEASE_DEFINE})`)
    expect(runtime).toContain(`e.name = 'LynxGetSourceMapReleaseError'`)
  })

  test('registers the release with the Lynx engine', () => {
    expect(runtime).toContain('_SetSourceMapRelease(e)')
    expect(runtime).toContain('lynxCoreInject.tt.setSourceMapRelease(e)')
  })

  test('is a self-invoking IIFE that swallows its own throw', () => {
    expect(runtime.trimStart()).toMatch(/^\(function \(\) \{/)
    expect(runtime).toContain('catch (e)')
  })
})
