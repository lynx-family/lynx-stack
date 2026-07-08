/// <reference types="@rstest/core/globals" />

import { add } from 'async-ext';

// Captured during module eval: for an async entry this runs after the external
// resolves but before the entry settles, so it is before `onLoaded` clears the
// list.
const setupNames = __webpack_require__['lynx_ce']['setupList'].map(
  (item) => item.name,
);

it('injects the cache-events runtime for an async entry without chunk splitting', () => {
  expect(add(1, 2)).toBe(3);
  expect(__webpack_require__['lynx_ce']).toBeTruthy();
  expect(setupNames).toEqual(['ttMethod', 'performanceEvent', 'globalThis']);
});
