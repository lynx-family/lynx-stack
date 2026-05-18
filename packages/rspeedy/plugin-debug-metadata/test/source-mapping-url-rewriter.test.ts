// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { rewriteTrailer } from '../src/source-mapping-url-rewriter.js'

const SAMPLE_BODY = 'var __webpack_modules__ = {};\nconsole.log(42);\n'

const wrap = (trailer: string): string => SAMPLE_BODY + trailer

const MAP = '.rspeedy/main/main-thread.js.map'
const MAP_ENC = encodeURIComponent(MAP)

describe('rewriteTrailer', () => {
  test('rewrites a bare-filename trailer to a relative endpoint URL', () => {
    const before = wrap('//# sourceMappingURL=main-thread.js.map')
    const after = rewriteTrailer(before, MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
  })

  test('preserves the absolute-path dir from a prod-style trailer', () => {
    const bg = '.rspeedy/main/background.abc123.js.map'
    const before = wrap(
      '//# sourceMappingURL=/.rspeedy/main/background.abc123.js.map',
    )
    const after = rewriteTrailer(before, bg)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=/.rspeedy/main/debug-metadata.json?field=source-map&path=${
        encodeURIComponent(bg)
      }`,
    )
  })

  test('preserves the full origin from a dev-server URL', () => {
    const before = wrap(
      '//# sourceMappingURL=http://192.168.1.128:3010/.rspeedy/main/main-thread.js.map',
    )
    const after = rewriteTrailer(before, MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=http://192.168.1.128:3010/.rspeedy/main/debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
  })

  test('overwrites any existing query string', () => {
    const before = wrap(
      '//# sourceMappingURL=/.rspeedy/main/main-thread.js.map?token=abc',
    )
    const after = rewriteTrailer(before, MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=/.rspeedy/main/debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
  })

  test('strips any fragment from the original URL', () => {
    const map = 'a/b.js.map'
    const before = wrap('//# sourceMappingURL=/a/b.js.map#frag')
    const after = rewriteTrailer(before, map)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=/a/debug-metadata.json?field=source-map&path=${
        encodeURIComponent(map)
      }`,
    )
  })

  test('accepts the legacy `//@ sourceMappingURL=` form', () => {
    const before = wrap('//@ sourceMappingURL=main-thread.js.map')
    const after = rewriteTrailer(before, MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
  })

  test('returns undefined for data: URLs', () => {
    const before = wrap(
      '//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==',
    )
    expect(rewriteTrailer(before, MAP)).toBeUndefined()
  })

  test('returns undefined when the trailer already points at debug-metadata.json (idempotent)', () => {
    const before = wrap(
      `//# sourceMappingURL=/.rspeedy/main/debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
    expect(rewriteTrailer(before, MAP)).toBeUndefined()
  })

  test('returns undefined when there is no trailer', () => {
    expect(rewriteTrailer(SAMPLE_BODY, MAP)).toBeUndefined()
  })

  test('returns undefined when the trailer is the only thing in the file but the URL is empty', () => {
    expect(rewriteTrailer('//# sourceMappingURL=', MAP)).toBeUndefined()
  })

  test('matches only the FINAL trailer, not inner module-body lookalikes', () => {
    const source = [
      '// inner module body:',
      '//# sourceMappingURL=should-not-touch.js.map',
      '// more code',
      '//# sourceMappingURL=main-thread.js.map',
    ].join('\n')
    const after = rewriteTrailer(source, MAP)!
    expect(after.endsWith(
      `//# sourceMappingURL=debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )).toBe(true)
    expect(after).toContain('//# sourceMappingURL=should-not-touch.js.map')
  })

  test('preserves dot-segments (..) in the dir — does NOT collapse them', () => {
    const before = wrap('//# sourceMappingURL=../maps/main-thread.js.map')
    const after = rewriteTrailer(before, MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=../maps/debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
  })

  test('preserves single-dot ./ prefix on the dir', () => {
    const map = 'relative/x.js.map'
    const before = wrap('//# sourceMappingURL=./relative/x.js.map')
    const after = rewriteTrailer(before, map)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=./relative/debug-metadata.json?field=source-map&path=${
        encodeURIComponent(map)
      }`,
    )
  })

  test('tolerates trailing whitespace after the URL', () => {
    const before = `${SAMPLE_BODY}//# sourceMappingURL=main-thread.js.map  \n`
    const after = rewriteTrailer(before, MAP)!
    expect(after).toContain(
      `//# sourceMappingURL=debug-metadata.json?field=source-map&path=${MAP_ENC}`,
    )
  })

  test('uses full bundler-relative `mapAssetPath` so same-basename across entries disambiguates', () => {
    const appMap = 'app/index.js.map'
    const vendorMap = 'vendor/index.js.map'
    const before = wrap('//# sourceMappingURL=index.js.map')
    expect(rewriteTrailer(before, appMap)).toContain(
      `path=${encodeURIComponent(appMap)}`,
    )
    expect(rewriteTrailer(before, vendorMap)).toContain(
      `path=${encodeURIComponent(vendorMap)}`,
    )
  })
})
