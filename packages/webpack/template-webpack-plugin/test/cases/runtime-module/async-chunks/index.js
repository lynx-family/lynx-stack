/// <reference types="@rstest/core/globals" />

import(
  /* webpackChunkName: 'dynamic' */
  './dynamic.js'
);

import(
  /* webpackChunkName: 'dynamic' */
  './dynamic2.js'
);

import(
  /* webpackChunkName: 'dynamic-foo' */
  './dynamic.js'
);

it('should have changed bundle', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/dynamic.${__webpack_require__.h()}.bundle`,
    `lazy-bundle/dynamic-foo.${__webpack_require__.h()}.bundle`,
  ]);
});
