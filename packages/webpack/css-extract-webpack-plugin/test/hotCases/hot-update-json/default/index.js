/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />
/* globals expect require vi NEXT DONE */

import fs from 'node:fs'
import path from 'node:path'

import { update } from '@lynx-js/test-tools/update.js'

import styles from './entry.js'
import { createStubLynx } from '../../../helper/stubLynx.js'

const __FlushElementTree = vi.fn()
const replaceStyleSheetByIdWithBase64 = vi.fn()
const lynx = createStubLynx(
  vi,
  __non_webpack_require__,
  replaceStyleSheetByIdWithBase64,
)

vi.stubGlobal('lynx', lynx)
vi.stubGlobal('__FlushElementTree', __FlushElementTree)

__non_webpack_require__(HMR_RUNTIME_LEPUS)

expect.extend({
  toBeBase64EncodedMatching(receive, expected) {
    if (typeof receive !== 'string') {
      return {
        pass: false,
        message: () => `expected to be string, got ${typeof receive}`,
      }
    }

    const decoded = Buffer.from(receive, 'base64').toString('utf-8')
    return {
      pass: decoded.includes(expected),
      message: () => `${receive} does not contains ${expected}`,
    }
  },
})

it('should generate css.hot-update.json', () =>
  new Promise((resolve, reject) => {
    expect(styles).toHaveProperty('foo')
    expect(styles.foo).toStrictEqual(expect.any(String))

    function done(error) {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }

    let prevHash = __webpack_hash__
    
    NEXT(
      update(done, true, async () => {
        const { default: styles } = await import('./entry.js')
        expect(styles).toHaveProperty('foo')
        expect(styles.foo).toStrictEqual(expect.any(String))

        const jsonPath = path.join(__dirname, `main.${prevHash}.css.hot-update.json`)
        expect(fs.existsSync(jsonPath)).toBeTruthy()
        const { content } = __non_webpack_require__(`./main.${prevHash}.css.hot-update.json`)

        expect(content).toBeBase64EncodedMatching(styles.foo)
        expect(content).toBeBase64EncodedMatching(
          '"enableRemoveCSSScope":false',
        )
        expect(content).toBeBase64EncodedMatching('blue')

        prevHash = __webpack_hash__

        NEXT(
          update(done, true, async () => {
            const { default: styles } = await import('./entry.js')
            expect(styles).toHaveProperty('bar')
            expect(styles['bar']).toStrictEqual(expect.any(String))

            const jsonPath = path.join(__dirname, `main.${prevHash}.css.hot-update.json`)
            expect(fs.existsSync(jsonPath)).toBeTruthy()
            const { content } = __non_webpack_require__(`./main.${prevHash}.css.hot-update.json`)

            console.log(content)

            expect(content).toBeBase64EncodedMatching(styles.bar)
            expect(content).toBeBase64EncodedMatching(
              '"enableRemoveCSSScope":false',
            )
            expect(content).toBeBase64EncodedMatching('blue')
            done()
          }),
        )
      }),
    )
  }))
