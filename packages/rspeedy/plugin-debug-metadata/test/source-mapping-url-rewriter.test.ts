// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { describe, expect, test } from '@rstest/core'

import {
  rewriteSourceMappingURL,
  rewriteSourceMappingURLToAbsolute,
} from '../src/source-mapping-url-rewriter.js'

const SAMPLE_BODY = 'var __webpack_modules__ = {};\nconsole.log(42);\n'
const wrap = (directive: string): string => SAMPLE_BODY + directive

describe('rewriteSourceMappingURLToAbsolute', () => {
  const ASYNC_MAP = 'static/js/async/Lazy-react__main-thread.js.map'
  const ASYNC_MAP_ENC = encodeURIComponent(ASYNC_MAP)
  const BUNDLE_URL =
    'http://host:3020/.rspeedy/async/Lazy.js/debug-metadata.json'

  test('replaces the directive with the caller-supplied metadata URL plus path query', () => {
    const before = wrap(
      '//# sourceMappingURL=http://host:3020/static/js/async/Lazy-react__main-thread.js.map',
    )
    const after = rewriteSourceMappingURLToAbsolute(
      before,
      BUNDLE_URL,
      ASYNC_MAP,
    )
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
  })

  test('discards the original directive\'s dir entirely (cross-dir case)', () => {
    const before = wrap(
      '//# sourceMappingURL=/static/js/async/Lazy-react__main-thread.js.map',
    )
    const after = rewriteSourceMappingURLToAbsolute(
      before,
      BUNDLE_URL,
      ASYNC_MAP,
    )
    expect(after).not.toContain(
      '/static/js/async/Lazy-react__main-thread.js.map',
    )
    expect(after).toContain(BUNDLE_URL)
  })

  test('overwrites any existing query string on the original directive', () => {
    const before = wrap(
      '//# sourceMappingURL=/static/js/async/Lazy-react__main-thread.js.map?token=abc',
    )
    const after = rewriteSourceMappingURLToAbsolute(
      before,
      BUNDLE_URL,
      ASYNC_MAP,
    )
    expect(after).not.toContain('token=abc')
    expect(after).toContain(`${BUNDLE_URL}?field=source-map&path=`)
  })

  test('accepts the legacy `//@ sourceMappingURL=` form', () => {
    const before = wrap('//@ sourceMappingURL=Lazy.js.map')
    const after = rewriteSourceMappingURLToAbsolute(
      before,
      BUNDLE_URL,
      ASYNC_MAP,
    )
    expect(after).toBe(
      `${SAMPLE_BODY}//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
  })

  test('returns undefined for data: URL directives', () => {
    const before = wrap(
      '//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==',
    )
    expect(rewriteSourceMappingURLToAbsolute(before, BUNDLE_URL, ASYNC_MAP))
      .toBeUndefined()
  })

  test('returns undefined when there is no directive', () => {
    expect(
      rewriteSourceMappingURLToAbsolute(SAMPLE_BODY, BUNDLE_URL, ASYNC_MAP),
    )
      .toBeUndefined()
  })

  test('returns undefined for an empty-URL directive', () => {
    expect(
      rewriteSourceMappingURLToAbsolute(
        '//# sourceMappingURL=',
        BUNDLE_URL,
        ASYNC_MAP,
      ),
    )
      .toBeUndefined()
  })

  test('is idempotent — skips a directive that already points at debug-metadata.json', () => {
    const before = wrap(
      `//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
    expect(rewriteSourceMappingURLToAbsolute(before, BUNDLE_URL, ASYNC_MAP))
      .toBeUndefined()
  })

  test('tolerates trailing whitespace after the URL', () => {
    const before = `${SAMPLE_BODY}//# sourceMappingURL=Lazy.js.map  \n`
    const after = rewriteSourceMappingURLToAbsolute(
      before,
      BUNDLE_URL,
      ASYNC_MAP,
    )!
    expect(after).toContain(
      `//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
  })

  test('encodes mapAssetPath segments (./ artifact from webpack chunk naming)', () => {
    const mapWithDot = 'static/js/async/./Lazy-react__main-thread.js.map'
    const before = wrap('//# sourceMappingURL=Lazy.js.map')
    const after = rewriteSourceMappingURLToAbsolute(
      before,
      BUNDLE_URL,
      mapWithDot,
    )
    expect(after).toContain(
      `path=${encodeURIComponent(mapWithDot)}`,
    )
  })

  test('matches only the FINAL directive, not inner module-body lookalikes', () => {
    const source = [
      '// inner module body:',
      '//# sourceMappingURL=should-not-touch.js.map',
      '// more code',
      '//# sourceMappingURL=Lazy.js.map',
    ].join('\n')
    const after = rewriteSourceMappingURLToAbsolute(
      source,
      BUNDLE_URL,
      ASYNC_MAP,
    )!
    expect(after).toContain(
      `//# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${ASYNC_MAP_ENC}`,
    )
    expect(after).toContain('//# sourceMappingURL=should-not-touch.js.map')
  })

  test('uses full bundler-relative mapAssetPath so same-basename across entries disambiguates', () => {
    const appMap = 'app/index.js.map'
    const vendorMap = 'vendor/index.js.map'
    const before = wrap('//# sourceMappingURL=index.js.map')
    expect(rewriteSourceMappingURLToAbsolute(before, BUNDLE_URL, appMap))
      .toContain(
        `path=${encodeURIComponent(appMap)}`,
      )
    expect(rewriteSourceMappingURLToAbsolute(before, BUNDLE_URL, vendorMap))
      .toContain(
        `path=${encodeURIComponent(vendorMap)}`,
      )
  })

  describe('CSS block-comment directive', () => {
    const CSS_BODY = '.App { color: red; }\n'
    const CSS_MAP = 'main.css.map'
    const CSS_MAP_ENC = encodeURIComponent(CSS_MAP)

    test('rewrites a `/*# sourceMappingURL=… */` directive and keeps the block-comment form', () => {
      const before =
        `${CSS_BODY}/*# sourceMappingURL=http://host:3020/main.css.map*/`
      const after = rewriteSourceMappingURLToAbsolute(
        before,
        BUNDLE_URL,
        CSS_MAP,
      )
      expect(after).toBe(
        `${CSS_BODY}/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`,
      )
    })

    test('accepts the legacy `/*@ sourceMappingURL=` form', () => {
      const before = `${CSS_BODY}/*@ sourceMappingURL=main.css.map*/`
      const after = rewriteSourceMappingURLToAbsolute(
        before,
        BUNDLE_URL,
        CSS_MAP,
      )
      expect(after).toBe(
        `${CSS_BODY}/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`,
      )
    })

    test('tolerates whitespace before the closing block-comment', () => {
      const before = `${CSS_BODY}/*# sourceMappingURL=main.css.map */\n`
      const after = rewriteSourceMappingURLToAbsolute(
        before,
        BUNDLE_URL,
        CSS_MAP,
      )!
      expect(after).toContain(
        `/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`,
      )
    })

    test('is idempotent for CSS directives already pointing at debug-metadata.json', () => {
      const before =
        `${CSS_BODY}/*# sourceMappingURL=${BUNDLE_URL}?field=source-map&path=${CSS_MAP_ENC}*/`
      expect(rewriteSourceMappingURLToAbsolute(before, BUNDLE_URL, CSS_MAP))
        .toBeUndefined()
    })

    test('does not match a JS-style directive hiding inside a CSS file body', () => {
      const before =
        `.content::before { content: "//# sourceMappingURL=lure.js.map"; }\n`
      expect(rewriteSourceMappingURLToAbsolute(before, BUNDLE_URL, CSS_MAP))
        .toBeUndefined()
    })
  })
})

describe('rewriteSourceMappingURL', () => {
  const CUSTOM_URL =
    'https://gateway.example/raw?metadata_key=abc123&field=source-map&path=foo.js.map'

  test('substitutes the caller URL verbatim into a `//#` directive', () => {
    const before = wrap('//# sourceMappingURL=foo.js.map')
    expect(rewriteSourceMappingURL(before, CUSTOM_URL))
      .toBe(`${SAMPLE_BODY}//# sourceMappingURL=${CUSTOM_URL}`)
  })

  test('substitutes verbatim into a `/*#` block-comment directive', () => {
    const before = `.app{color:red}\n/*# sourceMappingURL=app.css.map*/`
    expect(rewriteSourceMappingURL(before, CUSTOM_URL))
      .toBe(`.app{color:red}\n/*# sourceMappingURL=${CUSTOM_URL}*/`)
  })

  test('accepts a legacy `//@ sourceMappingURL=` directive', () => {
    const before = wrap('//@ sourceMappingURL=foo.js.map')
    expect(rewriteSourceMappingURL(before, CUSTOM_URL))
      .toBe(`${SAMPLE_BODY}//# sourceMappingURL=${CUSTOM_URL}`)
  })

  test('returns undefined when there is no directive', () => {
    expect(rewriteSourceMappingURL(SAMPLE_BODY, CUSTOM_URL)).toBeUndefined()
  })

  test('returns undefined for a `data:` URI directive', () => {
    const before = wrap(
      '//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozfQ==',
    )
    expect(rewriteSourceMappingURL(before, CUSTOM_URL)).toBeUndefined()
  })

  test('returns undefined for an empty-URL directive', () => {
    expect(rewriteSourceMappingURL('//# sourceMappingURL=', CUSTOM_URL))
      .toBeUndefined()
  })

  test('overwrites a directive that already points at the default debug-metadata container', () => {
    // The default `rewriteSourceMappingURLToAbsolute` path is idempotent on
    // the debug-metadata URL; the low-level primitive intentionally is not —
    // it lets a consumer callback replace a URL the default flow baked first.
    const before = wrap(
      '//# sourceMappingURL=http://host/path/debug-metadata.json?field=source-map&path=foo.js.map',
    )
    expect(rewriteSourceMappingURL(before, CUSTOM_URL))
      .toBe(`${SAMPLE_BODY}//# sourceMappingURL=${CUSTOM_URL}`)
  })

  test('matches only the final directive, not lookalike inner module bodies', () => {
    const source = [
      '// inner module body:',
      '//# sourceMappingURL=should-not-touch.js.map',
      '// more code',
      '//# sourceMappingURL=Lazy.js.map',
    ].join('\n')
    const after = rewriteSourceMappingURL(source, CUSTOM_URL)!
    expect(after).toContain(`//# sourceMappingURL=${CUSTOM_URL}`)
    expect(after).toContain('//# sourceMappingURL=should-not-touch.js.map')
  })
})
