/// <reference types="@rstest/core/globals" />

import(
  './a-very-long-directory-name-to-exceed-the-limit-0/a-very-long-directory-name-to-exceed-the-limit-1/dynamic.js'
);

// A resolved module path is unbounded — in a pnpm workspace a single directory
// encodes every peer dependency — but the lazy bundle name becomes a path where
// the bundle is unpacked. Past the limit the directories are replaced by a
// digest, keeping the file name.
it('should shorten an overlong lazy bundle name', () => {
  expect(Object.values(__webpack_require__['lynx_aci'])).toStrictEqual([
    `lazy-bundle/dynamic.js-43236c58.${__webpack_require__.h()}.bundle`,
  ]);
});
