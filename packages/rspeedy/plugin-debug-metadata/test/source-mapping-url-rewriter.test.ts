// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from 'vitest'

import { rewriteTrailerToAbsoluteUrl } from '../src/source-mapping-url-rewriter.js'

const SAMPLE_BODY = 'var __webpack_modules__ = {};\nconsole.log(42);\n'
const wrap = (trailer: string): string => SAMPLE_BODY + trailer

describe('rewriteTrailerToAbsoluteUrl', () => {
  const ASYNC_MAP = 'static/js/async/Lazy-react__main-thread.js.map'
  const ASYNC_MAP_ENC = encodeURIComponent(ASYNC_MAP)
  const BUNDLE_URL =
    'http://host:3020/.rspeedy/async/Lazy.js/debug-metadata.json'

  test('replaces the trailer with the caller-supplied metadata URL plus path query', () => {
    const before = wrap(
      '//# sourceMappingURL=http://host:3020/static/js/async/Lazy-react__main-thread.js.map',
    )
    const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
  })

  test('discards the original trailer\'s dir entirely (cross-dir case)', () => {
    const before = wrap(
      '//# sourceMappingURL=/static/js/async/Lazy-react__main-thread.js.map',
    )
    const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP)
    expect(after).not.toContain(
      '/static/js/async/Lazy-react__main-thread.js.map',
    )
    expect(after).toContain(BUNDLE_URL)
  })

  test('overwrites any existing query string on the original trailer', () => {
    const before = wrap(
      '//# sourceMappingURL=/static/js/async/Lazy-react__main-thread.js.map?token=abc',
    )
    const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP)
    expect(after).not.toContain('token=abc')
    expect(after).toContain(`${BUNDLE_URL}?field=source-map&path=`)
  })

  test('accepts the legacy `//@ sourceMappingURL=` form', () => {
    const before = wrap('//@ sourceMappingURL=Lazy.js.map')
    const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP)
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
  })

  test('returns undefined for data: URL trailers', () => {
    const before = wrap(
      '//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==',
    )
    expect(rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP))
      .toBeUndefined()
  })

  test('returns undefined when there is no trailer', () => {
    expect(rewriteTrailerToAbsoluteUrl(SAMPLE_BODY, BUNDLE_URL, ASYNC_MAP))
      .toBeUndefined()
  })

  test('returns undefined for an empty-URL trailer', () => {
    expect(
      rewriteTrailerToAbsoluteUrl(
        '//# sourceMappingURL=',
        BUNDLE_URL,
        ASYNC_MAP,
      ),
    )
      .toBeUndefined()
  })

  test('is idempotent — skips a trailer that already points at debug-metadata.json', () => {
    const before = wrap(
      `//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
    expect(rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP))
      .toBeUndefined()
  })

  test('tolerates trailing whitespace after the URL', () => {
    const before = `${SAMPLE_BODY}//# sourceMappingURL=Lazy.js.map  \n`
    const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, ASYNC_MAP)!
    expect(after).toContain(
      `//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
  })

  test('encodes mapAssetPath segments (./ artifact from webpack chunk naming)', () => {
    const mapWithDot = 'static/js/async/./Lazy-react__main-thread.js.map'
    const before = wrap('//# sourceMappingURL=Lazy.js.map')
    const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, mapWithDot)
    expect(after).toContain(
      `path=${encodeURIComponent(mapWithDot)}`,
    )
  })

  test('matches only the FINAL trailer, not inner module-body lookalikes', () => {
    const source = [
      '// inner module body:',
      '//# sourceMappingURL=should-not-touch.js.map',
      '// more code',
      '//# sourceMappingURL=Lazy.js.map',
    ].join('\n')
    const after = rewriteTrailerToAbsoluteUrl(source, BUNDLE_URL, ASYNC_MAP)!
    expect(after).toContain(
      `//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
    expect(after).toContain('//# sourceMappingURL=should-not-touch.js.map')
  })

  test('uses full bundler-relative mapAssetPath so same-basename across entries disambiguates', () => {
    const appMap = 'app/index.js.map'
    const vendorMap = 'vendor/index.js.map'
    const before = wrap('//# sourceMappingURL=index.js.map')
    expect(rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, appMap)).toContain(
      `path=${encodeURIComponent(appMap)}`,
    )
    expect(rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, vendorMap))
      .toContain(
        `path=${encodeURIComponent(vendorMap)}`,
      )
  })

  describe('CSS block-comment trailer', () => {
    const CSS_BODY = '.App { color: red; }\n'
    const CSS_MAP = 'main.css.map'
    const CSS_MAP_ENC = encodeURIComponent(CSS_MAP)

    test('rewrites a `/*# sourceMappingURL=… */` trailer and keeps the block-comment form', () => {
      const before =
        `${CSS_BODY}/*# sourceMappingURL=http://host:3020/main.css.map*/`
      const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, CSS_MAP)
      expect(after).toBe(
        `${CSS_BODY}/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`,
      )
    })

    test('accepts the legacy `/*@ sourceMappingURL=` form', () => {
      const before = `${CSS_BODY}/*@ sourceMappingURL=main.css.map*/`
      const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, CSS_MAP)
      expect(after).toBe(
        `${CSS_BODY}/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`,
      )
    })

    test('tolerates whitespace before the closing block-comment', () => {
      const before = `${CSS_BODY}/*# sourceMappingURL=main.css.map */\n`
      const after = rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, CSS_MAP)!
      expect(after).toContain(
        `/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`,
      )
    })

    test('is idempotent for CSS trailers already pointing at debug-metadata.json', () => {
      const before =
        `${CSS_BODY}/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`
      expect(rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, CSS_MAP))
        .toBeUndefined()
    })

    test('does not match a JS-style trailer hiding inside a CSS file body', () => {
      const before =
        `.content::before { content: "//# sourceMappingURL=lure.js.map"; }\n`
      expect(rewriteTrailerToAbsoluteUrl(before, BUNDLE_URL, CSS_MAP))
        .toBeUndefined()
    })
  })
})
