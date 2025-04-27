/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
/// <reference types="vitest/globals" />
/* globals expect require vi NEXT DONE */

import { update } from '@lynx-js/test-tools/update.js'

import './file.css?cssId=100'
import { createStubLynx } from '../../../helper/stubLynx.js'

const __FlushElementTree = vi.fn()
const replaceStyleSheetByIdWithBase64 = vi.fn()
const lynx = createStubLynx(vi, __non_webpack_require__, replaceStyleSheetByIdWithBase64)

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

it("should hot update style sheet when scoped", () => new Promise((resolve, reject) => {
  function done(error) {
    if (error) {
      reject(error)
    } else {
      resolve()
    }
  }
  NEXT(
    update(done, true, () => {
      expect(replaceStyleSheetByIdWithBase64).toBeCalled()
      expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
        /** cssId */ 100,
        /** content */ expect.toBeBase64EncodedMatching(
          '"enableRemoveCSSScope":false',
        ),
        /** entry */ undefined,
      )
      expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
        /** cssId */ 100,
        /** content */ expect.toBeBase64EncodedMatching('foo'),
        /** entry */ undefined,
      )
      expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
        /** cssId */ 100,
        /** content */ expect.toBeBase64EncodedMatching('blue'),
        /** entry */ undefined,
      )
      expect(replaceStyleSheetByIdWithBase64).toBeCalledTimes(3)
      NEXT(
        update(done, true, () => {
          expect(replaceStyleSheetByIdWithBase64).toBeCalled()
          expect(replaceStyleSheetByIdWithBase64).toBeCalledTimes(6)
          expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
            /** cssId */ 100,
            /** content */ expect.toBeBase64EncodedMatching(
              '"enableRemoveCSSScope":false',
            ),
            /** entry */ undefined,
          )
          expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
            /** cssId */ 100,
            /** content */ expect.toBeBase64EncodedMatching('baz'),
            /** entry */ undefined,
          )
          expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
            /** cssId */ 100,
            /** content */ expect.toBeBase64EncodedMatching('blue'),
            /** entry */ undefined,
          )
          expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
            /** cssId */ 100,
            /** content */ expect.toBeBase64EncodedMatching('bar'),
            /** entry */ undefined,
          )
          expect(replaceStyleSheetByIdWithBase64).toBeCalledWith(
            /** cssId */ 100,
            /** content */ expect.toBeBase64EncodedMatching(
              'rgba(15, 18, 19, 0.5)',
            ),
            /** entry */ undefined,
          )
          done()
        }),
      )
    }),
  )
}));
