/// <reference types="vitest/globals" />

import './foo.css';

it('should install the CSS chunk', async function() {
  const hasChunkInstalled = Object.keys(__webpack_require__.O).every((
    key,
  ) => (__webpack_require__.O[key]('css-css_initial_foo_css')));

  expect(hasChunkInstalled).toBe(true);
});
