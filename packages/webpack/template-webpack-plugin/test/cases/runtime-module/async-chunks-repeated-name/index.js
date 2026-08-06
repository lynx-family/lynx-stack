/// <reference types="@rstest/core/globals" />

import('./dynamic.js');

// Every `[name]` in a custom `lazyBundleFilename` must be substituted, not just
// the first one.
it('should replace every [name] in the lazy bundle filename', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/dynamic.js/dynamic.js.${__webpack_require__.h()}.bundle`,
  ]);
});
