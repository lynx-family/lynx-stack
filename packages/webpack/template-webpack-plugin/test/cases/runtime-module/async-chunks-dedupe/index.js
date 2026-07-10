/// <reference types="@rstest/core/globals" />

import { load } from './subdir/importer.js';

import(
  /* webpackChunkName: './dynamic.js:background' */
  './dynamic.js'
);

load();

it('should map both import paths to the same bundle', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `async/dynamic.js.${__webpack_require__.h()}.bundle`,
  ]);
});
