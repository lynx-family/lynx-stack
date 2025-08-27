/// <reference types="vitest/globals" />

import { add } from './lib-common.js';

it('should not have `__webpack_require__.lynx_ce`', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeFalsy();
});
