/*
// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
*/
import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { update } from '@lynx-js/test-tools/update.js';
import { createStubLynx } from '../../../helper/stubLynx.js'

import './entry.css';

import(/* webpackChunkName: "lazy" */ './lazy.js').then((res) => {
  console.log('dynamic import lazy.js', res);
})
import(/* webpackChunkName: "common" */ './common.js').then((res) => {
  console.log('dynamic import common.js', res);
})

const replaceStyleSheetByIdWithBase64 = vi.fn()
const lynx = createStubLynx(
  vi,
  __non_webpack_require__,
  replaceStyleSheetByIdWithBase64
)
vi.stubGlobal('lynx', lynx)
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

it('should has cssHotUpdateList and hot-update.json', () => {
  new Promise(()=>{
    function done(error) {
      if (error) {
        reject(error)
      } else {
        resolve()
      }
    }
    expect(__webpack_require__.cssHotUpdateList).toEqual([
      ["lazy","async/lazy.css.hot-update.json"],
      ["common","async/common.css.hot-update.json"],
      ["entry","entry.css.hot-update.json"]
    ]);
    
    __webpack_require__.cssHotUpdateList.forEach(([_, path]) => {
      expect(existsSync(join(__dirname, path))).toBe(true);
    });

    const { content: entryContent } = __non_webpack_require__('./entry.css.hot-update.json')
    expect(entryContent).toBeBase64EncodedMatching('red');
    const { content: lazyContent } = __non_webpack_require__(`./async/lazy.css.hot-update.json`)
    expect(lazyContent).toBeBase64EncodedMatching('blue');

    let prevHash = __webpack_hash__
    NEXT(
      vi.stubGlobal('lynx', lynx),
      update(done, true, async () => {
        const { content: entryContent } = __non_webpack_require__(`./entry.${prevHash}.css.hot-update.json`)
        expect(entryContent).toBeBase64EncodedMatching('blue');
        done();
      })
    )
  })
})
