/// <reference types="vitest/globals" />

import('./lazy-component.js');

it('should not have `__webpack_require__.lynx_ce`', () => {
  expect(__webpack_require__['lynx_ce']).toBeFalsy();
});
