/// <reference types="@rstest/core/globals" />

import { load } from './subdir/importer.js';

import('./dynamic.js');

load();

it('should map both import paths to the same bundle', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/dynamic.js.${__webpack_require__.h()}.bundle`,
  ]);
});
