// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/// <reference types="@rspack/test-tools/rstest" />

import { add } from './lib-common.js';

it('should append new setup list item', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeTruthy();
  expect(__webpack_require__['lynx_ce']['setupList'].length).toBe(4);
  expect(
    __webpack_require__['lynx_ce']['setupList'].map((item) => item.name),
  ).toEqual(['ttMethod', 'performanceEvent', 'globalThis', 'customCacheEvent']);
  expect(__webpack_require__['lynx_ce']['loaded']).toBe(true);
  expect(__webpack_require__['lynx_ce']['cachedActions'].length).toBe(
    0,
  );
});
