/// <reference types="@rstest/core/globals" />

import(
  /* webpackChunkName: 'dynamic' */
  './dynamic.js'
);

it('should have changed bundle', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/dynamic.${__webpack_require__.h()}.bundle`,
  ]);
});
