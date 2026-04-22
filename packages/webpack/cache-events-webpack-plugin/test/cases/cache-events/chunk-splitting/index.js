/// <reference types="@rspack/test-tools/rstest" />

import { add } from './lib-common.js';

it('should have `__webpack_require__.lynx_ce`', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeTruthy();
  expect(__webpack_require__['lynx_ce']['setupList'].length).toBe(3);
  expect(
    __webpack_require__['lynx_ce']['setupList'].map((item) => item.name),
  ).toEqual(['ttMethod', 'performanceEvent', 'globalThis']);
  expect(__webpack_require__['lynx_ce']['loaded']).toBe(true);
  expect(__webpack_require__['lynx_ce']['cachedActions'].length).toBe(
    0,
  );
});
