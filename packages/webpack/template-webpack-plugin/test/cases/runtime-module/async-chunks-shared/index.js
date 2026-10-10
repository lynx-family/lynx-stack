/// <reference types="@rstest/core/globals" />

import('./page-a.js');
import('./page-b.js');

it('keeps a named common chunk out of the lazy-bundle map', () => {
  expect(Object.keys(__webpack_require__['lynx_aci'])).not.toContain('shared');
  expect(Object.values(__webpack_require__['lynx_aci']).sort()).toStrictEqual([
    `lazy-bundle/page-a.js.${__webpack_require__.h()}.bundle`,
    `lazy-bundle/page-b.js.${__webpack_require__.h()}.bundle`,
  ]);
});
