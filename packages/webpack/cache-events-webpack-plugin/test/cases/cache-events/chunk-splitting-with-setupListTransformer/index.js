/// <reference types="vitest/globals" />

import { add } from './lib-common.js';

it('should append new setup list item', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeTruthy();
  expect(__webpack_require__['lynx_ce']['setupList'].length).toBe(3);
  expect(
    __webpack_require__['lynx_ce']['setupList'].map((item) => item.name),
  ).toEqual(['ttMethod', 'performanceEvent', 'customCacheEvent']);
  expect(__webpack_require__['lynx_ce']['loaded']).toBe(true);
  expect(__webpack_require__['lynx_ce']['cachedActions'].length).toBe(
    0,
  );
});
