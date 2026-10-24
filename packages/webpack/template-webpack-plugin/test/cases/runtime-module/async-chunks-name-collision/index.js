/// <reference types="@rstest/core/globals" />

import(
  /* webpackChunkName: 'dynamic' */
  '../async-chunks/dynamic.js'
);
import(
  /* webpackChunkName: 'dynamic' */
  '../async-chunks/dynamic2.js'
);
import(
  /* webpackChunkName: 'dynamic-foo' */
  '../async-chunks/dynamic.js'
);

it('keeps a split chunk reused by named imports off the lazy-bundle map', () => {
  expect(__webpack_require__['lynx_aci']).not.toHaveProperty('dynamic');
});
