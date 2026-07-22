/// <reference types="@rstest/core/globals" />

import('./dynamic.js');

it('should map an unnamed async chunk to its lazy bundle', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/dynamic.js.${__webpack_require__.h()}.bundle`,
  ]);
});
