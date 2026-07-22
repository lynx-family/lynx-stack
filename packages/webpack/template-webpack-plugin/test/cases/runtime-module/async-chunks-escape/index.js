/// <reference types="@rstest/core/globals" />

import('./dynamic.js');

// `dynamic.js` resolves above the compiler `context` (set to `./nested`), so
// its path relative to the context starts with `..`. The lazy bundle name must
// replace `..` with `__` so the output stays inside the `lazy-bundle/` directory.
it('should keep a bundle resolved outside the context inside lazy-bundle/', () => {
  const names = Object.values(__webpack_require__['lynx_aci']);
  expect(names).toStrictEqual([
    `lazy-bundle/__/dynamic.js.${__webpack_require__.h()}.bundle`,
  ]);
  for (const name of names) {
    expect(name.startsWith('lazy-bundle/')).toBe(true);
    expect(name.includes('/../')).toBe(false);
  }
});
