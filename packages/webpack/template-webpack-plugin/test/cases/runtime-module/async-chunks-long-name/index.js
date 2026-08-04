/// <reference types="@rstest/core/globals" />

import(
  './a-very-long-directory-name-to-exceed-the-limit-0/a-very-long-directory-name-to-exceed-the-limit-1/dynamic.js'
);

it('should shorten an overlong lazy bundle name', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/a-very-long-directory-name-to-exceed-the-limit-1_dynamic.js-43236c58.${__webpack_require__.h()}.bundle`,
  ]);
});
